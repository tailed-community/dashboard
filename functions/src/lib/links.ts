/**
 * Shared link-building helpers for outbound emails. Extracted from
 * routes/alerts.ts so the jobs-digest cron (and any future callers) build
 * the same unsubscribe URL the same way.
 */
import { apiPublicUrl, frontendUrl } from "./env";

/**
 * Builds the public unsubscribe link for a job-alert subscription. Points
 * directly at the deployed API (never the frontend) since unsubscribing
 * must not require a logged-in session or a frontend route.
 */
export function buildUnsubscribeUrl(token: string): string {
  return `${apiPublicUrl()}/alerts/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Builds the frontend job-detail URL for a given job id, tagged with UTM
 * query params so digest -> click is measurable in analytics.
 */
export function buildJobDetailUrl(
  jobId: string,
  utm: { source: string; medium: string }
): string {
  const base = `${frontendUrl()}/jobs/e/${encodeURIComponent(jobId)}`;
  const params = new URLSearchParams({
    utm_source: utm.source,
    utm_medium: utm.medium,
  });
  return `${base}?${params.toString()}`;
}
