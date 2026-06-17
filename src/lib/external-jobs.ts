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
  url?: string;
  date_added?: string;
  active?: boolean;
}

function normalizeJobType(type: unknown): ExternalJob["type"] {
  return String(type || "")
    .toLowerCase()
    .replace(/_/g, "-")
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
    .flatMap((value) => value.split(/\s*(?:\/|\||;)\s*/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function getWorkMode(locations: string[]): WorkLocationType {
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
      const finalLocations = locations.length > 0 ? locations : ["Remote"];
      const normalizedLocations = normalizeLocations(finalLocations);
      const dateAdded = toUnixSeconds(job.date_added);

      return {
        category: type === "new-grad" ? "New Grad" : "Internship",
        company_name: job.company,
        id: job.id,
        title: job.title,
        active: job.active !== false,
        terms:
          job.season && job.season !== "Not specified"
            ? [job.season]
            : undefined,
        date_updated: dateAdded,
        date_posted: dateAdded,
        url: job.url,
        locations: finalLocations,
        normalized_locations: normalizedLocations,
        work_mode: getWorkMode(finalLocations),
        country:
          normalizedLocations.find((location) => location.normalized.country)
            ?.normalized.country || null,
        degrees: [],
        type,
      };
    })
    .filter((job): job is ExternalJob => job !== null);
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
