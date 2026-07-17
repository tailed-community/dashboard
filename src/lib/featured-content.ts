import type { ExternalJob } from "@/types/jobs";

/**
 * Minimal shape of a community as needed to decide whether it's fit to be
 * featured. Presentation components can pass a richer object — only these
 * fields are read.
 */
export interface FeaturableCommunityInput {
  memberCount?: number | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  shortDescription?: string | null;
}

/**
 * Minimal shape of an event as needed to decide whether it's fit to be
 * featured. Presentation components can pass a richer object — only these
 * fields are read.
 */
export interface FeaturableEventInput {
  heroImageUrl?: string | null;
  startDate?: string | null;
}

/**
 * Gate for whether a community is credible enough to present as "featured"
 * on the landing page. Requires a minimum member count, at least one image
 * (logo or banner), and a non-empty description — anything less reads as a
 * fake/ghost-town community and must fall back to no community shown.
 */
export function isFeaturableCommunity(c: FeaturableCommunityInput | null | undefined): boolean {
  if (!c) return false;
  const hasEnoughMembers = (c.memberCount ?? 0) >= 25;
  const hasImage = Boolean(c.logoUrl || c.bannerUrl);
  const hasDescription = Boolean(c.shortDescription && c.shortDescription.trim().length > 0);
  return hasEnoughMembers && hasImage && hasDescription;
}

/**
 * Gate for whether an event is credible enough to present as "featured" on
 * the landing page. Requires a hero image and a start date that is today or
 * in the future — a past or imageless event reads as stale/broken.
 */
export function isFeaturableEvent(e: FeaturableEventInput | null | undefined): boolean {
  if (!e) return false;
  if (!e.heroImageUrl) return false;
  if (!e.startDate) return false;

  const startDate = new Date(e.startDate);
  if (Number.isNaN(startDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  return startDay.getTime() >= today.getTime();
}

/**
 * Picks the `n` freshest active jobs from an external-feed job list, sorted
 * by `date_posted` descending, while keeping the result diverse across
 * companies — at most `maxPerCompany` jobs from any single `company_name`.
 * Freshness order is preserved: jobs are walked newest-first and a job is
 * skipped (deferred) once its company has hit the cap, so a slot is filled
 * by the next-freshest job from a different company instead. Only if there
 * aren't enough distinct companies to fill all `n` slots this way do the
 * deferred (over-cap) jobs get appended to fill the remainder, allowing
 * duplicates as a fallback rather than returning fewer than `n` jobs.
 *
 * Used as the always-available fallback content for the jobs column on the
 * landing page.
 */
export function pickFreshestJobs(jobs: ExternalJob[], n: number, maxPerCompany = 2): ExternalJob[] {
  const limit = Math.max(0, n);
  const sorted = jobs
    .filter((job) => job.active !== false)
    .slice()
    .sort((a, b) => b.date_posted - a.date_posted);

  if (limit === 0) return [];

  const picked: ExternalJob[] = [];
  const deferred: ExternalJob[] = [];
  const countByCompany = new Map<string, number>();

  for (const job of sorted) {
    if (picked.length >= limit) break;
    const count = countByCompany.get(job.company_name) ?? 0;
    if (count < maxPerCompany) {
      picked.push(job);
      countByCompany.set(job.company_name, count + 1);
    } else {
      deferred.push(job);
    }
  }

  for (const job of deferred) {
    if (picked.length >= limit) break;
    picked.push(job);
  }

  return picked;
}
