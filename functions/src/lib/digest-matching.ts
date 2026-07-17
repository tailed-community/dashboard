import type { DigestJob } from "./jobs-feed";

/**
 * The subset of a `jobAlertSubscriptions` doc that matching cares about.
 * Deliberately loose/minimal so the pure matcher below has no Firestore
 * dependency and is trivially unit-testable.
 */
export interface DigestSubscriptionLike {
  query?: string | null;
  jobType?: "internship" | "new-grad" | null;
  locations?: string[] | null;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/** Every whitespace token of the query must appear in title+company; empty query matches everything. */
function matchesQuery(job: DigestJob, query: string | null | undefined): boolean {
  const tokens = query ? tokenize(query) : [];
  if (tokens.length === 0) return true;
  const haystack = `${job.title} ${job.companyName}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function matchesJobType(
  job: DigestJob,
  jobType: "internship" | "new-grad" | null | undefined
): boolean {
  if (!jobType) return true;
  return job.type === jobType;
}

/** Job location string must contain at least one subscribed location token (case-insensitive). */
function matchesLocations(job: DigestJob, locations: string[] | null | undefined): boolean {
  if (!locations || locations.length === 0) return true;
  const haystack = job.location.toLowerCase();
  return locations.some((rawLocation) => {
    const needle = rawLocation.trim().toLowerCase();
    if (!needle) return false;
    // "Remote" is a location keyword, not a substring of a city name — match it directly.
    return haystack.includes(needle);
  });
}

/**
 * Pure matcher used by the jobs digest cron. Given a set of candidate jobs
 * (the caller is responsible for having already filtered these down to
 * `date_added > watermark`) and a subscription's filters, returns the jobs
 * that match, sorted newest-first. Does NOT apply the 12-jobs-per-email cap
 * — that's the caller's job so this function stays trivial to test.
 */
export function matchJobsToSubscription(
  jobs: DigestJob[],
  sub: DigestSubscriptionLike
): DigestJob[] {
  return jobs
    .filter(
      (job) =>
        matchesJobType(job, sub.jobType) &&
        matchesQuery(job, sub.query) &&
        matchesLocations(job, sub.locations)
    )
    .sort((a, b) => b.dateAddedMs - a.dateAddedMs);
}
