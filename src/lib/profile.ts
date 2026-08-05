import { apiFetch } from "./fetch";
import type { GithubProfile } from "./github";
import type { DevpostProfile } from "@/pages/(dashboard)/jobs/[slug]/apply/types";

/**
 * Shared student-profile shape (spec 08 §4.8).
 *
 * Extracted from the inline `StudentProps` that used to live in
 * `src/pages/(dashboard)/account/account-new.tsx` so the account page, the
 * onboarding card, the (future) CV builder, and any drip-facing code all read
 * one canonical shape. Field names mirror the `profiles/{uid}` Firestore doc so
 * the client ⇄ API stays 1:1.
 *
 * NOTE: this is the *client* shape. The Express API serializes Firestore
 * `Timestamp`s to ISO strings (or the legacy `{_seconds,_nanoseconds}` object
 * for the resume upload date) before sending them over the wire, so timestamp
 * fields are typed as `string` here rather than `Timestamp`.
 */

/** A single work / internship / co-op experience (spec 08 §4.1). */
export interface Experience {
  id: string;
  title: string;
  organization: string;
  employmentType?:
    | "internship"
    | "part-time"
    | "full-time"
    | "volunteer"
    | "co-op"
    | "other";
  location?: string;
  startDate?: string; // "YYYY-MM"
  endDate?: string | null; // "YYYY-MM" | null when current
  current?: boolean;
  description?: string;
  source?: "manual" | "resume-parse";
}

/** A single education entry (spec 08 §4.2). */
export interface Education {
  id: string;
  school: string;
  program: string;
  fieldOfStudy?: string;
  graduationYear?: string; // "2027"
  startYear?: string;
  current?: boolean;
  source?: "manual" | "resume-parse";
}

/** A first-class student project (spec 08 §4.3). */
export interface Project {
  id: string;
  name: string;
  description?: string;
  role?: string;
  url?: string; // repo / demo / devpost
  skills?: string[];
  startDate?: string; // "YYYY-MM"
  endDate?: string | null;
  source?: "manual" | "resume-parse";
}

/** Structured skill entry — extends the flat `skills: string[]` (spec 08 §4.4). */
export interface SkillEntry {
  name: string;
  category?: "language" | "framework" | "tool" | "soft" | "other";
  level?: "beginner" | "intermediate" | "advanced";
}

/** Canadian work-authorization block — NOT anonymous, job-relevant (spec 08 §4.5). */
export interface WorkAuthorization {
  authorizedToWorkInCanada?: "yes" | "no" | "prefer-not-to-say";
  requiresSponsorshipNow?: boolean | null;
  requiresSponsorshipFuture?: boolean | null;
  status?:
    | "citizen"
    | "permanent-resident"
    | "study-permit"
    | "work-permit"
    | "other"
    | "prefer-not-to-say";
  updatedAt?: string; // ISO string on the client
}

/** Workplace-values survey submission — linked & re-editable (spec 08 §4.6). */
export interface WorkplaceValues {
  perDimension: {
    careerDevelopment: number;
    compensation: number;
    workLifeBalance: number;
    jobSecurity: number;
    missionPurpose: number;
    dei: number;
    culturePeople: number;
    prestige: number;
    meaningfulWork: number;
    wellbeingSupport: number;
  };
  topThree: string[]; // ordered dimension keys, exactly 3
  updatedAt?: string; // ISO string on the client
}

/**
 * Card-only persisted onboarding state (spec 08 §4.7 / §5). We keep *deriving*
 * item done-ness from real signals; the only things persisted here are what
 * cannot be derived: whether the card was dismissed and whether the completion
 * celebration was already shown.
 */
export interface OnboardingState {
  dismissedAt?: string; // ISO string — card stays hidden after dismiss
  celebratedAt?: string; // ISO string — completion celebration shown once
}

/** Behavior-driven email-drip state (spec 08 §4.7). */
export interface OnboardingEmails {
  sentSteps: string[];
  lastSentAt?: string;
  stopped?: boolean;
}

export type StudentProfile = {
  // --- Existing flat scalars (kept verbatim for back-compat) ---
  email: string;
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  location: string;
  school: string;
  program: string;
  graduationYear: string;
  devpostUsername: string;
  // `null` is meaningful for devpost/github: the PATCH /profile/update endpoint
  // turns an explicit `null` into FieldValue.delete() (a JSON.stringify'd
  // `undefined` key is dropped from the body and would NOT clear the field), so
  // disconnect flows must send `null`.
  devpost?: DevpostProfile | null;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUsername: string;
  github?: GithubProfile | null;
  skills: string[];
  resume: {
    id: string;
    name: string;
    url: string;
    uploadedAt: {
      _seconds: number;
      _nanoseconds: number;
    };
  };
  appliedJobs: [];
  organizations: string[];
  profileScore?: {
    score: number;
    completed: {
      devpost: boolean;
      devpostUsername: boolean;
      github: boolean;
      githubUsername: boolean;
      linkedinUrl: boolean;
      portfolioUrl: boolean;
      resume: boolean;
      skills: boolean;
    };
  };

  // --- Pillar-5 signals the onboarding card reads (existing profile fields) ---
  communities?: string[];
  events?: string[];

  // --- New structured data (spec 08 §4.1–4.6); all optional & non-blocking ---
  experiences?: Experience[];
  education?: Education[];
  projects?: Project[];
  skillsStructured?: SkillEntry[];
  workAuthorization?: WorkAuthorization;
  workplaceValues?: WorkplaceValues;

  // --- Onboarding + survey flags (spec 08 §4.7) ---
  demographicSurveyCompletedAt?: string; // ONLY "done" marker for pillar 3 — no answers
  onboardingState?: OnboardingState;
  onboardingEmails?: OnboardingEmails;

  // --- Communication language preference (spec 08 §5 "Language & localization") ---
  // Drives the language of ALL communications (in-app surveys/card + all emails)
  // via explicit reads. Browser-defaulted on first load, editable in Account
  // settings. Does NOT switch the global Paraglide UI locale.
  preferredLanguage?: "en" | "fr";
};

/**
 * Per-field completeness map returned by {@link calculateProfileScore}. Keys
 * mirror the checks the account page renders one-by-one, so both the account
 * page and the ambient profile menu read the exact same shape.
 */
export interface ProfileCompletion {
  firstName: boolean;
  lastName: boolean;
  school: boolean;
  program: boolean;
  graduationYear: boolean;
  location: boolean;
  githubUsername: boolean;
  github: boolean;
  devpostUsername: boolean;
  devpost: boolean;
  resume: boolean;
  skills: boolean;
  linkedinUrl: boolean;
  portfolioUrl: boolean;
}

/**
 * Profile completeness (0–100) plus the per-field breakdown.
 *
 * Lifted verbatim from the inline `calculateProfileScore` that used to live in
 * `src/pages/(dashboard)/account/account-new.tsx` so the account page, the
 * ambient profile menu, and the `useProfileSummary` hook all score identically.
 * Scoring behavior is unchanged: every field is an equal share of 100.
 */
export function calculateProfileScore(profileData: Partial<StudentProfile>): {
  score: number;
  completed: ProfileCompletion;
} {
  const checks: ProfileCompletion = {
    // Identity basics — collected progressively post-signup, never gated.
    firstName: !!profileData.firstName?.trim(),
    lastName: !!profileData.lastName?.trim(),
    school: !!profileData.school?.trim(),
    program: !!profileData.program?.trim(),
    graduationYear: !!String(profileData.graduationYear || "").trim(),
    location: !!profileData.location?.trim(),
    // Enrichment
    githubUsername: !!profileData.githubUsername?.trim(),
    github: !!(
      profileData.github && Object.keys(profileData.github).length > 0
    ),
    devpostUsername: !!profileData.devpostUsername?.trim(),
    devpost: !!(
      profileData.devpost && Object.keys(profileData.devpost).length > 0
    ),
    resume: !!profileData.resume?.url,
    skills: !!(
      profileData.skills &&
      Array.isArray(profileData.skills) &&
      profileData.skills.length > 0
    ),
    linkedinUrl: !!profileData.linkedinUrl?.trim(),
    portfolioUrl: !!profileData.portfolioUrl?.trim(),
  };

  const totalFields = Object.keys(checks).length;
  const completedCount = Object.values(checks).filter(Boolean).length;
  const score = Math.round((completedCount / totalFields) * 100);

  return { score, completed: checks };
}

/**
 * Resolve the best avatar image URL for a student, preferring their verified
 * GitHub avatar, then their auth provider photo, and finally an empty string
 * (which lets an `<AvatarFallback>` render initials instead). Pure — pass the
 * loaded profile and/or the firebase user; either may be null/undefined.
 */
export function resolveAvatarUrl(
  profile?: Partial<StudentProfile> | null,
  user?: { photoURL?: string | null } | null,
): string {
  return profile?.github?.avatarUrl || user?.photoURL || "";
}

/**
 * Load the signed-in user's profile → `GET /profile`. Mirrors the exact call
 * the account page uses (`apiService.getStudent`); factored out here so the
 * ambient profile hub (`useProfileSummary`) reuses one transport.
 */
export async function getMyProfile(): Promise<StudentProfile> {
  const response = await apiFetch("/profile");
  if (!response.ok) {
    throw new Error("Failed to fetch profile");
  }
  return await response.json();
}

/**
 * Read a profile's communication-language preference, defaulting to English.
 * The single source of truth for "which language do we communicate with this
 * student in" — later slices (surveys, email dispatch) import this so the
 * default rule lives in exactly one place.
 */
export function getPreferredLanguage(
  p?: { preferredLanguage?: string } | null,
): "en" | "fr" {
  return p?.preferredLanguage === "fr" ? "fr" : "en";
}

/**
 * Persist a partial `onboardingState` (dismiss / mark-celebrated) through the
 * existing profile write path (`PATCH /profile/update`, spec 08 §5). Reuses the
 * same transport as `apiService.updateStudent` rather than inventing a new one.
 *
 * The server stamps its own timestamps; we send an ISO string as the intent
 * signal and `null` to clear a flag.
 */
export async function updateOnboardingState(partial: {
  dismissedAt?: string | null;
  celebratedAt?: string | null;
}): Promise<void> {
  const response = await apiFetch("/profile/update", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ onboardingState: partial }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || "Failed to update onboarding state");
  }
}

/**
 * The only profile fields a client may write through `PATCH /profile/update`.
 *
 * Mirrors the server's allowlist (`profileUpdateSchema` in
 * `functions/src/routes/profile.ts`) — the server is the enforcing side; this is
 * here so we never *send* a field the server would drop. Deliberately absent:
 *
 *  - `email`   — server-owned, reconciled from the Firebase Auth record.
 *  - `id` / `userId` / `profileScore` / `initials` — derived or identity fields.
 *  - `resume`  — written only by the resume upload/delete endpoints.
 *  - `appliedJobs` / `communities` / `events` / `organizations` — membership,
 *    owned by the flows that grant it.
 *  - `workplaceValues` / `demographicSurveyCompletedAt` — written by the survey
 *    routes, which score and stamp them server-side.
 */
export const WRITABLE_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "phone",
  "location",
  "school",
  "program",
  "graduationYear",
  "linkedinUrl",
  "portfolioUrl",
  "devpostUsername",
  "devpost",
  "githubUsername",
  "github",
  "skills",
  "skillsStructured",
  "experiences",
  "education",
  "projects",
  "workAuthorization",
  "preferredLanguage",
  "onboardingState",
] as const satisfies readonly (keyof StudentProfile)[];

export type WritableProfileField = (typeof WRITABLE_PROFILE_FIELDS)[number];

/**
 * Narrow a full profile object down to the writable slice.
 *
 * The account page used to `JSON.stringify` its entire `student` state into the
 * PATCH body. That is how a stale in-memory `email` ended up written onto a
 * different account's profile doc after a mid-session account switch: the body
 * carried an email the signed-in user didn't own. Sending only the fields the
 * page actually edits removes the whole class of problem.
 *
 * Keys absent from `profile` stay absent (so we never send `undefined` and
 * accidentally trip the server's null → FieldValue.delete() path); explicit
 * `null` is preserved, because github/devpost disconnect relies on it.
 */
export function pickWritableProfileFields(
  profile: Partial<StudentProfile>,
): Partial<StudentProfile> {
  const slice: Record<string, unknown> = {};
  for (const key of WRITABLE_PROFILE_FIELDS) {
    if (key in profile && profile[key] !== undefined) {
      slice[key] = profile[key];
    }
  }
  return slice as Partial<StudentProfile>;
}

/**
 * Persist a partial slice of the structured profile (CV / profile-builder
 * sections — `experiences`, `education`, `projects`, `skillsStructured`,
 * `workAuthorization`) through the same `PATCH /profile/update` transport used by
 * `apiService.updateStudent` (spec 08 §3.1 / §4). Each builder section saves only
 * its own field(s) so a section save never regresses the required-set scalars or
 * the existing resume/skills UI. The server validates every field, trims strings,
 * generates/preserves `id`s, mirrors skill names into the flat `skills[]`, and
 * stamps its own `updatedAt` — so we only send the intent here.
 */
export async function updateProfileFields(
  partial: Partial<StudentProfile>,
): Promise<void> {
  const response = await apiFetch("/profile/update", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pickWritableProfileFields(partial)),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || "Failed to update profile");
  }
}
