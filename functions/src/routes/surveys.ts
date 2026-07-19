import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../lib/firebase";

/**
 * Survey endpoints (spec 08 §3.3, §4.9, §6.1).
 *
 * ─── ANONYMITY IS LOAD-BEARING ─────────────────────────────────────────────
 * The self-identification survey is the highest legal/trust-risk surface in the
 * onboarding program. Its submit path performs **two deliberately independent
 * writes with NO shared identifier persisted between them**:
 *
 *   1. `demographicResponses/{randomUUID}` — the answers. Its doc id is a random
 *      UUID that is NOT derived from the uid. The doc contains ONLY the survey
 *      answers plus a coarsened `submittedMonth` ("YYYY-MM"). It carries **no**
 *      userId / email / IP / session / auth-uid / full timestamp / createdBy —
 *      nothing that could re-identify the respondent or correlate the row with
 *      auth logs.
 *   2. `profiles/{uid}.demographicSurveyCompletedAt` — a server timestamp that is
 *      the ONLY record that this uid completed the survey. It holds NO answers.
 *
 * There is intentionally **no edit and no delete** endpoint for
 * `demographicResponses`: a truly anonymous response cannot be located to be
 * edited or deleted, and that immutability is exactly what protects anonymity
 * (disclosed honestly in the consent copy). Firestore stays admin-only
 * (`firestore.rules` deny-all); the frontend never touches these collections
 * directly — writes go through this API, as with alerts (spec 06).
 *
 * Do NOT add logging of the request body, IP, or uid alongside the response
 * write, and do NOT introduce any field that carries the uid into the response
 * doc. Doing so would defeat the decoupling this whole slice exists to provide.
 */

const router = Router();

const DEMOGRAPHIC_RESPONSES_COLLECTION = "demographicResponses";
const PROFILES_COLLECTION = "profiles";

/**
 * Zod schema for the self-ID submission body. Mirrors spec §4.9
 * `DemographicResponse` EXACTLY, and every option set is constrained to §6.1.
 * Every field is optional and every field is "prefer-not-to-say"-capable, so a
 * respondent may skip anything. Free-text fields are length-capped. Note there
 * is deliberately NO `submittedMonth` here — the client never supplies a
 * timestamp; the server computes the coarsened "YYYY-MM" itself.
 */
const selfIdSchema = z.object({
  gender: z.enum(["man", "woman", "self-described", "prefer-not-to-say"]).optional(),
  genderSelfDescribed: z.string().trim().max(120).optional(),
  transStatus: z.enum(["yes", "no", "prefer-not-to-say"]).optional(),
  indigenousIdentity: z
    .array(
      z.enum([
        "first-nations",
        "metis",
        "inuit",
        "not-indigenous",
        "prefer-not-to-say",
      ])
    )
    .max(5)
    .optional(),
  populationGroups: z
    .array(
      z.enum([
        "white",
        "south-asian",
        "chinese",
        "black",
        "filipino",
        "arab",
        "latin-american",
        "southeast-asian",
        "west-asian",
        "korean",
        "japanese",
        "other",
        "prefer-not-to-say",
      ])
    )
    .max(13)
    .optional(),
  populationGroupOther: z.string().trim().max(120).optional(),
  disability: z.enum(["yes", "no", "prefer-not-to-say"]).optional(),
  firstGeneration: z.enum(["yes", "no", "prefer-not-to-say"]).optional(),
  newcomerStatus: z
    .enum(["born-in-canada", "immigrant", "temporary-resident", "prefer-not-to-say"])
    .optional(),
  ageBand: z
    .enum(["under-18", "18-20", "21-24", "25-29", "30-plus", "prefer-not-to-say"])
    .optional(),
  region: z.string().trim().max(80).optional(),
});

/** Full province/territory option set for Q9 validation (region is province/territory only, never campus). */
const VALID_REGIONS = new Set([
  "alberta",
  "british-columbia",
  "manitoba",
  "new-brunswick",
  "newfoundland-and-labrador",
  "northwest-territories",
  "nova-scotia",
  "nunavut",
  "ontario",
  "prince-edward-island",
  "quebec",
  "saskatchewan",
  "yukon",
  "prefer-not-to-say",
]);

/**
 * Normalize a profile's stored `preferredLanguage` to exactly "en" | "fr",
 * defaulting to "en". This drives the language of the in-app survey copy (the
 * page reads it from the survey GET response). Mirrors the client-side
 * `getPreferredLanguage` default so the rule lives consistently on both sides.
 */
function preferredLanguageOf(data: unknown): "en" | "fr" {
  return (data as { preferredLanguage?: unknown } | undefined)
    ?.preferredLanguage === "fr"
    ? "fr"
    : "en";
}

/** Server-computed coarsened month string, "YYYY-MM" only. Never a full timestamp. */
function currentMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * GET /surveys/self-id/status
 * Authenticated. Reports ONLY whether this uid has completed the self-ID survey,
 * read from the profile flag (never by querying `demographicResponses`). Returns
 * no answers. Drives the "already completed → show closed state" branch on the
 * survey page so the survey can't be retaken.
 */
router.get("/self-id/status", async (req: Request, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const profileSnap = await db.collection(PROFILES_COLLECTION).doc(uid).get();
    const completed = !!profileSnap.data()?.demographicSurveyCompletedAt;
    // Communication-language preference so the survey page can render its copy
    // in the student's language (defaults to "en"). Carries no answers.
    const preferredLanguage = preferredLanguageOf(profileSnap.data());
    return res.status(200).json({ completed, preferredLanguage });
  } catch (error: any) {
    console.error("Error reading self-ID survey status:", error);
    return res.status(500).json({ error: "Failed to read survey status" });
  }
});

/**
 * POST /surveys/self-id
 * Authenticated (we need the uid to set the one-time completion flag), but the
 * uid is used ONLY to (a) enforce one-time submission via the profile flag and
 * (b) flip that flag. It is NEVER written into the response doc.
 *
 * Append-only: writes one `demographicResponses/{randomUUID}` doc and flips
 * `profiles/{uid}.demographicSurveyCompletedAt`, as two independent writes with
 * no shared identifier between them. There is no update/delete path.
 */
router.post("/self-id", async (req: Request, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const validationResult = selfIdSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }
    const answers = validationResult.data;

    // Region is validated against the full province/territory set (never a
    // campus / free-text location). Reject anything outside it.
    if (answers.region !== undefined && !VALID_REGIONS.has(answers.region)) {
      return res.status(400).json({ error: "Invalid region" });
    }

    // ── One-time enforcement via the profile flag ONLY (never by querying the
    // decoupled responses). If already set, the survey cannot be retaken. ──
    const profileRef = db.collection(PROFILES_COLLECTION).doc(uid);
    const profileSnap = await profileRef.get();
    if (profileSnap.data()?.demographicSurveyCompletedAt) {
      return res.status(409).json({ error: "Survey already completed" });
    }

    // ── Build the response doc EXPLICITLY, field by field, from validated
    // answers only. This is the single source of what lands in
    // `demographicResponses`. Anything not appended here cannot leak in.
    //
    // The ONLY non-answer field is `submittedMonth` — a server-computed,
    // month-level "YYYY-MM" string (never a full timestamp/Timestamp). There is
    // deliberately NO userId, email, IP, session id, auth uid, createdBy, or
    // full timestamp on this doc. Age is stored as a band and region as a
    // province/territory only (already enforced by the schema above). ──
    const responseDoc: Record<string, unknown> = {
      submittedMonth: currentMonth(),
    };
    if (answers.gender !== undefined) responseDoc.gender = answers.gender;
    // Free-text write-in only kept when the user actually chose "self-described".
    if (answers.gender === "self-described" && answers.genderSelfDescribed) {
      responseDoc.genderSelfDescribed = answers.genderSelfDescribed;
    }
    if (answers.transStatus !== undefined) responseDoc.transStatus = answers.transStatus;
    if (answers.indigenousIdentity !== undefined && answers.indigenousIdentity.length > 0) {
      responseDoc.indigenousIdentity = answers.indigenousIdentity;
    }
    if (answers.populationGroups !== undefined && answers.populationGroups.length > 0) {
      responseDoc.populationGroups = answers.populationGroups;
    }
    // "Other — please specify" free text only kept when "other" was selected.
    if (
      answers.populationGroups?.includes("other") &&
      answers.populationGroupOther
    ) {
      responseDoc.populationGroupOther = answers.populationGroupOther;
    }
    if (answers.disability !== undefined) responseDoc.disability = answers.disability;
    if (answers.firstGeneration !== undefined) responseDoc.firstGeneration = answers.firstGeneration;
    if (answers.newcomerStatus !== undefined) responseDoc.newcomerStatus = answers.newcomerStatus;
    if (answers.ageBand !== undefined) responseDoc.ageBand = answers.ageBand;
    if (answers.region !== undefined) responseDoc.region = answers.region;

    // ── Write 1: the answers, keyed by a RANDOM uuid (NOT derived from uid). ──
    const randomId = randomUUID();
    await db
      .collection(DEMOGRAPHIC_RESPONSES_COLLECTION)
      .doc(randomId)
      .set(responseDoc);

    // ── Write 2: the completion flag on the profile — a SEPARATE, independent
    // write. It records only that this uid is done; it holds NO answers and no
    // reference to `randomId`. No mapping between the two is ever persisted. ──
    await profileRef.set(
      { demographicSurveyCompletedAt: new Date() },
      { merge: true }
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    // Deliberately do NOT log the request body / uid / IP here — only a generic
    // message — so nothing that could re-link an answer to a person is emitted.
    console.error("Error submitting self-ID survey");
    return res.status(500).json({ error: "Failed to submit survey" });
  }
});

/**
 * ─── WORKPLACE-VALUES SURVEY (spec 08 §3.4, §4.6, §6.2) ─────────────────────
 * The DELIBERATE OPPOSITE of the self-ID survey above: this one is **linked to
 * the profile and re-editable** — NOT anonymous, NOT immutable. It is stored on
 * `profiles/{uid}.workplaceValues` (uid-associated by design; that is correct
 * here), and re-submitting simply overwrites via a merge write and bumps
 * `updatedAt`. There is a GET so the form can prefill for re-editing. No
 * decoupling, no random-id collection, no one-time gate.
 */

/** The 10 workplace-value dimension keys (spec §4.6 / §6.2). Order is canonical. */
const VALUE_DIMENSIONS = [
  "careerDevelopment",
  "compensation",
  "workLifeBalance",
  "jobSecurity",
  "missionPurpose",
  "dei",
  "culturePeople",
  "prestige",
  "meaningfulWork",
  "wellbeingSupport",
] as const;

const VALID_DIMENSIONS = new Set<string>(VALUE_DIMENSIONS);

/** Each Likert rating must be an integer 1–5. */
const likert = z.number().int().min(1).max(5);

const dimensionKeyEnum = z.enum(VALUE_DIMENSIONS);

/**
 * Zod schema for the workplace-values submission. Mirrors spec §4.6 exactly:
 * all 10 dimensions present and 1–5; `topThree` is EXACTLY 3 valid, unique,
 * ordered dimension keys. `updatedAt` is server-stamped, never client-supplied.
 */
const workplaceValuesSchema = z.object({
  perDimension: z.object({
    careerDevelopment: likert,
    compensation: likert,
    workLifeBalance: likert,
    jobSecurity: likert,
    missionPurpose: likert,
    dei: likert,
    culturePeople: likert,
    prestige: likert,
    meaningfulWork: likert,
    wellbeingSupport: likert,
  }),
  topThree: z
    .array(dimensionKeyEnum)
    .length(3)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "topThree must contain no duplicates",
    }),
});

/**
 * GET /surveys/values
 * Authenticated. Returns the user's current `workplaceValues` (or null) so the
 * form can PREFILL for re-editing. Linked to the profile by design.
 */
router.get("/values", async (req: Request, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const profileSnap = await db.collection(PROFILES_COLLECTION).doc(uid).get();
    const workplaceValues = profileSnap.data()?.workplaceValues ?? null;
    // Communication-language preference so the survey page can render its copy
    // in the student's language (defaults to "en").
    const preferredLanguage = preferredLanguageOf(profileSnap.data());
    return res.status(200).json({ workplaceValues, preferredLanguage });
  } catch (error: any) {
    console.error("Error reading workplace values:", error);
    return res.status(500).json({ error: "Failed to read workplace values" });
  }
});

/**
 * POST /surveys/values
 * Authenticated. Validates and UPSERTS `profiles/{uid}.workplaceValues`
 * (merge write). Re-editable: re-submitting overwrites and bumps `updatedAt`.
 */
router.post("/values", async (req: Request, res: Response) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const validationResult = workplaceValuesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.errors,
      });
    }
    const { perDimension, topThree } = validationResult.data;

    // Defensive re-check of topThree keys against the canonical set (the enum
    // already guarantees this, but keep the rule explicit and self-documenting).
    if (!topThree.every((key) => VALID_DIMENSIONS.has(key))) {
      return res.status(400).json({ error: "Invalid dimension key in topThree" });
    }

    const profileRef = db.collection(PROFILES_COLLECTION).doc(uid);
    await profileRef.set(
      {
        workplaceValues: {
          perDimension,
          topThree,
          updatedAt: new Date(),
        },
      },
      { merge: true }
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error submitting workplace values:", error);
    return res.status(500).json({ error: "Failed to submit workplace values" });
  }
});

export default router;
