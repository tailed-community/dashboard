import { apiFetch } from "./fetch";
import type { Experience, Education, Project, SkillEntry } from "./profile";

/**
 * Client transport for LLM-based resume parsing (spec 08 Open-Q1).
 *
 * `parseResume()` POSTs to `POST /profile/parse-resume` (which reads the user's
 * already-uploaded resume from Storage and calls Claude server-side) and returns
 * structured SUGGESTIONS. Nothing is saved by this call — the user confirms and
 * merges the suggestions into their profile on the client, which then persists
 * via `updateProfileFields` (`PATCH /profile/update`).
 *
 * Mirrors the transport/auth of the other profile API helpers in
 * `src/lib/profile.ts` (`apiFetch` attaches the auth token).
 */

export interface ParsedResume {
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  skills: SkillEntry[];
}

export type ResumeParseErrorCode = "unavailable" | "no_resume" | "failed";

/** Typed error so the UI can degrade gracefully (esp. the no-key / dev case). */
export class ResumeParseError extends Error {
  code: ResumeParseErrorCode;
  constructor(code: ResumeParseErrorCode, message: string) {
    super(message);
    this.name = "ResumeParseError";
    this.code = code;
  }
}

const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

export async function parseResume(): Promise<ParsedResume> {
  const response = await apiFetch("/profile/parse-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as any);
    // 501/503 → parsing not configured (dev / no ANTHROPIC_API_KEY).
    // 400 → the user has no uploaded resume to parse.
    let code: ResumeParseErrorCode = "failed";
    if (response.status === 503 || response.status === 501) {
      code = "unavailable";
    } else if (response.status === 400) {
      code = "no_resume";
    }
    throw new ResumeParseError(
      code,
      body?.message || "We couldn't read your resume automatically.",
    );
  }

  const data = await response.json().catch(() => ({}) as any);
  return {
    experiences: asArray<Experience>(data.experiences),
    education: asArray<Education>(data.education),
    projects: asArray<Project>(data.projects),
    skills: asArray<SkillEntry>(data.skills),
  };
}

/** True when the parse returned no usable items across every section. */
export function isEmptyParse(parsed: ParsedResume): boolean {
  return (
    parsed.experiences.length === 0 &&
    parsed.education.length === 0 &&
    parsed.projects.length === 0 &&
    parsed.skills.length === 0
  );
}
