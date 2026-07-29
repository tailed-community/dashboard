import { Router, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../lib/firebase";
import { sendJobAlertWelcomeEmail } from "../lib/email-service";
import { buildUnsubscribeUrl } from "../lib/links";
import { upsertStudentUser } from "../lib/user-management";
import { buildSignInLink } from "../lib/auth-links";
import { localeFromAcceptLanguage, type Locale } from "../lib/locale";
import { frontendUrl } from "../lib/env";

const router = Router();

const MAX_SUBSCRIPTIONS_PER_EMAIL = 5;
const ALERTS_COLLECTION = "jobAlertSubscriptions";
const DIGEST_RUNS_COLLECTION = "digestRuns";

/**
 * Timestamp serialization convention for this router: every Firestore
 * Timestamp / Date is serialized to an **ISO 8601 string** (or `null` when
 * absent). The frontend `src/lib/alerts.ts` types mirror this (string dates).
 */
function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const maybeTs = value as { toDate?: () => Date };
  if (typeof maybeTs.toDate === "function") {
    return maybeTs.toDate().toISOString();
  }
  return null;
}

type NormalizableAlertFields = {
  query?: string | null;
  locations?: string[] | null;
  jobType?: "internship" | "new-grad" | null;
};

/**
 * Shared normalization for the alert-criteria fields, used by both POST
 * /subscribe and PATCH /:id. Empty query/locations collapse to `null`; an
 * absent jobType collapses to `null`. Only keys present on the input are
 * present on the output, so PATCH can apply a true partial update.
 */
function normalizeAlertFields(fields: NormalizableAlertFields): NormalizableAlertFields {
  const normalized: NormalizableAlertFields = {};
  if ("query" in fields) {
    normalized.query = fields.query && fields.query.length > 0 ? fields.query : null;
  }
  if ("locations" in fields) {
    normalized.locations =
      fields.locations && fields.locations.length > 0 ? fields.locations : null;
  }
  if ("jobType" in fields) {
    normalized.jobType = fields.jobType || null;
  }
  return normalized;
}

/**
 * Loads an alert by id and enforces per-user ownership: allowed when
 * `doc.userId === uid` OR `doc.email === user.email`. On a match where
 * `userId` is null (alert created while logged out), backfills `userId = uid`.
 * Returns `null` for a missing OR non-owned alert so callers respond 404
 * without leaking existence. The returned `data` reflects any backfill.
 */
async function loadOwnedAlert(
  alertId: string,
  user: { uid: string; email?: string }
): Promise<{
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
} | null> {
  const ref = db.collection(ALERTS_COLLECTION).doc(alertId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const data = snap.data() as FirebaseFirestore.DocumentData;
  const ownsByUserId = data.userId != null && data.userId === user.uid;
  const ownsByEmail = !!user.email && data.email === user.email;
  if (!ownsByUserId && !ownsByEmail) return null;

  if (data.userId == null) {
    await ref.update({ userId: user.uid });
    data.userId = user.uid;
  }

  return { ref, data };
}

/** Serializes an alert doc to the list-summary shape returned by GET /alerts/mine. */
function buildAlertSummary(
  id: string,
  data: FirebaseFirestore.DocumentData,
  lastBatch: { sentAt: string | null; jobCount: number } | null
) {
  return {
    id,
    query: data.query ?? null,
    jobType: data.jobType ?? null,
    locations: data.locations ?? null,
    frequency: data.frequency ?? "daily",
    active: data.active ?? false,
    source: data.source ?? null,
    createdAt: toIso(data.createdAt),
    lastSentAt: toIso(data.lastSentAt),
    lastBatch,
  };
}

/** Serializes an alert doc to the full shape returned by GET /alerts/:id (no unsubscribeToken). */
function buildFullAlert(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    email: data.email ?? null,
    source: data.source ?? null,
    query: data.query ?? null,
    locations: data.locations ?? null,
    jobType: data.jobType ?? null,
    frequency: data.frequency ?? "daily",
    active: data.active ?? false,
    userId: data.userId ?? null,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    lastSentAt: toIso(data.lastSentAt),
    lastSentJobDate: typeof data.lastSentJobDate === "number" ? data.lastSentJobDate : null,
  };
}

/** Serializes a digestRuns doc to the DigestRunDoc shape (sentAt as ISO string). */
function buildDigestRun(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  return {
    id: doc.id,
    sentAt: toIso(data.sentAt),
    jobIds: Array.isArray(data.jobIds) ? data.jobIds : [],
    jobCount: typeof data.jobCount === "number" ? data.jobCount : 0,
    matchedCount: typeof data.matchedCount === "number" ? data.matchedCount : 0,
    watermarkBefore: typeof data.watermarkBefore === "number" ? data.watermarkBefore : null,
    watermarkAfter: typeof data.watermarkAfter === "number" ? data.watermarkAfter : null,
  };
}

/** Recursively deletes the digestRuns subcollection under an alert (chunked batches). */
async function deleteDigestRuns(alertRef: FirebaseFirestore.DocumentReference): Promise<void> {
  const runsRef = alertRef.collection(DIGEST_RUNS_COLLECTION);
  for (;;) {
    const snap = await runsRef.limit(300).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((runDoc) => batch.delete(runDoc.ref));
    await batch.commit();
    if (snap.size < 300) break;
  }
}

/**
 * `email` is optional on purpose: an authenticated caller's address is taken
 * from their verified ID token and the body value is ignored entirely (see the
 * handler), so the frontend doesn't have to send — or ask for — an email it
 * already knows. It stays required for anonymous captures.
 */
const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  source: z.enum([
    "search",
    "landing_strip",
    "landing_footer",
    "job_detail",
    "save_job",
    "digest_prompt",
    "event_rsvp_optin",
  ]),
  query: z.string().trim().max(200).optional().nullable(),
  locations: z.array(z.string().trim().max(100)).max(10).optional().nullable(),
  jobType: z.enum(["internship", "new-grad"]).optional().nullable(),
  frequency: z.enum(["daily", "weekly"]).optional(),
});

/**
 * POST /alerts/subscribe
 * Public — no auth required. Creates (or, on duplicate, updates) a job-alert
 * subscription. Always responds { success: true } on valid input; never
 * blocks the caller's underlying action (search/save/RSVP/etc).
 *
 * Address of record: for an authenticated caller it is ALWAYS the ID token's
 * email — a body `email` is ignored, so a signed-in user can't point a digest
 * (or the welcome email, which carries a one-tap sign-in link) at someone
 * else's inbox. Only anonymous captures may supply an address, and those are
 * unverified single opt-in by design (spec 04), rate-limited by the per-email
 * subscription cap below and revocable from every email's unsubscribe link.
 */
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const validationResult = subscribeSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const {
      email: bodyEmail,
      source,
      query,
      locations,
      jobType,
      frequency = "daily",
    } = validationResult.data;

    const authedEmail = req.user?.email?.trim().toLowerCase() || null;
    if (authedEmail && bodyEmail && bodyEmail !== authedEmail) {
      // Not an error for the caller — we just never honour it. Logged because
      // a legitimate frontend has no reason to send a different address.
      console.warn(
        `alerts/subscribe: ignoring body email for authenticated uid ${req.user?.uid} (source: ${source})`
      );
    }
    const email = authedEmail ?? bodyEmail ?? null;
    if (!email) {
      return res.status(400).json({ error: "An email address is required" });
    }
    // Shared field normalization (empty query/locations → null, absent jobType → null).
    // Pass all three keys explicitly so every field is normalized even when omitted.
    const normalized = normalizeAlertFields({ query, locations, jobType });
    const normalizedQuery = normalized.query ?? null;
    const normalizedLocations = normalized.locations ?? null;
    const normalizedJobType = normalized.jobType ?? null;

    // Every email capture becomes a real (soft) account so the alert is owned by
    // a profile from the start — the user can later sign in with the same email
    // and manage/unsubscribe it. If already authenticated, use their uid. If the
    // caller is anonymous, lazily create (or reuse) the Students-tenant account +
    // profile doc via the shared lenient upsert path. Account creation must never
    // block the subscription: on any failure we fall back to an email-only link
    // (userId: null), which the authenticated /mine + backfill path can still claim.
    // Anonymous captures get a soft account + a magic sign-in link in the
    // welcome email; already-authenticated callers need neither.
    // Public endpoint → the browser tells us its language via Accept-Language.
    // This both (a) seeds a newly-created soft profile's preferredLanguage and
    // (b) is the fallback locale for the welcome email when no saved profile
    // language exists. Primary language tag starts-with "fr" → "fr", else "en".
    const acceptLanguageLocale = localeFromAcceptLanguage(
      req.headers["accept-language"]
    );

    const wasAnonymous = !req.user?.uid;
    let userId = req.user?.uid || null;
    if (!userId) {
      try {
        const upsertResult = await upsertStudentUser({
          email,
          profileSource: "alert_capture",
          preferredLanguage: acceptLanguageLocale,
        });
        if (upsertResult.userRecord?.uid) {
          userId = upsertResult.userRecord.uid;
        } else if (upsertResult.error) {
          console.error(
            `alert_capture account upsert failed for ${email}:`,
            upsertResult.error
          );
        }
      } catch (accountError) {
        console.error(
          `alert_capture account upsert threw for ${email}:`,
          accountError
        );
      }
    }

    const subscriptionsRef = db.collection("jobAlertSubscriptions");

    // Dedupe: one active subscription per (email, query, jobType) triple.
    const existingQuery = await subscriptionsRef
      .where("email", "==", email)
      .where("query", "==", normalizedQuery)
      .where("jobType", "==", normalizedJobType)
      .where("active", "==", true)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      const existingDoc = existingQuery.docs[0];
      const existingData = existingDoc.data();
      await existingDoc.ref.update({
        locations: normalizedLocations,
        source,
        // Re-subscribing with a different cadence must move the existing row,
        // otherwise the dedupe branch would silently keep the old schedule.
        frequency,
        userId: existingData.userId || userId,
        updatedAt: new Date(),
      });

      return res.status(200).json({ success: true });
    }

    // Abuse guard: cap total subscriptions (active + inactive) per email.
    const countSnapshot = await subscriptionsRef.where("email", "==", email).get();
    if (countSnapshot.size >= MAX_SUBSCRIPTIONS_PER_EMAIL) {
      return res.status(429).json({
        error: "Too many alert subscriptions for this email address",
      });
    }

    const unsubscribeToken = randomBytes(32).toString("hex");
    const now = new Date();

    await subscriptionsRef.add({
      email,
      source,
      query: normalizedQuery,
      locations: normalizedLocations,
      jobType: normalizedJobType,
      frequency,
      active: true,
      unsubscribeToken,
      userId,
      createdAt: now,
      updatedAt: now,
      lastSentAt: null,
      lastSentJobDate: null,
    });

    try {
      const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

      // For anonymous captures, generate a one-time sign-in link server-side so
      // the welcome email can offer one-tap access to the soft account we just
      // created. Best-effort: a link-generation failure must not skip the email.
      let signInUrl: string | undefined;
      if (wasAnonymous) {
        try {
          // Generic "your account is ready" sign-in → dashboard. Contextual
          // redirects (e.g. "manage your alerts") belong to the specific CTA
          // that triggers them, not this welcome email's generic sign-in.
          signInUrl = await buildSignInLink(email, "/dashboard");
        } catch (linkError) {
          console.error(`Failed to generate sign-in link for ${email}:`, linkError);
        }
      }

      // Welcome-email locale: prefer a saved profile language (an existing,
      // already-authenticated subscriber may have chosen one), otherwise fall
      // back to the browser's Accept-Language. Best-effort — never block send.
      let welcomeLocale: Locale = acceptLanguageLocale;
      if (userId) {
        try {
          const profileSnap = await db.collection("profiles").doc(userId).get();
          const saved = profileSnap.data()?.preferredLanguage;
          if (saved === "en" || saved === "fr") {
            welcomeLocale = saved;
          }
        } catch (langError) {
          console.error(`Failed to read preferredLanguage for ${email}:`, langError);
        }
      }

      await sendJobAlertWelcomeEmail(email, {
        query: normalizedQuery,
        unsubscribeUrl,
        signInUrl,
        locale: welcomeLocale,
        frequency,
      });
    } catch (emailError) {
      console.error(`Failed to send job alert welcome email to ${email}:`, emailError);
      // Don't fail the subscription if the welcome email fails to send.
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error creating job alert subscription:", error);
    return res.status(500).json({
      error: "Failed to create job alert subscription",
      details: error.message,
    });
  }
});

/**
 * GET /alerts/unsubscribe?token=...
 * Public — no auth required. Flips the matching subscription to inactive
 * and returns a tiny standalone HTML confirmation page (this link is opened
 * directly from an email, never from within the app).
 */
router.get("/unsubscribe", async (req: Request, res: Response) => {
  const siteUrl = frontendUrl();
  const renderPage = (message: string) => `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Tail'ed Community — Job alerts</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FFF9F0; margin: 0; padding: 0; }
          .card { max-width: 480px; margin: 10vh auto; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 40px 32px; text-align: center; }
          h1 { color: #EB7A24; font-size: 22px; margin: 0 0 12px; }
          p { color: #444; font-size: 15px; line-height: 1.5; }
          a { color: #EB7A24; text-decoration: none; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Tail'ed Community job alerts</h1>
          <p>${message}</p>
          <p><a href="${siteUrl}">Back to tailed.ca</a></p>
        </div>
      </body>
    </html>
  `;

  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) {
      return res.status(400).send(renderPage("This unsubscribe link is missing its token."));
    }

    const matchQuery = await db
      .collection("jobAlertSubscriptions")
      .where("unsubscribeToken", "==", token)
      .limit(1)
      .get();

    if (matchQuery.empty) {
      return res
        .status(404)
        .send(renderPage("We couldn't find that subscription — it may already be unsubscribed."));
    }

    const doc = matchQuery.docs[0];
    await doc.ref.update({ active: false, updatedAt: new Date() });

    console.log("alert_unsubscribed", { subscriptionId: doc.id, email: doc.data().email });

    return res
      .status(200)
      .send(renderPage("You're unsubscribed — resubscribe any time on tailed.ca."));
  } catch (error: any) {
    console.error("Error unsubscribing job alert:", error);
    return res.status(500).send(renderPage("Something went wrong. Please try again later."));
  }
});

/**
 * GET /alerts/mine
 * Authenticated. Lists the current user's alerts — matched by email (reliable)
 * unioned with any rows carrying this uid whose email differs (dedup by id).
 * All active states are included. Each summary carries a `lastBatch` derived
 * from the newest `digestRuns` doc (1 read each — fine at ≤5 alerts/email).
 * Sorted by createdAt desc.
 */
router.get("/mine", async (req: Request, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const email = req.user?.email;
    const subscriptionsRef = db.collection(ALERTS_COLLECTION);

    // Union: alerts owned by email + alerts carrying this uid. Dedup by doc id.
    const [byEmailSnap, byUidSnap] = await Promise.all([
      email
        ? subscriptionsRef.where("email", "==", email).get()
        : Promise.resolve(null),
      subscriptionsRef.where("userId", "==", uid).get(),
    ]);

    const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    byEmailSnap?.docs.forEach((doc) => docsById.set(doc.id, doc));
    byUidSnap.docs.forEach((doc) => docsById.set(doc.id, doc));

    const summaries = await Promise.all(
      Array.from(docsById.values()).map(async (doc) => {
        const data = doc.data();
        const runSnap = await doc.ref
          .collection(DIGEST_RUNS_COLLECTION)
          .orderBy("sentAt", "desc")
          .limit(1)
          .get();
        let lastBatch: { sentAt: string | null; jobCount: number } | null = null;
        if (!runSnap.empty) {
          const runData = runSnap.docs[0].data();
          lastBatch = {
            sentAt: toIso(runData.sentAt),
            jobCount: typeof runData.jobCount === "number" ? runData.jobCount : 0,
          };
        }
        return { summary: buildAlertSummary(doc.id, data, lastBatch), createdAt: data.createdAt };
      })
    );

    // Sort by createdAt desc (serialized ISO strings sort chronologically).
    summaries.sort((a, b) => {
      const aTs = toIso(a.createdAt) ?? "";
      const bTs = toIso(b.createdAt) ?? "";
      return bTs.localeCompare(aTs);
    });

    return res.status(200).json(summaries.map((s) => s.summary));
  } catch (error: any) {
    console.error("Error listing job alerts:", error);
    return res.status(500).json({
      error: "Failed to list job alerts",
      details: error.message,
    });
  }
});

/**
 * GET /alerts/:id
 * Authenticated + ownership. Returns the full alert plus its most recent
 * batches (`digestRuns` ordered sentAt desc, limit 20).
 */
router.get("/:id", async (req: Request, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const owned = await loadOwnedAlert(req.params.id, { uid, email: req.user?.email });
    if (!owned) {
      return res.status(404).json({ error: "Alert not found" });
    }

    const runsSnap = await owned.ref
      .collection(DIGEST_RUNS_COLLECTION)
      .orderBy("sentAt", "desc")
      .limit(20)
      .get();
    const runs = runsSnap.docs.map(buildDigestRun);

    return res.status(200).json({
      alert: buildFullAlert(req.params.id, owned.data),
      runs,
    });
  } catch (error: any) {
    console.error("Error loading job alert:", error);
    return res.status(500).json({
      error: "Failed to load job alert",
      details: error.message,
    });
  }
});

const patchAlertSchema = z.object({
  query: z.string().trim().max(200).optional().nullable(),
  locations: z.array(z.string().trim().max(100)).max(10).optional().nullable(),
  jobType: z.enum(["internship", "new-grad"]).optional().nullable(),
  frequency: z.enum(["daily", "weekly"]).optional(),
  active: z.boolean().optional(),
});

/**
 * PATCH /alerts/:id
 * Authenticated + ownership. Partial update of the editable fields. Criteria
 * fields (query/locations/jobType) run through the shared normalization; only
 * provided fields are written, alongside a fresh `updatedAt`.
 */
router.patch("/:id", async (req: Request, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const validationResult = patchAlertSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }

    const owned = await loadOwnedAlert(req.params.id, { uid, email: req.user?.email });
    if (!owned) {
      return res.status(404).json({ error: "Alert not found" });
    }

    const body = validationResult.data;
    // Only the criteria keys actually present are returned by the normalizer.
    const update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      ...normalizeAlertFields(body),
      updatedAt: new Date(),
    };
    if ("frequency" in body) update.frequency = body.frequency;
    if ("active" in body) update.active = body.active;

    await owned.ref.update(update);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error updating job alert:", error);
    return res.status(500).json({
      error: "Failed to update job alert",
      details: error.message,
    });
  }
});

/**
 * DELETE /alerts/:id
 * Authenticated + ownership. Recursively deletes the `digestRuns` subcollection,
 * then the alert doc.
 */
router.delete("/:id", async (req: Request, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const owned = await loadOwnedAlert(req.params.id, { uid, email: req.user?.email });
    if (!owned) {
      return res.status(404).json({ error: "Alert not found" });
    }

    await deleteDigestRuns(owned.ref);
    await owned.ref.delete();

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error deleting job alert:", error);
    return res.status(500).json({
      error: "Failed to delete job alert",
      details: error.message,
    });
  }
});

export default router;
