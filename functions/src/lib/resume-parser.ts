import crypto from "crypto";
import { logger } from "firebase-functions";
// pdf-parse's package index (`require("pdf-parse")`) runs a debug file-read on
// import that throws in some environments, so we import the library entry
// directly. It has no bundled types; the loose Functions build tolerates that.
// eslint-disable-next-line @typescript-eslint/no-var-requires
import pdfParse = require("pdf-parse/lib/pdf-parse.js");

/**
 * Deterministic, offline resume parsing (spec 08 Open-Q1).
 *
 * Takes an already-uploaded resume PDF (as a Buffer), extracts its text with
 * `pdf-parse` (a local, no-network, no-per-call-cost library), and applies
 * rule-based heuristics to return structured SUGGESTIONS shaped like the app's
 * `Experience` / `Education` / `Project` / `SkillEntry` types (see
 * `src/lib/profile.ts` §4.1-4.4). This module NEVER writes to the profile — the
 * caller returns the suggestions to the client, which confirms/merges them
 * (`POST /profile/parse-resume` in `functions/src/routes/profile.ts`).
 *
 * Accuracy is best-effort: the confirm-and-review UI on the client is the safety
 * net for imperfect heuristics. There is NO external API dependency and NO
 * per-call cost — parsing is always available.
 */

export interface ResumeSuggestions {
  experiences: any[];
  education: any[];
  projects: any[];
  skills: any[];
}

// ---------------------------------------------------------------------------
// Small normalizers so merged suggestions pass the profile sanitizers.
// The backend PATCH /profile/update validators reject e.g. a non-`YYYY-MM`
// startDate, so we only ever emit validated values here.
// ---------------------------------------------------------------------------
const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** Format a parsed year/month into `YYYY-MM`, or undefined when no month. */
const toYearMonth = (d: { year: number; month?: number } | null): string | undefined => {
  if (!d || !d.month || d.month < 1 || d.month > 12) return undefined;
  return `${d.year}-${pad2(d.month)}`;
};

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------
const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/** Parse a single date token into a year (+ optional month). */
function parseDateToken(raw: string): { year: number; month?: number } | null {
  const s = raw.trim().toLowerCase();
  // "Jan 2023" / "January 2023"
  let m = s.match(/^([a-z]{3,9})\.?\s+(\d{4})$/);
  if (m && MONTHS[m[1]]) return { year: Number(m[2]), month: MONTHS[m[1]] };
  // "06/2020" / "6-2020" (MM/YYYY)
  m = s.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m) {
    const mo = Number(m[1]);
    return { year: Number(m[2]), month: mo >= 1 && mo <= 12 ? mo : undefined };
  }
  // "2020-06" / "2020/6" (YYYY-MM)
  m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) {
    const mo = Number(m[2]);
    return { year: Number(m[1]), month: mo >= 1 && mo <= 12 ? mo : undefined };
  }
  // bare "2020"
  m = s.match(/^(\d{4})$/);
  if (m) return { year: Number(m[1]) };
  return null;
}

// A single date token (month-year, mm/yyyy, yyyy-mm, or a bare year).
const DATE_TOKEN =
  String.raw`(?:[A-Za-z]{3,9}\.?\s+\d{4}|\d{1,2}[/-]\d{4}|\d{4}[-/]\d{1,2}|\d{4})`;
const PRESENT = String.raw`(?:present|current|ongoing|now|today|présent|actuel)`;
// A date RANGE: token -> (dash/to/…) -> token|present.
const RANGE_RE = new RegExp(
  String.raw`(${DATE_TOKEN})\s*(?:[-–—]|to|until|through|au?)\s*(${PRESENT}|${DATE_TOKEN})`,
  "i"
);
const PRESENT_RE = /present|current|ongoing|now|today|présent|actuel/i;

interface DateRange {
  start: { year: number; month?: number } | null;
  end: { year: number; month?: number } | null;
  current: boolean;
  remainder: string; // the line with the date range removed (header candidate)
}

/** Find a date range in a line; returns null when the line has none. */
function detectDateRange(line: string): DateRange | null {
  const m = line.match(RANGE_RE);
  if (!m || m.index === undefined) return null;
  const start = parseDateToken(m[1]);
  const endRaw = m[2];
  const current = PRESENT_RE.test(endRaw);
  const end = current ? null : parseDateToken(endRaw);
  const remainder = (line.slice(0, m.index) + " " + line.slice(m.index + m[0].length))
    .replace(/[|,•·\-–—]+\s*$/g, "")
    .replace(/^\s*[|,•·\-–—]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { start, end, current, remainder };
}

// ---------------------------------------------------------------------------
// Section segmentation
// ---------------------------------------------------------------------------
type SectionKey = "experience" | "education" | "projects" | "skills";

const HEADINGS: Record<SectionKey, string[]> = {
  experience: [
    "experience",
    "experiences",
    "work experience",
    "professional experience",
    "employment",
    "employment history",
    "work history",
    "relevant experience",
    "professional background",
  ],
  education: ["education", "academic background", "education & training", "academics"],
  projects: [
    "projects",
    "personal projects",
    "academic projects",
    "selected projects",
    "side projects",
    "notable projects",
  ],
  skills: [
    "skills",
    "technical skills",
    "technologies",
    "competencies",
    "core competencies",
    "skills & technologies",
    "technical proficiencies",
    "tools & technologies",
  ],
};

/** Returns the section a heading line introduces, or null if it isn't one. */
function matchHeading(line: string): SectionKey | null {
  const normalized = line.toLowerCase().replace(/[:\s]+$/g, "").trim();
  if (!normalized || normalized.length > 40) return null;
  for (const key of Object.keys(HEADINGS) as SectionKey[]) {
    if (HEADINGS[key].includes(normalized)) return key;
  }
  return null;
}

/** Split the whole doc into labeled sections (keeps blank lines within them). */
function segmentSections(lines: string[]): Record<SectionKey, string[]> {
  const sections: Record<SectionKey, string[]> = {
    experience: [],
    education: [],
    projects: [],
    skills: [],
  };
  let current: SectionKey | null = null;
  for (const line of lines) {
    const heading = matchHeading(line);
    if (heading) {
      current = heading;
      continue;
    }
    if (current) sections[current].push(line);
  }
  return sections;
}

// ---------------------------------------------------------------------------
// Header / bullet helpers
// ---------------------------------------------------------------------------
const BULLET_RE = /^[\s]*[-–—*•·▪◦►▶]+\s*/;
const isBullet = (line: string): boolean => BULLET_RE.test(line);
const stripBullet = (line: string): string => line.replace(BULLET_RE, "").trim();

const HEADER_SEPARATORS = [" at ", " — ", " – ", " | ", " · ", ", ", " - "];

/** Split a "Title at Org" / "Title, Org" / "Title | Org" line, if separated. */
function splitTitleOrg(line: string): { title?: string; organization?: string } {
  for (const sep of HEADER_SEPARATORS) {
    const idx = line.indexOf(sep);
    if (idx > 0) {
      const title = line.slice(0, idx).trim();
      const organization = line.slice(idx + sep.length).trim();
      if (title.length >= 2 && organization.length >= 2) {
        return { title, organization };
      }
    }
  }
  return { title: line.trim() || undefined };
}

/** Derive title/organization from the top non-bullet header lines. */
function parseHeader(headerLines: string[]): { title?: string; organization?: string } {
  const clean = headerLines.map((l) => stripBullet(l).trim()).filter((l) => l.length > 0);
  if (clean.length === 0) return {};
  const first = splitTitleOrg(clean[0]);
  if (first.organization) return first; // "Title at Org" on one line
  return { title: clean[0], organization: clean[1] };
}

// ---------------------------------------------------------------------------
// Experience parsing (date-range anchored)
// ---------------------------------------------------------------------------
function parseExperiences(lines: string[]): any[] {
  interface Entry {
    range: DateRange;
    headerLines: string[];
    body: string[];
  }
  const entries: Entry[] = [];
  let pendingHeader: string[] = [];
  let current: Entry | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const range = detectDateRange(line);
    if (range) {
      const headerLines = [...pendingHeader];
      if (range.remainder) headerLines.push(range.remainder);
      current = { range, headerLines, body: [] };
      entries.push(current);
      pendingHeader = [];
    } else if (isBullet(line)) {
      if (current) current.body.push(stripBullet(line));
    } else {
      // Non-bullet, non-date line: a header candidate for the NEXT entry.
      pendingHeader.push(line);
    }
  }
  // Any trailing non-bullet lines after the last date belong to its description.
  if (current && pendingHeader.length > 0) {
    current.body.push(...pendingHeader);
  }

  const out: any[] = [];
  for (const entry of entries) {
    const { title, organization } = parseHeader(entry.headerLines);
    // Require BOTH title and organization: the /profile/update sanitizer
    // rejects an experience without an organization, so a title-only
    // suggestion could not be saved (would 400 on accept).
    if (!title || !organization) continue;
    const obj: any = {
      id: crypto.randomUUID(),
      title,
      source: "resume-parse",
    };
    if (organization) obj.organization = organization;
    const startDate = toYearMonth(entry.range.start);
    if (startDate) obj.startDate = startDate;
    if (entry.range.current) {
      obj.current = true;
      obj.endDate = null;
    } else {
      const endDate = toYearMonth(entry.range.end);
      obj.endDate = endDate ?? null;
    }
    const description = entry.body.map((l) => l.trim()).filter(Boolean).join("\n");
    if (description) obj.description = description;
    out.push(obj);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Generic block splitter (used for education + projects): a new block starts
// after a blank line, or when a non-bullet header line follows bullet lines.
// ---------------------------------------------------------------------------
function splitBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let cur: string[] = [];
  let prevBullet = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (cur.length) blocks.push(cur);
      cur = [];
      prevBullet = false;
      continue;
    }
    const bullet = isBullet(line);
    if (!bullet && prevBullet && cur.length) {
      blocks.push(cur);
      cur = [];
    }
    cur.push(line);
    prevBullet = bullet;
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

// ---------------------------------------------------------------------------
// Education parsing
// ---------------------------------------------------------------------------
const DEGREE_RE =
  /\b(bachelor(?:'s)?|master(?:'s)?|b\.?\s?sc|b\.?\s?a|m\.?\s?sc|m\.?\s?a|b\.?eng|m\.?eng|mba|ph\.?\s?d|doctorate|diploma|dipl[oô]me|certificate|associate|d\.?e\.?c|baccalauréat|licence)\b/i;
const SCHOOL_RE =
  /\b(university|universit[ée]|college|coll[èe]ge|institute|institut|school|[ée]cole|polytechnic|polytechnique|academy)\b/i;
const YEAR_RE = /\b(19|20)\d{2}\b/g;

function parseEducation(lines: string[]): any[] {
  const blocks = splitBlocks(lines);
  const out: any[] = [];
  for (const block of blocks) {
    const school = block.find((l) => SCHOOL_RE.test(l));
    const program = block.find((l) => DEGREE_RE.test(l));
    if (!school || !program) continue; // sanitizer requires both

    // Graduation year: the latest 4-digit year in the block (range end).
    let gradYear: string | undefined;
    let maxYear = 0;
    for (const l of block) {
      const matches = l.match(YEAR_RE);
      if (!matches) continue;
      for (const y of matches) {
        const n = Number(y);
        if (n > maxYear) {
          maxYear = n;
          gradYear = y;
        }
      }
    }

    const obj: any = {
      id: crypto.randomUUID(),
      school: stripBullet(school).trim(),
      program: stripBullet(program).trim(),
      source: "resume-parse",
    };
    if (gradYear) obj.graduationYear = gradYear;
    out.push(obj);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Projects parsing
// ---------------------------------------------------------------------------
const URL_RE = /https?:\/\/[^\s)]+/i;

function parseProjects(lines: string[]): any[] {
  const blocks = splitBlocks(lines);
  const out: any[] = [];
  for (const block of blocks) {
    const clean = block.map((l) => l.trim()).filter(Boolean);
    if (clean.length === 0) continue;

    const firstLine = stripBullet(clean[0]);
    // Trim a trailing "— summary" / ": summary" off the name; keep it as detail.
    let name = firstLine;
    let inlineDesc = "";
    const nameMatch = firstLine.match(/^(.{2,}?)\s*[-–—:|]\s+(.+)$/);
    if (nameMatch) {
      name = nameMatch[1].trim();
      inlineDesc = nameMatch[2].trim();
    }
    name = name.replace(/[\s:–—-]+$/g, "").trim();
    if (!name) continue; // require a name

    const urlMatch = block.join(" ").match(URL_RE);
    const rest = clean.slice(1).map((l) => stripBullet(l).trim()).filter(Boolean);
    const descParts = [inlineDesc, ...rest].filter(Boolean);

    const obj: any = {
      id: crypto.randomUUID(),
      name,
      source: "resume-parse",
    };
    if (urlMatch) obj.url = urlMatch[0].replace(/[.,;)]+$/, "");
    const description = descParts
      .filter((p) => !URL_RE.test(p) || p.replace(URL_RE, "").trim().length > 0)
      .join("\n")
      .trim();
    if (description) obj.description = description;
    out.push(obj);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Skills parsing
// ---------------------------------------------------------------------------
function parseSkills(lines: string[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const raw of lines) {
    let line = stripBullet(raw);
    // Strip a short leading "Category:" label (e.g. "Languages: Python, Java").
    const colon = line.indexOf(":");
    if (colon > 0 && colon <= 30 && !line.slice(0, colon).includes(",")) {
      line = line.slice(colon + 1);
    }
    for (const token of line.split(/[,|/•·;\t]|\s{2,}/)) {
      const v = token.replace(/^[\s\-–—*•·]+/, "").trim();
      if (v.length < 2 || v.length > 40) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name: v });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public: pure text parser (unit-testable without a real PDF)
// ---------------------------------------------------------------------------
export function parseResumeText(text: string): ResumeSuggestions {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, "").trimStart());
  const sections = segmentSections(lines);
  return {
    experiences: parseExperiences(sections.experience),
    education: parseEducation(sections.education),
    projects: parseProjects(sections.projects),
    skills: parseSkills(sections.skills),
  };
}

// ---------------------------------------------------------------------------
// Public: parse a resume PDF buffer into structured suggestions.
// Throws on a genuinely unreadable/corrupt PDF; the caller wraps this and
// returns a clean error (never leaking a stack). A readable-but-empty parse
// returns empty arrays (not an error).
// ---------------------------------------------------------------------------
export async function parseResumePdf(buffer: Buffer): Promise<ResumeSuggestions> {
  const parsed = await pdfParse(buffer);
  const text = typeof parsed?.text === "string" ? parsed.text : "";
  const suggestions = parseResumeText(text);

  logger.info("Resume parsed deterministically", {
    experiences: suggestions.experiences.length,
    education: suggestions.education.length,
    projects: suggestions.projects.length,
    skills: suggestions.skills.length,
  });

  return suggestions;
}
