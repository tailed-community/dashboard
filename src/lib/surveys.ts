import { apiFetch } from "./fetch";
import type { WorkplaceValues } from "./profile";

/**
 * Client API for the anonymous self-identification survey (spec 08 §3.3, §6.1).
 *
 * The request payload deliberately carries **no identifier** — no uid, email, or
 * timestamp. The backend derives the uid from the auth header solely to enforce
 * one-time submission and flip the profile completion flag; the answers are
 * written to a decoupled `demographicResponses/{randomUUID}` doc that is never
 * linked back to the person (see `functions/src/routes/surveys.ts`).
 */

/**
 * Self-ID answers, mirroring the server `DemographicResponse` option sets
 * (spec 08 §4.9 / §6.1) MINUS any identifier or timestamp. Every field is
 * optional and every field is "prefer-not-to-say"-capable, so any question can
 * be skipped.
 */
export interface SelfIdSubmission {
  gender?: "man" | "woman" | "self-described" | "prefer-not-to-say";
  genderSelfDescribed?: string;
  transStatus?: "yes" | "no" | "prefer-not-to-say";
  indigenousIdentity?: Array<
    "first-nations" | "metis" | "inuit" | "not-indigenous" | "prefer-not-to-say"
  >;
  populationGroups?: Array<
    | "white"
    | "south-asian"
    | "chinese"
    | "black"
    | "filipino"
    | "arab"
    | "latin-american"
    | "southeast-asian"
    | "west-asian"
    | "korean"
    | "japanese"
    | "other"
    | "prefer-not-to-say"
  >;
  populationGroupOther?: string;
  disability?: "yes" | "no" | "prefer-not-to-say";
  firstGeneration?: "yes" | "no" | "prefer-not-to-say";
  newcomerStatus?:
    | "born-in-canada"
    | "immigrant"
    | "temporary-resident"
    | "prefer-not-to-say";
  ageBand?: "under-18" | "18-20" | "21-24" | "25-29" | "30-plus" | "prefer-not-to-say";
  region?: string;
}

/**
 * Whether the signed-in user has already completed the self-ID survey.
 * Read from the profile flag ONLY (never from the responses) → `GET
 * /surveys/self-id/status`.
 */
export async function getSelfIdStatus(): Promise<{
  completed: boolean;
  /** Communication-language preference so the page can render bilingual copy. */
  preferredLanguage: "en" | "fr";
}> {
  const response = await apiFetch("/surveys/self-id/status");

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load survey status");
  }

  const data = await response.json();
  return {
    completed: !!data?.completed,
    preferredLanguage: data?.preferredLanguage === "fr" ? "fr" : "en",
  };
}

/**
 * Submit the anonymous self-ID survey → `POST /surveys/self-id`. On success the
 * server has written one decoupled response doc and flipped the profile
 * completion flag. A 409 means the survey was already completed (it can't be
 * retaken).
 */
export async function submitSelfIdSurvey(
  submission: SelfIdSubmission,
): Promise<void> {
  const response = await apiFetch("/surveys/self-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to submit survey");
  }
}

/**
 * Client API for the workplace-values survey (spec 08 §3.4, §4.6, §6.2).
 *
 * The DELIBERATE OPPOSITE of the self-ID survey above: this one is **linked to
 * the profile and re-editable** — NOT anonymous, NOT immutable. It round-trips
 * through `profiles/{uid}.workplaceValues`, so we send/receive the shared
 * `WorkplaceValues` shape from `./profile` (no local redefinition).
 */

/** The submission payload — the shared `WorkplaceValues` minus the server-stamped `updatedAt`. */
export type WorkplaceValuesSubmission = Omit<WorkplaceValues, "updatedAt">;

/**
 * Load the signed-in user's current workplace values (or null) so the form can
 * PREFILL for re-editing → `GET /surveys/values`.
 */
export async function getWorkplaceValues(): Promise<{
  workplaceValues: WorkplaceValues | null;
  /** Communication-language preference so the page can render bilingual copy. */
  preferredLanguage: "en" | "fr";
}> {
  const response = await apiFetch("/surveys/values");

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to load workplace values");
  }

  const data = await response.json();
  return {
    workplaceValues: (data?.workplaceValues ?? null) as WorkplaceValues | null,
    preferredLanguage: data?.preferredLanguage === "fr" ? "fr" : "en",
  };
}

/**
 * Submit / update the workplace-values survey → `POST /surveys/values`. This is
 * re-editable: re-submitting overwrites the stored values and bumps `updatedAt`
 * server-side.
 */
export async function submitWorkplaceValues(
  submission: WorkplaceValuesSubmission,
): Promise<void> {
  const response = await apiFetch("/surveys/values", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Failed to submit workplace values");
  }
}
