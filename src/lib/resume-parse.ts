import { apiFetch } from "./fetch";
import type { Experience, Education, Project, SkillEntry } from "./profile";

/**
 * Client transport for the resume upload → parse pipeline (spec 08 Open-Q1).
 *
 * `uploadResume()` PATCHes `/profile/main-resume` with the PDF (multipart
 * form data) and stores it in the student's profile. `parseResume()` POSTs to
 * `POST /profile/parse-resume`, which reads the user's already-uploaded
 * resume from Storage and runs a **deterministic, offline** text-extraction +
 * heuristics pass server-side (no LLM call, no network, no per-call cost) to
 * return structured SUGGESTIONS. Nothing is saved by that call — the user
 * confirms and merges the suggestions into their profile on the client,
 * which then persists via `updateProfileFields` (`PATCH /profile/update`).
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

export interface UploadedResume {
  id: string;
  name: string;
  url: string;
}

export type ResumeParseErrorCode = "no_resume" | "failed";

/** Typed error so the UI can degrade gracefully (esp. the no-resume case). */
export class ResumeParseError extends Error {
  code: ResumeParseErrorCode;
  constructor(code: ResumeParseErrorCode, message: string) {
    super(message);
    this.name = "ResumeParseError";
    this.code = code;
  }
}

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/**
 * Client-side validation + filename cleanup shared by every resume upload
 * entry point (the one-click quick-start pipeline and the manual "Skills &
 * Resume" widget). Mirrors the sanitization the backend also applies, so the
 * name shown to the user before upload matches what gets stored.
 */
export function prepareResumeFile(
  file: File,
): { file: File } | { error: string } {
  if (file.type !== "application/pdf") {
    return { error: "Please upload a PDF document." };
  }
  if (file.size > MAX_RESUME_BYTES) {
    return { error: "File size must be less than 5MB." };
  }

  const sanitizedFileName = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^A-Za-z\s]/g, "")
    .trim();

  if (sanitizedFileName.length === 0) {
    return { error: "File name must contain letters or spaces." };
  }

  const cleanFile = new File([file], `${sanitizedFileName}.pdf`, {
    type: file.type,
  });
  return { file: cleanFile };
}

/** Uploads a (pre-validated) PDF as the student's main resume. */
export async function uploadResume(file: File): Promise<UploadedResume> {
  const formData = new FormData();
  formData.append("resume", file);

  const response = await apiFetch("/profile/main-resume", {
    method: "PATCH",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("We couldn't upload your resume. Please try again.");
  }

  const data = await response.json().catch(() => ({}) as any);
  return data.resume as UploadedResume;
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
    // 400 → the user has no uploaded resume to parse. Anything else is a
    // parse-time failure (unreadable PDF, extraction error, etc).
    const code: ResumeParseErrorCode =
      response.status === 400 ? "no_resume" : "failed";
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
