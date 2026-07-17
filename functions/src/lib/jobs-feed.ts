/**
 * Server-side adapter for the external jobs feed used by the daily digest
 * cron (functions/src/scheduled/jobs-digest.ts).
 *
 * This intentionally duplicates the small adapter in
 * `src/lib/external-jobs.ts` (frontend) rather than importing it — backend
 * code must not import frontend code (functions is a separate TS project).
 */

export const JOBS_FEED_URL =
  "https://raw.githubusercontent.com/tailed-community/tailed-internships-new-grad/refs/heads/main/data/jobs.json";

/** Raw shape of a single job as served by the feed. */
export type RawFeedJob = {
  id: string;
  company: string;
  title: string;
  location: string;
  type: "internship" | "new_grad";
  season: string;
  source: string;
  url: string;
  /**
   * NOTE: despite the name, this is a human-readable relative label from the
   * scraper (e.g. "Posted 8 Days Ago", "Posted Yesterday") — NOT an epoch or
   * parseable timestamp. It is display-only. `date_added` is the only
   * reliable, sortable date field and is what drives the digest watermark.
   */
  date_posted: string;
  /** ISO calendar date, e.g. "2026-06-05" (no time component). */
  date_added: string;
  active: boolean;
};

/** Normalized job shape used throughout the digest cron. */
export interface DigestJob {
  id: string;
  title: string;
  companyName: string;
  location: string;
  type: "internship" | "new-grad";
  url: string;
  active: boolean;
  /** `date_added` parsed to epoch ms (UTC midnight) — the single source of truth for watermarking/sorting. */
  dateAddedMs: number;
  /** Raw display label from the feed, e.g. "Posted 8 Days Ago". Display only, never used for comparisons. */
  datePostedLabel: string;
}

/** Parses an ISO `YYYY-MM-DD` date string into epoch ms (UTC midnight); 0 if unparseable. */
function parseDateAddedToEpochMs(dateAdded: string): number {
  const parsedMs = Date.parse(`${dateAdded}T00:00:00Z`);
  return Number.isNaN(parsedMs) ? 0 : parsedMs;
}

function normalizeType(type: RawFeedJob["type"]): "internship" | "new-grad" {
  return type === "new_grad" ? "new-grad" : "internship";
}

/** Adapts a raw feed job into the digest's normalized shape. */
export function adaptRawFeedJob(job: RawFeedJob): DigestJob {
  return {
    id: job.id,
    title: job.title,
    companyName: job.company,
    location: job.location || "",
    type: normalizeType(job.type),
    url: job.url,
    active: job.active,
    dateAddedMs: parseDateAddedToEpochMs(job.date_added),
    datePostedLabel: job.date_posted,
  };
}

/**
 * Fetches the external jobs feed (~11k jobs) and adapts + filters it down to
 * active jobs only. Throws on network/parse failure — callers decide how to
 * handle a failed run (the digest cron logs and bails out for that run).
 */
export async function fetchDigestJobs(): Promise<DigestJob[]> {
  const response = await fetch(JOBS_FEED_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch jobs feed: HTTP ${response.status}`);
  }
  const raw: RawFeedJob[] = await response.json();
  return raw.map(adaptRawFeedJob).filter((job) => job.active !== false);
}
