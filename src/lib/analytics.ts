/**
 * Small, dependency-free analytics layer (WS4).
 *
 * Behavior:
 * - Always logs to console.debug in dev so events are verifiable without a
 *   GA account.
 * - Pushes to window.dataLayer if present (GTM or a manually-injected layer).
 * - Sends a GA4 event via window.gtag if VITE_GA_MEASUREMENT_ID is set (the
 *   gtag script is lazily injected from src/main.tsx only when that env var
 *   is present — see initAnalytics()).
 *
 * Event names are the exact union agreed in docs/specs/00-overview.md.
 */

export type AnalyticsEvent =
  | "landing_view"
  | "landing_search_submit"
  | "landing_join_click"
  | "jobs_view"
  | "job_detail_view"
  | "job_apply_click"
  | "job_saved"
  | "job_alert_subscribed"
  | "digest_prompt_shown"
  | "digest_prompt_subscribed"
  | "event_view"
  | "event_rsvp_started"
  | "event_rsvp_completed"
  | "communities_view"
  | "community_detail_view"
  | "community_join"
  | "community_leave"
  | "auth_started"
  | "auth_completed"
  | "profile_completed_section"
  | "alert_unsubscribed"
  | "alert_edited"
  | "alert_paused"
  | "alert_resumed"
  | "alert_deleted"
  | "alert_batch_viewed";

type AnalyticsProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let gtagInjected = false;

/**
 * Lazily injects the GA4 gtag script. No-op if VITE_GA_MEASUREMENT_ID isn't
 * set, or if already injected. Called once from src/main.tsx on startup.
 */
export function initAnalytics(): void {
  if (gtagInjected || !GA_MEASUREMENT_ID || typeof document === "undefined") return;
  gtagInjected = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/**
 * Fires an analytics event. Safe to call unconditionally — never throws,
 * never blocks the caller, and always logs in dev via console.debug.
 */
export function trackEvent(name: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    if (import.meta.env.DEV) {
      console.debug("[analytics]", name, props || {});
    }

    if (typeof window === "undefined") return;

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...props });
    }

    if (GA_MEASUREMENT_ID && typeof window.gtag === "function") {
      window.gtag("event", name, props || {});
    }
  } catch (error) {
    console.error("trackEvent failed:", error);
  }
}
