/**
 * Shared option lists + tiny helpers for the CV / profile-builder editors
 * (spec 08 §3.1, data models §4.1–4.5). Hardcoded EN labels for now — FR is a
 * flagged follow-up (spec 08 §5 / §8), matching the onboarding card and prior
 * slices. Enum *values* here mirror the shared `StudentProfile` types in
 * `src/lib/profile.ts` and the backend validators in
 * `functions/src/routes/profile.ts` so the client ⇄ API stays 1:1.
 */

import type {
  Experience,
  Education,
  Project,
  SkillEntry,
  WorkAuthorization,
} from "@/lib/profile";

/** Browser-safe uuid with a fallback for older runtimes. */
export function makeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const EMPLOYMENT_TYPE_OPTIONS: {
  value: NonNullable<Experience["employmentType"]>;
  label: string;
}[] = [
  { value: "internship", label: "Internship" },
  { value: "co-op", label: "Co-op" },
  { value: "part-time", label: "Part-time" },
  { value: "full-time", label: "Full-time" },
  { value: "volunteer", label: "Volunteer" },
  { value: "other", label: "Other" },
];

export const SKILL_CATEGORY_OPTIONS: {
  value: NonNullable<SkillEntry["category"]>;
  label: string;
}[] = [
  { value: "language", label: "Language" },
  { value: "framework", label: "Framework" },
  { value: "tool", label: "Tool" },
  { value: "soft", label: "Soft skill" },
  { value: "other", label: "Other" },
];

export const SKILL_LEVEL_OPTIONS: {
  value: NonNullable<SkillEntry["level"]>;
  label: string;
}[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export const WORK_AUTH_ANSWER_OPTIONS: {
  value: NonNullable<WorkAuthorization["authorizedToWorkInCanada"]>;
  label: string;
}[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "prefer-not-to-say", label: "Prefer not to answer" },
];

export const WORK_AUTH_STATUS_OPTIONS: {
  value: NonNullable<WorkAuthorization["status"]>;
  label: string;
}[] = [
  { value: "citizen", label: "Canadian citizen" },
  { value: "permanent-resident", label: "Permanent resident" },
  { value: "study-permit", label: "Study permit" },
  { value: "work-permit", label: "Work permit" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to answer" },
];

/** Sponsorship tri-state (yes / no / prefer-not) → boolean | null on the wire. */
export const SPONSORSHIP_OPTIONS: { value: string; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Prefer not to answer" },
];

export function sponsorshipToWire(v: string): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

export function sponsorshipFromWire(v: boolean | null | undefined): string {
  if (v === true) return "yes";
  if (v === false) return "no";
  return "unknown";
}

/** Human-readable date range for read cards, e.g. "2024-06 – Present". */
export function formatRange(
  start?: string,
  end?: string | null,
  current?: boolean,
): string {
  const s = start?.trim() || "";
  if (current) return s ? `${s} – Present` : "Present";
  const e = end?.trim() || "";
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

export type { Experience, Education, Project, SkillEntry, WorkAuthorization };
