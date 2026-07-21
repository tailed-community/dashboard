import { createContext, useContext, type ReactNode } from "react";

/**
 * Route map consumed by the shared Playground chrome (header/footer/shell) so
 * the exact same components can serve both the design-lab prototype routes
 * (`/design-lab/playground/...`) and, in later phases, the live public routes
 * (`/jobs`, `/events`, `/communities`, ...). Every path the chrome needs to
 * link to goes through this map instead of being hardcoded in the component.
 */
export interface PlaygroundRoutes {
    jobs: string;
    events: string;
    communities: string;
    jobDetail: (idOrSlug: string) => string;
    eventDetail: (idOrSlug: string) => string;
    communityDetail: (idOrSlug: string) => string;
    spotlight: string;
    signIn: string;
    signUp: string;
    /** Get-alerts CTA target used by pages that link (rather than scroll/onClick) to the alert builder. */
    alertBuilder: string;
    /** Where the header logo/wordmark links to. */
    home: string;
    /** Signed-in "Your space" hub (ambient profile). */
    me: string;
    /** Edit-profile / account settings page. */
    account: string;
    /** "My alerts" management page. */
    alerts: string;
    /** "My applications" page. */
    applications: string;
    /** Workplace-values survey (linked, re-editable). */
    surveyValues: string;
    /** Anonymous self-ID demographic survey. */
    surveySelfId: string;
    /** "Start a community" creation form (signed-in, moderated). */
    communityCreate: string;
    /** "Host an event" creation form (signed-in, moderated). */
    eventCreate: string;
}

/** Route map for the design-lab prototype pages under /design-lab/playground/... */
export const LAB_ROUTES: PlaygroundRoutes = {
    jobs: "/design-lab/playground/jobs",
    events: "/design-lab/playground/events",
    communities: "/design-lab/playground/communities",
    jobDetail: (idOrSlug) => `/design-lab/playground/jobs/${idOrSlug}`,
    eventDetail: (idOrSlug) => `/design-lab/playground/events/${idOrSlug}`,
    communityDetail: (idOrSlug) => `/design-lab/playground/communities/${idOrSlug}`,
    spotlight: "/spotlight",
    signIn: "/sign-in",
    signUp: "/sign-up",
    alertBuilder: "/design-lab/playground/jobs#alert-builder",
    home: "/design-lab/playground",
    // User destinations (not lab prototypes) — point at the real app routes.
    me: "/me",
    account: "/account",
    alerts: "/account/alerts",
    applications: "/jobs/applied",
    surveyValues: "/account/survey/values",
    surveySelfId: "/account/survey/self-id",
    communityCreate: "/communities/create",
    eventCreate: "/events/create",
};

/**
 * Route map for the live public site. Provided now so later phases (mounting
 * these shared bodies at /jobs, /events, /communities, etc.) don't have to
 * invent it from scratch.
 *
 * NOTE: `jobDetail` follows this spec's "slug" convention (`/jobs/:slug`,
 * matching `PublicJobPage` in App.tsx for internal-DB jobs). The Playground
 * job data is actually sourced from the external feed (`ExternalJob`), which
 * today lives at `/jobs/e/:id` (`ExternalJobPage`) — whichever phase wires a
 * live jobs page up to this shared chrome should double check which of the
 * two live job-detail routes applies before shipping.
 */
export const LIVE_ROUTES: PlaygroundRoutes = {
    jobs: "/jobs",
    events: "/events",
    communities: "/communities",
    jobDetail: (slug) => `/jobs/${slug}`,
    eventDetail: (idOrSlug) => `/events/${idOrSlug}`,
    communityDetail: (idOrSlug) => `/communities/${idOrSlug}`,
    spotlight: "/spotlight",
    signIn: "/sign-in",
    signUp: "/sign-up",
    alertBuilder: "/jobs#alert-builder",
    home: "/",
    me: "/me",
    account: "/account",
    alerts: "/account/alerts",
    applications: "/jobs/applied",
    surveyValues: "/account/survey/values",
    surveySelfId: "/account/survey/self-id",
    communityCreate: "/communities/create",
    eventCreate: "/events/create",
};

const PlaygroundRoutesContext = createContext<PlaygroundRoutes>(LAB_ROUTES);

/** Provides a route map to every shared Playground chrome component beneath it. Defaults to LAB_ROUTES when unwrapped. */
export function PlaygroundRoutesProvider({
    routes,
    children,
}: {
    routes: PlaygroundRoutes;
    children: ReactNode;
}) {
    return <PlaygroundRoutesContext.Provider value={routes}>{children}</PlaygroundRoutesContext.Provider>;
}

export function usePlaygroundRoutes(): PlaygroundRoutes {
    return useContext(PlaygroundRoutesContext);
}
