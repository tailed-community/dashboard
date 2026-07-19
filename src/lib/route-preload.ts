/**
 * Route-chunk preloading for the ~30 lazy() routes in App.tsx.
 *
 * Two triggers feed the same underlying mechanism:
 *  - `schedulePreload` fires a small curated set of likely-next chunks once
 *    during browser idle time after first paint (see IDLE_PRELOAD_THUNKS).
 *  - `preloadRoute` fires a single chunk on hover/focus/touchstart of a link
 *    pointing at it (see src/components/preload-link.tsx).
 *
 * Design-lab prototype pages are intentionally NOT in ROUTE_PRELOAD_REGISTRY
 * — they're internal-only and not worth prefetching for real visitors.
 */
import {
    accountImport,
    alertDetailImport,
    alertsImport,
    appliedJobsImport,
    aboutImport,
    authCallbackImport,
    bookingImport,
    communityAdminImport,
    companiesImport,
    companyDetailImport,
    createCommunityImport,
    createEventImport,
    customEventFormImport,
    editEventImport,
    eventManageAttendeesImport,
    eventRegisterImport,
    eventTeamManageImport,
    exploreImport,
    jobApplyImport,
    legacyLandingImport,
    selfIdSurveyImport,
    spotlightImport,
    workplaceValuesSurveyImport,
} from "@/lib/route-imports";

type Thunk = () => Promise<unknown>;

interface RouteEntry {
    /** Route path pattern, e.g. "/account/alerts/:id" — `:segment` matches any single path segment. */
    pattern: string;
    thunk: Thunk;
}

/**
 * Pathname -> chunk registry for every lazy route except design-lab
 * prototypes. Order doesn't matter for correctness (patterns don't overlap
 * once split into segments), but static segments are listed before their
 * dynamic siblings for readability.
 */
const ROUTE_PRELOAD_REGISTRY: RouteEntry[] = [
    { pattern: "/auth/callback", thunk: authCallbackImport },
    { pattern: "/legacy-home", thunk: legacyLandingImport },

    { pattern: "/account", thunk: accountImport },
    { pattern: "/account/alerts", thunk: alertsImport },
    { pattern: "/account/alerts/:id", thunk: alertDetailImport },
    { pattern: "/account/survey/self-id", thunk: selfIdSurveyImport },
    { pattern: "/account/survey/values", thunk: workplaceValuesSurveyImport },

    { pattern: "/jobs/applied", thunk: appliedJobsImport },
    { pattern: "/jobs/:slug/apply", thunk: jobApplyImport },

    { pattern: "/companies", thunk: companiesImport },
    { pattern: "/companies/:id", thunk: companyDetailImport },

    { pattern: "/events/create", thunk: createEventImport },
    { pattern: "/events/:id/edit", thunk: editEventImport },
    { pattern: "/events/:id/register", thunk: eventRegisterImport },
    { pattern: "/events/:id/manage", thunk: eventManageAttendeesImport },
    { pattern: "/events/:id/teams/:teamId/manage", thunk: eventTeamManageImport },
    { pattern: "/events/:id/forms/custom", thunk: customEventFormImport },

    { pattern: "/communities/create", thunk: createCommunityImport },
    { pattern: "/communities/:id/admin", thunk: communityAdminImport },

    { pattern: "/spotlight", thunk: spotlightImport },
    { pattern: "/explore", thunk: exploreImport },
    { pattern: "/about", thunk: aboutImport },

    { pattern: "/book/:code", thunk: bookingImport },
];

/**
 * Curated idle-time prefetch set — likely-next destinations for a typical
 * signed-in visitor. Deliberately small: event/community management,
 * booking, surveys, auth callback, and job-apply are on-demand only (hover
 * covers those when a link to them is actually shown).
 */
const IDLE_PRELOAD_THUNKS: Thunk[] = [
    accountImport,
    alertsImport,
    appliedJobsImport,
    exploreImport,
    spotlightImport,
    aboutImport,
    companiesImport,
];

/** Thunks that have already fired, so hover/focus/idle triggers don't re-import. */
const firedThunks = new Set<Thunk>();

function fireThunk(thunk: Thunk): void {
    if (firedThunks.has(thunk)) return;
    firedThunks.add(thunk);
    thunk().catch(() => {
        // Genuine network failure (e.g. offline) — allow a later trigger
        // (another hover, or actually navigating) to retry.
        firedThunks.delete(thunk);
    });
}

/** True if every non-`:param` segment of `pattern` matches the same segment of `pathname`. */
function matchesPattern(pattern: string, pathname: string): boolean {
    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);
    if (patternParts.length !== pathParts.length) return false;
    return patternParts.every(
        (part, i) => part.startsWith(":") || part === pathParts[i]
    );
}

/**
 * Matches `pathname` against the route registry and fires its import thunk
 * (memoized — safe to call on every hover/focus without re-importing).
 * No-ops for pathnames that don't match a lazy route (e.g. static routes,
 * design-lab pages).
 */
export function preloadRoute(pathname: string): void {
    if (!pathname) return;
    const path = pathname.split("?")[0].split("#")[0];
    for (const entry of ROUTE_PRELOAD_REGISTRY) {
        if (matchesPattern(entry.pattern, path)) {
            fireThunk(entry.thunk);
            return;
        }
    }
}

/**
 * Fires a curated set of import thunks once the browser is idle (or after a
 * 2s fallback timeout on browsers without requestIdleCallback, e.g. Safari).
 * Intended to be called once, after first paint (see App.tsx's useEffect).
 */
export function schedulePreload(thunks: Thunk[] = IDLE_PRELOAD_THUNKS): void {
    if (typeof window === "undefined") return;

    const run = () => {
        for (const thunk of thunks) fireThunk(thunk);
    };

    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
        ric(run, { timeout: 2000 });
    } else {
        setTimeout(run, 2000);
    }
}
