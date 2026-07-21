/**
 * Single source of truth for every lazy-loaded route's dynamic `import()`
 * thunk (everything EXCEPT the design-lab prototype pages, which stay inline
 * in App.tsx since they're internal-only and intentionally excluded from
 * preloading — see route-preload.ts).
 *
 * Both App.tsx (to build `lazy(...)` components) and route-preload.ts (to
 * build the pathname -> thunk registry) import from here, so each route's
 * import path is written exactly once. A dynamic `import()` promise is
 * memoized by the bundler/browser already, so calling a thunk twice (once
 * via a preload, once via `lazy()` actually rendering) is cheap and safe.
 */

// --- Auth ---
export const authCallbackImport = () => import("@/pages/(auth)/auth/callback/page");

// --- Legacy landing (kept reachable, unlinked) ---
export const legacyLandingImport = () => import("@/pages/landing/page");

// --- Account / profile ---
export const accountImport = () => import("@/pages/(dashboard)/account/page");

// --- Jobs ---
export const jobApplyImport = () => import("@/pages/(dashboard)/jobs/[slug]/apply/page");
export const appliedJobsImport = () => import("@/pages/(dashboard)/jobs/applied/page");

// --- Alerts (spec 06) ---
export const alertsImport = () => import("@/pages/(dashboard)/alerts/page");
export const alertDetailImport = () => import("@/pages/(dashboard)/alerts/[id]/page");

// --- Surveys (spec 08) ---
export const selfIdSurveyImport = () => import("@/pages/(dashboard)/survey/self-id/page");
export const workplaceValuesSurveyImport = () => import("@/pages/(dashboard)/survey/values/page");

// --- Companies ---
export const companiesImport = () => import("@/pages/companies/page");
export const companyDetailImport = () => import("@/pages/companies/[id]/page");

// --- Events management ---
export const createEventImport = () => import("@/pages/events/create/page");
export const editEventImport = () => import("@/pages/events/[id]/edit");
export const eventRegisterImport = () => import("@/pages/events/[id]/register/page");
export const eventManageAttendeesImport = () => import("@/pages/events/[id]/manage/page");
export const eventTeamManageImport = () => import("@/pages/events/[id]/teams/manage/page");
export const customEventFormImport = () => import("@/pages/events/[id]/forms/custom/page");

// --- Communities management ---
export const communityAdminImport = () => import("@/pages/communities/[id]/admin/page");
export const createCommunityImport = () => import("@/pages/communities/create/page");

// --- Misc public pages ---
export const spotlightImport = () => import("@/pages/spotlight/page");
export const exploreImport = () => import("@/pages/explore/page");
export const aboutImport = () => import("@/pages/about/page");

// --- Booking ---
export const bookingImport = () => import("@/pages/(dashboard)/book/[code]/page");

// --- Platform admin ---
export const moderationQueueImport = () => import("@/pages/admin/moderation/page");
export const adminContentImport = () => import("@/pages/admin/content/page");
export const adminAuditLogImport = () => import("@/pages/admin/audit-log/page");
