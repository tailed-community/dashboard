import {
  normalizeLocations,
  type WorkLocationType,
} from "@/lib/location-normalization";
import { type ExternalJob } from "@/types/jobs";

export const TAILED_GITHUB_JOBS_URL =
  "https://raw.githubusercontent.com/tailed-community/tailed-internships-new-grad/refs/heads/main/data/jobs.json";

interface TailedGithubJob {
  id?: string;
  company?: string;
  title?: string;
  location?: string | string[];
  type?: string;
  season?: string;
  source?: string;
  url?: string;
  /**
   * NOTE: despite the name, this is a human-readable relative label from the
   * scraper (e.g. "Posted 8 Days Ago") — NOT a parseable date. Display only;
   * `date_added` is the sortable field.
   */
  date_posted?: string;
  date_added?: string;
  active?: boolean;
}

let externalJobsPromise: Promise<ExternalJob[]> | null = null;

function normalizeJobType(type: unknown): ExternalJob["type"] {
  const normalizedType = typeof type === "string" ? type : "";

  return normalizedType
    .toLowerCase()
    .replaceAll("_", "-")
    .includes("new-grad")
    ? "new-grad"
    : "internship";
}

function toUnixSeconds(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

function splitLocations(location: TailedGithubJob["location"]): string[] {
  const rawLocations = Array.isArray(location) ? location : [location];

  return rawLocations
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) =>
      value
        .replaceAll("/", "|")
        .replaceAll(";", "|")
        .split("|")
    )
    .map((value) => value.trim())
    .filter(
      (value) =>
        value.length > 0 && value.toLowerCase() !== "not specified"
    );
}

function getWorkMode(locations: string[]): WorkLocationType | undefined {
  if (locations.length === 0) return undefined;

  const normalized = normalizeLocations(locations);
  if (normalized.some((location) => location.type === "remote")) return "remote";
  if (normalized.some((location) => location.type === "hybrid")) return "hybrid";
  return "onsite";
}

export function normalizeTailedGithubJobs(
  jobs: TailedGithubJob[]
): ExternalJob[] {
  return jobs
    .map((job): ExternalJob | null => {
      if (!job.id || !job.url || !job.title || !job.company) return null;

      const type = normalizeJobType(job.type);
      const locations = splitLocations(job.location);
      const normalizedLocations = normalizeLocations(locations);
      const dateAdded = toUnixSeconds(job.date_added);
      const hasSeason = Boolean(job.season) && job.season !== "Not specified";

      return {
        category: null,
        company_name: job.company,
        id: job.id,
        title: job.title,
        active: job.active !== false,
        terms: hasSeason ? [job.season as string] : undefined,
        date_updated: dateAdded,
        date_posted: dateAdded,
        url: job.url,
        locations,
        normalized_locations: normalizedLocations,
        work_mode: getWorkMode(locations),
        country:
          normalizedLocations.find((location) => location.normalized.country)
            ?.normalized.country || null,
        degrees: [],
        type,
        season: hasSeason ? job.season : undefined,
        source: job.source,
        date_posted_label: job.date_posted,
      };
    })
    .filter((job): job is ExternalJob => job !== null);
}

/**
 * Fetches the external jobs feed (internships + new grads, ~11k jobs) and
 * adapts each entry into the shared `ExternalJob` shape. Concurrent/repeat
 * callers share a single in-flight network round-trip via a module-level
 * cache; the cache is cleared on rejection so a subsequent call can retry.
 */
export function fetchExternalJobs(): Promise<ExternalJob[]> {
  if (!externalJobsPromise) {
    externalJobsPromise = fetch(TAILED_GITHUB_JOBS_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`GitHub jobs request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((jobs: TailedGithubJob[]) => normalizeTailedGithubJobs(jobs))
      .catch((error) => {
        externalJobsPromise = null;
        console.error("Failed to fetch Tail'ed GitHub jobs:", error);
        return [];
      });
  }

  return externalJobsPromise;
}

export function dedupeExternalJobs(jobs: ExternalJob[]): ExternalJob[] {
  const deduped: ExternalJob[] = [];
  const idToIndex = new Map<string, number>();
  const urlToIndex = new Map<string, number>();

  jobs.forEach((job) => {
    const existingIndex = idToIndex.get(job.id) ?? urlToIndex.get(job.url);

    if (existingIndex === undefined) {
      const index = deduped.length;
      deduped.push(job);
      idToIndex.set(job.id, index);
      urlToIndex.set(job.url, index);
      return;
    }

    deduped[existingIndex] = job;
    idToIndex.set(job.id, existingIndex);
    urlToIndex.set(job.url, existingIndex);
  });

  return deduped;
}

/** Filters a list of external jobs down to only the active ones. */
export function activeExternalJobs(jobs: ExternalJob[]): ExternalJob[] {
  return jobs.filter((job) => job.active !== false);
}

/** date_posted/date_updated on `ExternalJob` are unix epochs; some sources are seconds, some ms. */
export function toMillis(epoch: number): number {
  return epoch < 1e12 ? epoch * 1000 : epoch;
}

/**
 * Human label for a job's posting date: prefers the feed-provided
 * `date_posted_label` when present, else a relative label ("Posted today",
 * "Posted 3d ago", ...) derived from `date_posted`.
 */
export function formatPostedLabel(job: ExternalJob): string {
  if (job.date_posted_label) return job.date_posted_label;

  const posted = new Date(toMillis(job.date_posted));
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays <= 0) return "Posted today";
  if (diffInDays === 1) return "Posted yesterday";
  if (diffInDays < 30) return `Posted ${diffInDays}d ago`;
  return `Posted ${posted.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
