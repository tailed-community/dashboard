import { Router, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../lib/firebase";
import { sendJobAlertWelcomeEmail } from "../lib/email-service";
import { buildUnsubscribeUrl } from "../lib/links";

const router = Router();

const MAX_SUBSCRIPTIONS_PER_EMAIL = 5;

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
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
});

/**
 * POST /alerts/subscribe
 * Public — no auth required. Creates (or, on duplicate, updates) a job-alert
 * subscription. Always responds { success: true } on valid input; never
 * blocks the caller's underlying action (search/save/RSVP/etc).
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

    const { email, source, query, locations, jobType } = validationResult.data;
    const normalizedQuery = query && query.length > 0 ? query : null;
    const normalizedLocations = locations && locations.length > 0 ? locations : null;
    const normalizedJobType = jobType || null;
    const userId = req.user?.uid || null;

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
      frequency: "daily",
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
      await sendJobAlertWelcomeEmail(email, normalizedQuery, unsubscribeUrl);
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
  const frontendUrl = process.env.FRONTEND_URL || "https://community.tailed.ca";
  const renderPage = (message: string) => `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Tail'ed — Job alerts</title>
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
          <h1>Tail'ed job alerts</h1>
          <p>${message}</p>
          <p><a href="${frontendUrl}">Back to tailed.ca</a></p>
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

export default router;
