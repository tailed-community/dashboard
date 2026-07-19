import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { SidebarContextProvider } from "./contexts/sidebar-context";
import { ProtectedRoute } from "./components/protected-route";
import { PrivateRoute } from "./components/private-route";
import { NotFoundComponent } from "./components/not-found-component";
import { JoyLayout } from "./layouts/joy-layout";
import { schedulePreload } from "./lib/route-preload";
import { installGlobalNavProgressListener } from "./lib/nav-progress";
import { NavProgressBar, NavProgressReset } from "./components/nav-progress-bar";
import { RouteFallback } from "./components/route-fallback";
import {
    accountImport,
    alertDetailImport,
    alertsImport,
    aboutImport,
    appliedJobsImport,
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
} from "./lib/route-imports";
import PublicJobPage from "./pages/(dashboard)/jobs/[slug]/page";
// Core public/high-traffic surfaces — statically imported (not lazy) so they
// ship in the main bundle and avoid a chunk-download wait on first visit.
import HomePage from "./pages/home/page";
import JoyJobsPage from "./pages/(dashboard)/jobs/joy-page";
import JoyExternalJobPage from "./pages/(dashboard)/jobs/joy-external-page";
import JoyEventsPage from "./pages/(public)/events/page";
import JoyEventDetailPage from "./pages/(public)/events/[id]/page";
import CommunitiesJoyPage from "./pages/communities/joy-page";
import CommunityDetailJoyPage from "./pages/communities/[id]/joy-page";
import SignIn from "./pages/(auth)/sign-in/page";
import SignUp from "./pages/(auth)/signup/page";
import YourSpacePage from "./pages/(dashboard)/me/page";

// Lazy loaded components. Each one's dynamic import() thunk is declared
// exactly once in ./lib/route-imports.ts (imported above), so the same
// thunk reference is reused here and in the route-preload registry — no
// double-maintenance, and preloading a route (idle or hover) is guaranteed
// to fetch the same chunk `lazy()` will render.
const AuthCallback = lazy(authCallbackImport);
// Old landing page — kept reachable at /legacy-home as a fallback (see
// bottom of route table). Not linked from anywhere in the app.
const LegacyLandingPage = lazy(legacyLandingImport);
// New joy home page (Phase G) — renders its own chrome via PlaygroundShell.
// (statically imported above — core high-traffic surface)
const Account = lazy(accountImport);
const JobApplyPage = lazy(jobApplyImport);
const AppliedJobsPage = lazy(appliedJobsImport);
// Joy jobs pages (Phase G) — self-contained, render their own chrome.
// Old JobsPage/ExternalJobPage (./pages/(dashboard)/jobs/page,
// ./pages/(dashboard)/jobs/external/page) are left on disk, unrouted.
// (JoyJobsPage / JoyExternalJobPage statically imported above — core
// high-traffic surfaces)
// Job-alerts management (spec 06) — self-contained joy shell, so declared as
// top-level PrivateRoute-wrapped routes (like the /jobs joy pages), NOT under
// DashboardLayout (which would double-header).
// "Your space" hub (Slice 1) — joy-shell, auth-gated, replaces the old sidebar
// dashboard as the signed-in home base.
// (YourSpacePage statically imported above — signed-in home base)
const AlertsPage = lazy(alertsImport);
const AlertDetailPage = lazy(alertDetailImport);
// Anonymous self-ID survey (spec 08 §3.3) — same self-contained joy shell as
// the alerts pages, so registered as a top-level PrivateRoute (not under
// DashboardLayout) for a focused, calm surface rather than a dashboard tab.
const SelfIdSurveyPage = lazy(selfIdSurveyImport);
// Workplace-values survey (spec 08 §3.4) — LINKED & re-editable (opposite of the
// anonymous self-ID survey). Same self-contained joy shell, registered as a
// top-level PrivateRoute (not under DashboardLayout).
const WorkplaceValuesSurveyPage = lazy(workplaceValuesSurveyImport);
// New pages from main
const CompaniesPage = lazy(companiesImport);
const CompanyDetailPage = lazy(companyDetailImport);
// Joy events pages (Phase G) — self-contained, render their own chrome.
// Old EventsPage/EventDetailPage (./pages/events/page, ./pages/events/[id]/page)
// are left on disk, unrouted.
// (JoyEventsPage / JoyEventDetailPage statically imported above — core
// high-traffic surfaces)
const CreateEventPage = lazy(createEventImport);
const EditEventPage = lazy(editEventImport);
const EventRegisterPage = lazy(eventRegisterImport);
const EventManageAttendeesPage = lazy(eventManageAttendeesImport);
const EventTeamManagePage = lazy(eventTeamManageImport);
const CustomEventFormPage = lazy(customEventFormImport);
// Joy communities pages (Phase G) — self-contained, render their own chrome.
// Old CommunitiesPage/CommunityDetailPage (./pages/communities/page,
// ./pages/communities/[id]/page) are left on disk, unrouted.
// (CommunitiesJoyPage / CommunityDetailJoyPage statically imported above —
// core high-traffic surfaces)
const CommunityAdminPage = lazy(communityAdminImport);
const CreateCommunityPage = lazy(createCommunityImport);
const SpotlightPage = lazy(spotlightImport);
const ExplorePage = lazy(exploreImport);
const AboutPage = lazy(aboutImport);
// Booking page from feature branch
const BookingPage = lazy(bookingImport);
// Design-lab prototypes (internal landing redesign explorations)
const DesignLabPage = lazy(() => import("./pages/design-lab/page"));
const LabZine = lazy(() => import("./pages/design-lab/zine"));
const LabStreakDuo = lazy(() => import("./pages/design-lab/streak-duo"));
const LabAfterHours = lazy(() => import("./pages/design-lab/after-hours"));
const LabPoster = lazy(() => import("./pages/design-lab/poster"));
const LabPlayground = lazy(() => import("./pages/design-lab/playground"));
const LabPlaygroundJobs = lazy(() => import("./pages/design-lab/playground-jobs"));
const LabPlaygroundEvents = lazy(() => import("./pages/design-lab/playground-events"));
const LabPlaygroundCommunities = lazy(() => import("./pages/design-lab/playground-communities"));
const LabPlaygroundJobDetail = lazy(() => import("./pages/design-lab/playground-job-detail"));
const LabPlaygroundEventDetail = lazy(() => import("./pages/design-lab/playground-event-detail"));
const LabPlaygroundCommunityDetail = lazy(() => import("./pages/design-lab/playground-community-detail"));

function App() {
    // Prefetch a small curated set of likely-next route chunks (account,
    // alerts, applied jobs, explore, spotlight, about, companies) during
    // browser idle time after first paint. Everything else is hover/focus
    // triggered only (see PreloadLink / usePreloadOnIntent) — see
    // route-preload.ts for the full rationale.
    useEffect(() => {
        schedulePreload();
        installGlobalNavProgressListener();
    }, []);

    return (
        <Router>
            <NavProgressBar />
            <NavProgressReset />
            <SidebarContextProvider>
                <Suspense fallback={<RouteFallback />}>
                    <Routes>
                        {/* HOME PAGE - Main hub */}
                        <Route path="/" element={<HomePage />} />

                        {/* LEGACY LANDING - old pre-joy home page, kept reachable
                            as an unlinked fallback for reversibility. Not indexed. */}
                        {/* TODO noindex: Seo component has no noindex/robots prop
                            yet; add one and set it here once available. */}
                        <Route path="/legacy-home" element={<LegacyLandingPage />} />

                        {/* JOY PAGES (Phase G) - jobs/events/communities, each
                            self-contained and rendering its own chrome via
                            PlaygroundShell. Registered as standalone top-level
                            routes (siblings of "/") rather than under
                            PublicLayout, since PublicLayout only supplies the
                            old auth-aware <Header/> + footer chrome (no
                            providers/scroll/analytics behavior these pages
                            need) and nesting them there would double-header. */}
                        <Route path="/jobs" element={<JoyJobsPage />} />
                        {/* External job detail (static "e" segment) MUST be
                            registered before /jobs/:slug so it isn't
                            shadowed by the dynamic slug route. */}
                        <Route path="/jobs/e/:id" element={<JoyExternalJobPage />} />
                        <Route path="/events" element={<JoyEventsPage />} />
                        <Route path="/events/:id" element={<JoyEventDetailPage />} />
                        <Route path="/communities" element={<CommunitiesJoyPage />} />
                        <Route path="/communities/:id" element={<CommunityDetailJoyPage />} />

                        {/* YOUR SPACE (Slice 1) — joy-shell hub, auth-gated.
                            Top-level (not under DashboardLayout) so PlaygroundShell
                            supplies the only chrome; the signed-in home base. */}
                        <Route
                            path="/me"
                            element={
                                <PrivateRoute>
                                    <YourSpacePage />
                                </PrivateRoute>
                            }
                        />

                        {/* ACCOUNT / PROFILE EDITOR (Slice 2) — joy-shell,
                            auth-gated. Moved OUT of DashboardLayout so the page's
                            own PlaygroundShell supplies the only chrome (keeping it
                            under DashboardLayout would double-header it). */}
                        <Route
                            path="/account"
                            element={
                                <PrivateRoute>
                                    <Account />
                                </PrivateRoute>
                            }
                        />

                        {/* MY ALERTS (spec 06) — joy-shell, auth-gated. Top-level
                            (not under DashboardLayout) so PlaygroundShell supplies
                            the only chrome. /account/alerts/:id must sit here, not
                            under the /account DashboardLayout tree. */}
                        <Route
                            path="/account/alerts"
                            element={
                                <PrivateRoute>
                                    <AlertsPage />
                                </PrivateRoute>
                            }
                        />
                        <Route
                            path="/account/alerts/:id"
                            element={
                                <PrivateRoute>
                                    <AlertDetailPage />
                                </PrivateRoute>
                            }
                        />

                        {/* SELF-ID SURVEY (spec 08 §3.3) — anonymous, auth-gated,
                            joy-shell. Top-level (not under DashboardLayout) so the
                            survey reads as a focused, calm surface. */}
                        <Route
                            path="/account/survey/self-id"
                            element={
                                <PrivateRoute>
                                    <SelfIdSurveyPage />
                                </PrivateRoute>
                            }
                        />

                        {/* WORKPLACE-VALUES SURVEY (spec 08 §3.4) — linked &
                            re-editable, auth-gated, joy-shell. Top-level (not
                            under DashboardLayout), sibling of the self-ID survey. */}
                        <Route
                            path="/account/survey/values"
                            element={
                                <PrivateRoute>
                                    <WorkplaceValuesSurveyPage />
                                </PrivateRoute>
                            }
                        />

                        {/* AUTHENTICATION - Protected from authenticated users */}
                        <Route
                            path="/sign-in"
                            element={
                                <ProtectedRoute>
                                    <SignIn />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/sign-up"
                            element={
                                <ProtectedRoute>
                                    <SignUp />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/auth/callback"
                            element={<AuthCallback />}
                        />

                        {/* PUBLIC ROUTES - Ungated, accessible to all. Now
                            re-skinned with the joy chrome via JoyLayout (which
                            reuses PlaygroundShell). Page bodies unchanged. */}
                        <Route element={<JoyLayout />}>
                            {/* /jobs/:slug (internal job detail) now gets joy
                                chrome via JoyLayout. It does not collide with
                                /jobs or /jobs/e/:id above since those are
                                registered as standalone routes with more
                                specific segment counts. */}
                            <Route
                                path="/jobs/:slug"
                                element={<PublicJobPage />}
                            />
                            <Route
                                path="/companies"
                                element={<CompaniesPage />}
                            />
                            <Route
                                path="/companies/:id"
                                element={<CompanyDetailPage />}
                            />
                            <Route
                                path="/events/:id/register"
                                element={<EventRegisterPage />}
                            />
                            <Route
                                path="/events/:id/manage"
                                element={
                                    <PrivateRoute>
                                        <EventManageAttendeesPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/events/:id/teams/:teamId/manage"
                                element={
                                    <PrivateRoute>
                                        <EventTeamManagePage />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/events/:id/forms/custom"
                                element={
                                    <PrivateRoute>
                                        <CustomEventFormPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/events/:id/edit"
                                element={
                                    <PrivateRoute>
                                        <EditEventPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/events/create"
                                element={
                                    <PrivateRoute>
                                        <CreateEventPage />
                                    </PrivateRoute>
                                }
                            />
                            {/* Legacy/external links used "/community" (singular);
                                keep a redirect as a safety net now that all
                                in-app links point to "/communities" directly. */}
                            <Route
                                path="/community"
                                element={<Navigate to="/communities" replace />}
                            />
                            <Route
                                path="/communities/:id/admin"
                                element={
                                    <PrivateRoute>
                                        <CommunityAdminPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/communities/create"
                                element={
                                    <PrivateRoute>
                                        <CreateCommunityPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/spotlight"
                                element={<SpotlightPage />}
                            />
                            <Route path="/explore" element={<ExplorePage />} />
                            <Route path="/about" element={<AboutPage />} />
                            
                            {/* PUBLIC BOOKING PAGE */}
                            <Route path="/book/:code" element={<BookingPage />} />

                            {/* Formerly under DashboardLayout — these pages do
                                not self-shell, so they now get the joy chrome
                                from JoyLayout. PrivateRoute wrappers preserved. */}
                            <Route
                                path="/jobs/applied"
                                element={
                                    <PrivateRoute>
                                        <AppliedJobsPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route
                                path="/jobs/:slug/apply"
                                element={<JobApplyPage />}
                            />
                        </Route>

                        {/* Legacy /dashboard route retired — the joy "Your space"
                            hub at /me is the signed-in home base now. Redirect
                            kept for backward-compatible inbound links. */}
                        <Route
                            path="/dashboard"
                            element={<Navigate to="/me" replace />}
                        />

                        {/* DESIGN LAB - internal, standalone landing prototypes */}
                        <Route path="/design-lab" element={<DesignLabPage />} />
                        <Route path="/design-lab/zine" element={<LabZine />} />
                        <Route path="/design-lab/streak-duo" element={<LabStreakDuo />} />
                        <Route path="/design-lab/after-hours" element={<LabAfterHours />} />
                        <Route path="/design-lab/poster" element={<LabPoster />} />
                        <Route path="/design-lab/playground" element={<LabPlayground />} />
                        <Route path="/design-lab/playground/jobs" element={<LabPlaygroundJobs />} />
                        <Route path="/design-lab/playground/events" element={<LabPlaygroundEvents />} />
                        <Route path="/design-lab/playground/communities" element={<LabPlaygroundCommunities />} />
                        <Route path="/design-lab/playground/jobs/:id" element={<LabPlaygroundJobDetail />} />
                        <Route path="/design-lab/playground/events/:id" element={<LabPlaygroundEventDetail />} />
                        <Route path="/design-lab/playground/communities/:id" element={<LabPlaygroundCommunityDetail />} />

                        {/* 404 CATCH-ALL ROUTE */}
                        <Route path="*" element={<NotFoundComponent />} />
                    </Routes>
                </Suspense>
            </SidebarContextProvider>
            <Toaster />
        </Router>
    );
}

export default App;
