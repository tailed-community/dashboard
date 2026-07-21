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
 * Strategy (deliberately NOT date-anchored, NOT exact-heading-anchored):
 *  - Sections are found by fuzzy heading matching (accent/punctuation-insensitive
 *    keyword containment against an EN+FR synonym list), not an exact-string list,
 *    so unrecognized headings ("Career History", "Formation", …) still resolve.
 *  - Experience/education entries are found by BLOCK segmentation (blank lines /
 *    bullet transitions), not by anchoring on a date-range regex, so an entry
 *    with an unparsed or missing date is still emitted (with empty date fields)
 *    instead of silently dropped.
 *  - Title vs. organization on a header line is decided by a small keyword
 *    lexicon + org signals (Inc/Ltd/University/ALL-CAPS/…) scored on both sides
 *    of the split, not by positional assumption — so company-first templates
 *    ("Acme Inc. — Software Engineer") don't get title/org swapped, while an
 *    ambiguous line falls back to the original (left, right) order rather than
 *    guessing.
 *  - Locations ("Toronto, ON", "Remote") are stripped from header lines before
 *    the title/org split so they never get misread as an org name, and are
 *    captured into `Experience.location` when recognizable.
 *
 * Accuracy is best-effort: the confirm-and-review UI on the client is the safety
 * net for imperfect heuristics. There is NO external API dependency and NO
 * per-call cost — parsing is always available. Parsing never throws on weird
 * input; a section that yields nothing usable is just an empty array.
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
// Text normalization helpers (accent/punctuation-insensitive matching).
// ---------------------------------------------------------------------------
const stripAccents = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lowercase, accent-stripped, punctuation-collapsed-to-space, space-padded —
 * built for cheap `.includes(" keyword ")` containment checks. */
const normalizeForMatch = (s: string): string => {
  const core = stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ` ${core} `;
};

/** Whether `normalized` (already `normalizeForMatch`-ed, space-padded) contains
 * `keyword` as a whole word/phrase. */
const containsPhrase = (normalized: string, keyword: string): boolean =>
  normalized.includes(` ${keyword} `);

const containsAny = (normalized: string, keywords: readonly string[]): boolean =>
  keywords.some((k) => containsPhrase(normalized, k));

// ---------------------------------------------------------------------------
// Date parsing — EN + FR month names, seasons, quarters, single years, and
// "since/depuis" open-ended ranges, in addition to explicit month-year ranges.
// ---------------------------------------------------------------------------
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, janv: 1, janvier: 1,
  feb: 2, february: 2, fev: 2, fevr: 2, fevrier: 2,
  mar: 3, march: 3, mars: 3,
  apr: 4, april: 4, avr: 4, avril: 4,
  may: 5, mai: 5,
  jun: 6, june: 6, juin: 6,
  jul: 7, july: 7, juil: 7, juillet: 7,
  aug: 8, august: 8, aout: 8,
  sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, december: 12, decembre: 12,
};

const SEASON_MONTHS: Record<string, number> = {
  spring: 3, printemps: 3,
  summer: 6, ete: 6,
  fall: 9, autumn: 9, automne: 9,
  winter: 12, hiver: 12,
};

/** Parse a single date token into a year (+ optional month, when derivable). */
function parseDateToken(raw: string): { year: number; month?: number } | null {
  const s = stripAccents(raw.trim().toLowerCase());
  // "Jan 2023" / "January 2023" / "Janv. 2023"
  let m = s.match(/^([a-z]{3,9})\.?\s+(\d{4})$/);
  if (m && MONTHS[m[1]]) return { year: Number(m[2]), month: MONTHS[m[1]] };
  // "Summer 2024" / "Ete 2024" (season — no exact month, keep the year only)
  m = s.match(/^([a-z]{3,10})\s+(\d{4})$/);
  if (m && SEASON_MONTHS[m[1]] !== undefined) return { year: Number(m[2]) };
  // "Q1 2024" / "T1 2024" (quarter — no exact month)
  m = s.match(/^[qt][1-4]\s+(\d{4})$/);
  if (m) return { year: Number(m[1]) };
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

// A single date token: month-year (EN/FR), season-year (EN/FR), quarter-year,
// mm/yyyy, yyyy-mm, or a bare year.
const MONTH_NAME = String.raw`[A-Za-z]{3,9}\.?`;
const SEASON_NAME = String.raw`(?:spring|summer|fall|autumn|winter|printemps|[ée]t[ée]|automne|hiver)`;
const DATE_TOKEN = String.raw`(?:${MONTH_NAME}\s+\d{4}|${SEASON_NAME}\s+\d{4}|[QT][1-4]\s+\d{4}|\d{1,2}[/-]\d{4}|\d{4}[-/]\d{1,2}|(?:19|20)\d{2})`;
const PRESENT = String.raw`(?:present|current|ongoing|now|today|pr[ée]sent[e]?|actuel(?:le)?|aujourd'?hui|en\s+cours)`;
// A date RANGE: token -> (dash/to/…/à) -> token|present.
const RANGE_RE = new RegExp(
  String.raw`(${DATE_TOKEN})\s*(?:[-–—]|to|until|through|thru|jusqu'?[àa]|jusqu'?en|[àa]|au)\s*(${PRESENT}|${DATE_TOKEN})`,
  "i"
);
// "Since 2021" / "Depuis janvier 2021" — open-ended, current.
const SINCE_RE = new RegExp(String.raw`\b(?:since|depuis)\s+(${DATE_TOKEN})`, "i");
// A single bare token, not part of a larger range (used as a last-resort
// fallback so an entry with only a start year isn't dropped).
const SINGLE_DATE_RE = new RegExp(String.raw`(${DATE_TOKEN})`, "i");
const PRESENT_RE = new RegExp(PRESENT, "i");

interface DateRange {
  start: { year: number; month?: number } | null;
  end: { year: number; month?: number } | null;
  current: boolean;
  remainder: string; // the line with the date range removed (header candidate)
  label: string; // the raw matched date text, for graceful-degradation notes
}

const cleanRemainder = (line: string, matchStart: number, matchLen: number): string =>
  (line.slice(0, matchStart) + " " + line.slice(matchStart + matchLen))
    .replace(/[|,•·\-–—]+\s*$/g, "")
    .replace(/^\s*[|,•·\-–—]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

/** Find a date (range, "since X", or bare token) in a line. */
function detectDateRange(line: string): DateRange | null {
  let m = line.match(RANGE_RE);
  if (m && m.index !== undefined) {
    const start = parseDateToken(m[1]);
    const endRaw = m[2];
    const current = PRESENT_RE.test(endRaw);
    const end = current ? null : parseDateToken(endRaw);
    return {
      start,
      end,
      current,
      remainder: cleanRemainder(line, m.index, m[0].length),
      label: m[0].trim(),
    };
  }
  m = line.match(SINCE_RE);
  if (m && m.index !== undefined) {
    const start = parseDateToken(m[1]);
    return {
      start,
      end: null,
      current: true,
      remainder: cleanRemainder(line, m.index, m[0].length),
      label: m[0].trim(),
    };
  }
  m = line.match(SINGLE_DATE_RE);
  if (m && m.index !== undefined) {
    const start = parseDateToken(m[1]);
    if (!start) return null;
    return {
      start,
      end: null,
      current: false,
      remainder: cleanRemainder(line, m.index, m[0].length),
      label: m[0].trim(),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section segmentation — fuzzy heading match, not an exact-string list.
// ---------------------------------------------------------------------------
type SectionKey = "experience" | "education" | "projects" | "skills";

const HEADING_SYNONYMS: Record<SectionKey, string[]> = {
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
    "career history",
    "career summary",
    "internship experience",
    "internships",
    "co op experience",
    "where i've worked",
    "where i have worked",
    "experience professionnelle",
    "experience de travail",
    "parcours professionnel",
    "historique d'emploi",
    "emplois",
    "stages",
  ],
  education: [
    "education",
    "academic background",
    "education & training",
    "education and training",
    "academics",
    "academic history",
    "formation",
    "formation academique",
    "scolarite",
    "parcours academique",
    "parcours scolaire",
    "cursus",
    "diplomes",
  ],
  projects: [
    "projects",
    "personal projects",
    "academic projects",
    "selected projects",
    "side projects",
    "notable projects",
    "portfolio",
    "projets",
    "projets personnels",
    "realisations",
  ],
  skills: [
    "skills",
    "technical skills",
    "technologies",
    "competencies",
    "core competencies",
    "skills & technologies",
    "skills and technologies",
    "technical proficiencies",
    "tools & technologies",
    "tools and technologies",
    "competences",
    "competences techniques",
    "outils",
    "langues et competences",
  ],
};

const MAX_HEADING_LEN = 40;
const MAX_HEADING_WORDS = 6;

/** Returns the section a heading line introduces, or null if it isn't one.
 *
 * Single-word synonyms (e.g. "skills", "technologies") are common enough as
 * substrings of unrelated content — a company name ("Acme Technologies
 * Inc."), a labeled skills line ("Soft Skills: …") — that they only match
 * when they're the WHOLE (normalized) line. Multi-word synonyms (e.g.
 * "career history", "professional experience") are distinctive enough that
 * containment matching is safe and lets a heading like "Career History &
 * Impact" still resolve. */
function matchHeading(line: string): SectionKey | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_LEN) return null;
  if (trimmed.split(/\s+/).length > MAX_HEADING_WORDS) return null;
  const normalized = normalizeForMatch(trimmed).trim();
  if (!normalized) return null;
  let best: { key: SectionKey; len: number } | null = null;
  for (const key of Object.keys(HEADING_SYNONYMS) as SectionKey[]) {
    for (const synonym of HEADING_SYNONYMS[key]) {
      const isMultiWord = synonym.includes(" ");
      const matches = normalized === synonym || (isMultiWord && normalized.includes(synonym));
      if (matches) {
        if (!best || synonym.length > best.len) best = { key, len: synonym.length };
      }
    }
  }
  return best?.key ?? null;
}

/** Split the whole doc into labeled sections (keeps blank lines within them).
 * Content before the first recognized heading is dropped (not "poisoning"
 * any section), matching the pre-heading preamble (name/contact info) that
 * every resume has. */
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
// Bullet helpers
// ---------------------------------------------------------------------------
const BULLET_RE = /^[\s]*[-–—*•·▪◦►▶]+\s*/;
const isBullet = (line: string): boolean => BULLET_RE.test(line);
const stripBullet = (line: string): string => line.replace(BULLET_RE, "").trim();

// ---------------------------------------------------------------------------
// Location detection/stripping — so "Toronto, ON" / "Remote" / "Paris, France"
// never gets misread as an organization name during title/org disambiguation.
// ---------------------------------------------------------------------------
const PROVINCE_STATE_ABBR = new Set([
  // Canadian provinces/territories
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
  // US states + DC (common ones enough for a resume parser; not exhaustive)
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const COUNTRY_NAMES = [
  "canada", "united states", "usa", "u s a", "us", "france", "mexico",
  "united kingdom", "uk", "germany", "china", "india", "australia", "japan",
  "brazil", "spain", "italy", "netherlands", "belgium", "switzerland",
];

const REMOTE_WORDS = [
  "remote", "hybrid", "on site", "onsite", "a distance", "teletravail",
];

/** True when the ENTIRE line is just a location fragment (city/province,
 * remote/hybrid, or city/country) — used to pull standalone location lines
 * out of a header block before title/org splitting. */
function pureLocationLine(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return undefined;
  const normalized = normalizeForMatch(trimmed).trim();
  if (containsAny(normalized, REMOTE_WORDS) && trimmed.split(/\s+/).length <= 3) return trimmed;
  // "City, PROV" / "City, PROV, Canada"
  const m = trimmed.match(/^[A-Za-zÀ-ÿ.'\- ]{2,40},\s*([A-Za-z]{2})(?:,\s*[A-Za-zÀ-ÿ ]+)?$/);
  if (m && PROVINCE_STATE_ABBR.has(m[1].toUpperCase())) return trimmed;
  // "City, Country"
  const parts = trimmed.split(",").map((p) => p.trim());
  if (parts.length === 2 && parts[0].length > 0) {
    const countryNorm = normalizeForMatch(parts[1]).trim();
    if (COUNTRY_NAMES.includes(countryNorm)) return trimmed;
  }
  return undefined;
}

/** Strip a trailing/leading location fragment from a header line, returning
 * the cleaned text plus the captured location (best-effort). */
function stripLocationFromLine(line: string): { text: string; location?: string } {
  let text = line;
  let location: string | undefined;

  // ", City, PROV" (optionally followed by ", Country")
  const provRe = /,\s*([A-Za-zÀ-ÿ.'\- ]{2,40}),\s*([A-Za-z]{2})\b\.?(?:,\s*[A-Za-zÀ-ÿ ]+)?/;
  const provMatch = text.match(provRe);
  if (provMatch && PROVINCE_STATE_ABBR.has(provMatch[2].toUpperCase())) {
    location = provMatch[0].replace(/^,\s*/, "").trim();
    text = text.slice(0, provMatch.index) + text.slice((provMatch.index ?? 0) + provMatch[0].length);
  }

  // ", Country" (only if not already consumed above)
  if (!location) {
    const countryRe = new RegExp(
      String.raw`,\s*(${COUNTRY_NAMES.map((c) => c.replace(/ /g, "\\s+")).join("|")})\b`,
      "i"
    );
    const countryMatch = text.match(countryRe);
    if (countryMatch && countryMatch.index !== undefined) {
      location = countryMatch[0].replace(/^,\s*/, "").trim();
      text = text.slice(0, countryMatch.index) + text.slice(countryMatch.index + countryMatch[0].length);
    }
  }

  // Remote/hybrid tokens, in parens, after a dash, or after a comma.
  const remoteRe = /[(,-]?\s*\b(remote|hybrid|on-?site|[àa]\s+distance|t[ée]l[ée]travail)\b\)?/i;
  const remoteMatch = text.match(remoteRe);
  if (remoteMatch && remoteMatch.index !== undefined) {
    if (!location) location = remoteMatch[0].replace(/^[(,-]\s*/, "").replace(/\)$/, "").trim();
    text = text.slice(0, remoteMatch.index) + text.slice(remoteMatch.index + remoteMatch[0].length);
  }

  text = text
    .replace(/[|,•·\-–—]+\s*$/g, "")
    .replace(/^\s*[|,•·\-–—]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text, location };
}

// ---------------------------------------------------------------------------
// Title vs. organization disambiguation.
// ---------------------------------------------------------------------------
const TITLE_KEYWORDS = [
  "engineer", "developer", "dev", "intern", "internship", "analyst", "manager",
  "designer", "scientist", "consultant", "coordinator", "assistant",
  "associate", "specialist", "lead", "director", "officer", "researcher",
  "architect", "administrator", "technician", "representative", "agent",
  "strategist", "producer", "editor", "writer", "marketer", "recruiter",
  "accountant", "auditor", "planner", "supervisor", "president", "founder",
  "ceo", "cto", "cfo", "vp", "vice president", "co-founder", "cofounder",
  "student", "trainee", "fellow", "volunteer",
  // French
  "stagiaire", "developpeur", "developpeuse", "ingenieur", "ingenieure",
  "analyste", "gestionnaire", "concepteur", "conceptrice", "chercheur",
  "chercheuse", "coordonnateur", "coordonnatrice", "assistante", "chef",
  "responsable", "directeur", "directrice", "fondateur", "fondatrice",
  "consultante", "redacteur", "redactrice", "charge de projet",
  "chargee de projet",
];

const ORG_KEYWORDS = [
  "inc", "ltd", "llc", "corp", "corporation", "co", "company", "technologies",
  "technology", "labs", "laboratories", "university", "universite", "college",
  "college", "ecole", "group", "groupe", "solutions", "systems", "systemes",
  "partners", "consulting", "studio", "studios", "agency", "agences",
  "foundation", "fondation", "institute", "institut", "holdings",
  "enterprises", "industries", "gmbh", "sa", "srl", "plc", "bank", "capital",
];

/** Weak but useful org signal: a mostly-uppercase segment (e.g. "IBM",
 * "ACME TECHNOLOGIES") reads as a company name, not a job title. */
function isAllCapsish(text: string): boolean {
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 2) return false;
  return letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

function classifySide(text: string): { titleScore: number; orgScore: number } {
  const normalized = normalizeForMatch(text);
  let titleScore = 0;
  let orgScore = 0;
  for (const kw of TITLE_KEYWORDS) if (containsPhrase(normalized, kw)) titleScore++;
  for (const kw of ORG_KEYWORDS) if (containsPhrase(normalized, kw)) orgScore++;
  if (isAllCapsish(text)) orgScore += 1;
  return { titleScore, orgScore };
}

/** Decide which of two header fragments is the title vs. the organization.
 * Falls back to the original (left=title, right=organization) order when the
 * signals are ambiguous — we never swap blindly. */
function determineOrder(
  left: string,
  right: string
): { title: string; organization: string } {
  const L = classifySide(left);
  const R = classifySide(right);
  if (L.titleScore > L.orgScore && R.orgScore >= R.titleScore) {
    return { title: left, organization: right };
  }
  if (R.titleScore > R.orgScore && L.orgScore >= L.titleScore) {
    return { title: right, organization: left };
  }
  return { title: left, organization: right };
}

/** Split an already location-stripped header fragment into title/organization. */
function splitTitleOrgText(text: string): { title?: string; organization?: string } {
  const line = text.trim();
  if (!line) return {};

  // "Title at Org" / "Titre chez Org" — the preposition makes the order
  // unambiguous, so no scoring is needed here.
  const atMatch = line.match(/\s+(?:at|chez)\s+/i);
  if (atMatch && atMatch.index && atMatch.index > 0) {
    const title = line.slice(0, atMatch.index).trim();
    const organization = line.slice(atMatch.index + atMatch[0].length).trim();
    if (title.length >= 2 && organization.length >= 2) return { title, organization };
  }

  // Pipe/dash separators: order is NOT assumed — scored on both sides.
  for (const sep of [" | ", " – ", " — ", " - "]) {
    const idx = line.indexOf(sep);
    if (idx > 0) {
      const left = line.slice(0, idx).trim();
      const right = line.slice(idx + sep.length).trim();
      if (left.length >= 2 && right.length >= 2) return determineOrder(left, right);
    }
  }

  // Comma-space: only treated as a title/org separator (not e.g. a location
  // remnant) when one side actually reads like a job title.
  const commaIdx = line.indexOf(", ");
  if (commaIdx > 0) {
    const left = line.slice(0, commaIdx).trim();
    const right = line.slice(commaIdx + 2).trim();
    if (left.length >= 2 && right.length >= 2 && !pureLocationLine(right) && !pureLocationLine(left)) {
      const L = classifySide(left);
      const R = classifySide(right);
      if (L.titleScore > 0 || R.titleScore > 0) return determineOrder(left, right);
    }
  }

  return { title: line };
}

/** Derive title/organization/location from the header lines preceding an
 * entry's dates/bullets. Handles both "Title at Org" single lines and
 * "Title" / "Org" (or "Org" / "Title") two-line headers, in either order. */
function parseHeader(headerLines: string[]): {
  title?: string;
  organization?: string;
  location?: string;
} {
  const clean = headerLines.map((l) => stripBullet(l).trim()).filter((l) => l.length > 0);
  let location: string | undefined;
  const remaining: string[] = [];
  for (const l of clean) {
    const pureLoc = pureLocationLine(l);
    if (pureLoc) {
      location = location ?? pureLoc;
      continue;
    }
    remaining.push(l);
  }
  if (remaining.length === 0) return { location };

  const stripped = remaining.map((l) => stripLocationFromLine(l));
  for (const s of stripped) {
    if (s.location && !location) location = s.location;
  }
  const texts = stripped.map((s) => s.text).filter((t) => t.length > 0);
  if (texts.length === 0) return { location };

  const first = splitTitleOrgText(texts[0]);
  if (first.title && first.organization) {
    return { title: first.title, organization: first.organization, location };
  }
  if (texts.length === 1) {
    return { title: texts[0], location };
  }
  const { title, organization } = determineOrder(texts[0], texts[1]);
  return { title, organization, location };
}

// ---------------------------------------------------------------------------
// employmentType inference (never defaults to "full-time").
// ---------------------------------------------------------------------------
function inferEmploymentType(
  title: string,
  description: string
): "internship" | "part-time" | "full-time" | "volunteer" | "co-op" | "other" | undefined {
  const normalized = normalizeForMatch(`${title} ${description}`);
  if (containsAny(normalized, ["intern", "internship", "stage", "stagiaire"])) return "internship";
  if (containsAny(normalized, ["co op", "coop", "alternance"])) return "co-op";
  if (containsAny(normalized, ["volunteer", "benevole", "bénévole"])) return "volunteer";
  if (containsAny(normalized, ["part time", "temps partiel"])) return "part-time";
  if (containsAny(normalized, ["full time", "temps plein"])) return "full-time";
  return undefined;
}

// ---------------------------------------------------------------------------
// Generic block splitter (used for experience/education/projects): a new
// block starts after a blank line, or when a non-bullet header line follows
// bullet lines.
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
// Experience parsing — block-anchored (not date-anchored). A block with a
// usable header is always emitted; a block with no recognizable date just
// gets empty date fields instead of being dropped.
// ---------------------------------------------------------------------------
function parseExperiences(lines: string[]): any[] {
  const blocks = splitBlocks(lines);
  const out: any[] = [];

  for (const block of blocks) {
    const headerLines: string[] = [];
    const bodyLines: string[] = [];
    let seenBullet = false;
    for (const raw of block) {
      const bullet = isBullet(raw);
      if (bullet) seenBullet = true;
      if (!bullet && !seenBullet) headerLines.push(raw);
      else bodyLines.push(bullet ? stripBullet(raw) : raw.trim());
    }
    // A block with no non-bullet lead-in at all (rare) still deserves a shot:
    // treat the first line as the header.
    if (headerLines.length === 0 && bodyLines.length > 0) {
      headerLines.push(bodyLines.shift() as string);
    }

    // Find a date on any header line (not the body — bullets are descriptions).
    let range: DateRange | null = null;
    const cleanedHeaderLines: string[] = [];
    let dateConsumed = false;
    for (const line of headerLines) {
      if (!dateConsumed) {
        const found = detectDateRange(line);
        if (found) {
          range = found;
          dateConsumed = true;
          if (found.remainder) cleanedHeaderLines.push(found.remainder);
          continue;
        }
      }
      cleanedHeaderLines.push(line);
    }

    const { title, organization, location } = parseHeader(cleanedHeaderLines);
    // Require BOTH title and organization: the /profile/update sanitizer
    // rejects an experience without an organization, so a title-only
    // suggestion could not be saved (would 400 on accept).
    if (!title || !organization) continue;

    const description = bodyLines.map((l) => l.trim()).filter(Boolean).join("\n");

    const obj: any = {
      id: crypto.randomUUID(),
      title,
      organization,
      source: "resume-parse",
    };
    if (location) obj.location = location;

    if (range) {
      const startDate = toYearMonth(range.start);
      const endDate = range.current ? undefined : toYearMonth(range.end);
      if (startDate) obj.startDate = startDate;
      if (range.current) {
        obj.current = true;
        obj.endDate = null;
      } else if (endDate) {
        obj.endDate = endDate;
      } else {
        obj.endDate = null;
      }
      // Graceful degradation: a season/quarter/bare-year range has a year but
      // no derivable month, so it can't populate `startDate`/`endDate`
      // (must be strict `YYYY-MM`). Keep the human-readable date in the
      // description rather than silently losing it.
      const lossyStart = range.start && !startDate;
      const lossyEnd = !range.current && range.end && !endDate;
      const descriptionParts = [];
      if (lossyStart || lossyEnd) descriptionParts.push(`(${range.label})`);
      if (description) descriptionParts.push(description);
      const finalDescription = descriptionParts.join("\n").trim();
      if (finalDescription) obj.description = finalDescription;
    } else if (description) {
      obj.description = description;
    }

    const employmentType = inferEmploymentType(title, description);
    if (employmentType) obj.employmentType = employmentType;

    out.push(obj);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Education parsing — accepts a school-only OR degree-only block (previously
// required both, silently dropping partial matches).
// ---------------------------------------------------------------------------
const DEGREE_RE =
  /\b(bachelor(?:'s)?|master(?:'s)?|b\.?\s?sc|b\.?\s?a|m\.?\s?sc|m\.?\s?a|b\.?eng|m\.?eng|mba|ph\.?\s?d|doctorate|doctorat|diploma|dipl[oô]me|certificate|certificat|associate|d\.?e\.?c|baccalaur[ée]at|licence|ma[iî]trise)\b/i;
const SCHOOL_RE =
  /\b(university|universit[ée]|college|coll[èe]ge|institute|institut|school|[ée]cole|polytechnic|polytechnique|academy|cegep|c[ée]gep)\b/i;
const YEAR_RE = /\b(19|20)\d{2}\b/g;
const FIELD_OF_STUDY_RE = /\b(?:in|en)\s+([A-Za-zÀ-ÿ&,'\- ]{3,60})$/i;

function parseEducation(lines: string[]): any[] {
  const blocks = splitBlocks(lines);
  const out: any[] = [];
  for (const block of blocks) {
    const clean = block.map((l) => stripBullet(l).trim()).filter(Boolean);
    if (clean.length === 0) continue;

    const schoolLine = clean.find((l) => SCHOOL_RE.test(l));
    const degreeLine = clean.find((l) => DEGREE_RE.test(l));
    if (!schoolLine && !degreeLine) continue; // no education signal at all

    // Best-effort fallback: if only one signal is present, borrow the other
    // non-matching line in the block so the entry still has both fields.
    const school = schoolLine ?? clean.find((l) => l !== degreeLine) ?? "";
    const program = degreeLine ?? clean.find((l) => l !== schoolLine) ?? "";

    let fieldOfStudy: string | undefined;
    const fieldMatch = program.match(FIELD_OF_STUDY_RE);
    if (fieldMatch) fieldOfStudy = fieldMatch[1].trim();

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
      school,
      program,
      source: "resume-parse",
    };
    if (fieldOfStudy) obj.fieldOfStudy = fieldOfStudy;
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
// Skills parsing — with category inference (language/framework/tool/soft).
// `level` is intentionally never set: proficiency is never guessed.
// ---------------------------------------------------------------------------
type SkillCategory = "language" | "framework" | "tool" | "soft" | "other";

const LANGUAGE_SKILLS = [
  "python", "java", "javascript", "js", "typescript", "ts", "c", "c++", "c#",
  "csharp", "ruby", "go", "golang", "rust", "swift", "kotlin", "php", "r",
  "matlab", "scala", "perl", "dart", "sql", "html", "html5", "css", "css3",
  "bash", "shell", "powershell", "objective-c", "objectivec", "julia",
  "haskell", "lua", "assembly", "vba", "elixir", "clojure", "groovy",
  "fortran", "cobol", "sas", "sass", "scss",
];
const FRAMEWORK_SKILLS = [
  "react", "react.js", "reactjs", "angular", "angularjs", "vue", "vue.js",
  "vuejs", "next.js", "nextjs", "nuxt", "node.js", "nodejs", "express",
  "expressjs", "django", "flask", "fastapi", "spring", "spring boot",
  "springboot", "rails", "ruby on rails", ".net", "dotnet", "asp.net",
  "aspnet", "laravel", "symfony", "tensorflow", "pytorch", "keras",
  "scikit-learn", "scikitlearn", "pandas", "numpy", "jquery", "bootstrap",
  "tailwind", "tailwindcss", "redux", "graphql", "svelte", "sveltekit",
  "ember", "flutter", "react native", "reactnative", "unity",
  "unreal engine", "unrealengine", "xamarin", "ionic", "electron",
];
const TOOL_SKILLS = [
  "git", "github", "gitlab", "bitbucket", "docker", "kubernetes", "k8s",
  "aws", "azure", "gcp", "google cloud", "figma", "jira", "confluence",
  "sketch", "adobe xd", "adobexd", "photoshop", "illustrator", "excel",
  "microsoft excel", "powerpoint", "word", "tableau", "power bi", "powerbi",
  "postman", "webpack", "vite", "npm", "yarn", "linux", "unix", "windows",
  "macos", "vs code", "vscode", "visual studio", "intellij", "eclipse",
  "terraform", "jenkins", "circleci", "github actions", "githubactions",
  "salesforce", "sap", "notion", "slack", "trello", "asana", "firebase",
  "mongodb", "postgresql", "postgres", "mysql", "sqlite", "redis", "oracle",
  "splunk", "kafka", "rabbitmq", "nginx", "apache", "heroku", "vercel",
  "netlify",
];
const SOFT_SKILLS = [
  "communication", "leadership", "teamwork", "team work", "collaboration",
  "problem solving", "problem-solving", "critical thinking",
  "time management", "adaptability", "creativity", "public speaking",
  "presentation", "negotiation", "conflict resolution", "mentoring",
  "coaching", "project management", "organization", "organizational",
  "attention to detail", "work ethic", "interpersonal", "multitasking",
  "decision making", "decision-making", "flexibility", "empathy",
  "customer service",
];

/** Collapse whitespace/dots/dashes/underscores (keep +/#) for lexicon lookup
 * so "Node.js", "node js", and "nodejs" all resolve to the same key. */
const canonicalSkillKey = (s: string): string =>
  stripAccents(s).toLowerCase().replace(/[\s._-]+/g, "");

const SKILL_CATEGORY_MAP = new Map<string, SkillCategory>();
for (const s of LANGUAGE_SKILLS) SKILL_CATEGORY_MAP.set(canonicalSkillKey(s), "language");
for (const s of FRAMEWORK_SKILLS) SKILL_CATEGORY_MAP.set(canonicalSkillKey(s), "framework");
for (const s of TOOL_SKILLS) SKILL_CATEGORY_MAP.set(canonicalSkillKey(s), "tool");
for (const s of SOFT_SKILLS) SKILL_CATEGORY_MAP.set(canonicalSkillKey(s), "soft");

function inferSkillCategory(name: string): SkillCategory | undefined {
  return SKILL_CATEGORY_MAP.get(canonicalSkillKey(name));
}

// "Languages:", "Frameworks:", "Tools:", "Soft Skills:" style labels give a
// stronger category hint than the lexicon for anything the lexicon misses.
const LABEL_CATEGORY_HINTS: Array<{ keywords: string[]; category: SkillCategory }> = [
  { keywords: ["soft skill", "interpersonal"], category: "soft" },
  { keywords: ["programming language", "language", "langue"], category: "language" },
  { keywords: ["framework", "librar"], category: "framework" },
  { keywords: ["tool", "technolog", "platform", "outil"], category: "tool" },
];

function inferLabelCategory(label: string): SkillCategory | undefined {
  const normalized = normalizeForMatch(label);
  for (const { keywords, category } of LABEL_CATEGORY_HINTS) {
    if (keywords.some((kw) => normalized.includes(kw))) return category;
  }
  return undefined;
}

function parseSkills(lines: string[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const raw of lines) {
    let line = stripBullet(raw);
    // Strip a short leading "Category:" label (e.g. "Languages: Python, Java"),
    // remembering the label as a category hint for its tokens.
    let labelHint: SkillCategory | undefined;
    const colon = line.indexOf(":");
    if (colon > 0 && colon <= 30 && !line.slice(0, colon).includes(",")) {
      labelHint = inferLabelCategory(line.slice(0, colon));
      line = line.slice(colon + 1);
    }
    for (const token of line.split(/[,|/•·;\t]|\s{2,}/)) {
      const v = token.replace(/^[\s\-–—*•·]+/, "").trim();
      if (v.length < 2 || v.length > 40) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const entry: any = { name: v };
      const category = inferSkillCategory(v) ?? labelHint;
      if (category) entry.category = category;
      out.push(entry);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public: pure text parser (unit-testable without a real PDF)
// ---------------------------------------------------------------------------
export function parseResumeText(text: string): ResumeSuggestions {
  try {
    const lines = (text ?? "")
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
  } catch (error) {
    // Never throw on weird input — always return the expected shape.
    logger.warn("Resume text parsing failed; returning empty suggestions", { error });
    return { experiences: [], education: [], projects: [], skills: [] };
  }
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
