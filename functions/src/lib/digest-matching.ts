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

/**
 * Minimum gap between two sends for a `weekly` subscription. The digest cron
 * runs daily, so weekly subscribers are skipped until this much time has
 * passed since their last send. Deliberately 7 days minus 12h of slack: the
 * scheduler can fire a few minutes late, and a strict 7×24h would drift the
 * send day forward by one day every week.
 */
export const WEEKLY_MIN_INTERVAL_MS =
  7 * 24 * 60 * 60 * 1000 - 12 * 60 * 60 * 1000;

/**
 * Whether a subscription should receive a digest in the run happening at
 * `now`. Daily subscriptions are always due — the cron's own schedule *is*
 * their cadence. Weekly ones are due only once WEEKLY_MIN_INTERVAL_MS has
 * passed since `lastSentAtMs`, and immediately if they've never sent (0/null).
 * Pure so the cadence rule is testable without Firestore.
 */
export function isDigestDue(
  frequency: "daily" | "weekly" | null | undefined,
  lastSentAtMs: number | null,
  now: number
): boolean {
  if (frequency !== "weekly") return true;
  if (!lastSentAtMs) return true;
  return now - lastSentAtMs >= WEEKLY_MIN_INTERVAL_MS;
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
