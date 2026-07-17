import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { SidebarContextProvider } from "./contexts/sidebar-context";
import { ProtectedRoute } from "./components/protected-route";
import { PrivateRoute } from "./components/private-route";
import { NotFoundComponent } from "./components/not-found-component";
import PublicJobPage from "./pages/(dashboard)/jobs/[slug]/page";

// Loading component
const LoadingFallback = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="relative">
            <div className="h-12 w-12 border-4 border-gray-300 rounded-full"></div>
            <div className="absolute top-0 left-0 h-12 w-12 border-4 border-t-primary border-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-600 animate-pulse">
            Loading, please wait...
        </p>
    </div>
);

// Lazy loaded components
const SignIn = lazy(() => import("./pages/(auth)/sign-in/page"));
const SignUp = lazy(() => import("./pages/(auth)/signup/page"));
const AuthCallback = lazy(() => import("./pages/(auth)/auth/callback/page"));
const HomePage = lazy(() => import("./pages/landing/page"));
const Dashboard = lazy(() => import("./pages/(dashboard)/page"));
const DashboardLayout = lazy(() => import("./layouts/dashboard-layout"));
const PublicLayout = lazy(() => import("./layouts/public-layout"));
const Account = lazy(() => import("./pages/(dashboard)/account/page"));
const JobApplyPage = lazy(
    () => import("./pages/(dashboard)/jobs/[slug]/apply/page")
);
const AppliedJobsPage = lazy(
    () => import("./pages/(dashboard)/jobs/applied/page")
);
const JobsPage = lazy(() => import("./pages/(dashboard)/jobs/page"));
const ExternalJobPage = lazy(
    () => import("./pages/(dashboard)/jobs/external/page")
);
// New pages from main
const CompaniesPage = lazy(() => import("./pages/companies/page"));
const CompanyDetailPage = lazy(() => import("./pages/companies/[id]/page"));
const EventsPage = lazy(() => import("./pages/events/page"));
const EventDetailPage = lazy(() => import("./pages/events/[id]/page"));
const CreateEventPage = lazy(() => import("./pages/events/create/page"));
const EditEventPage = lazy(() => import("./pages/events/[id]/edit"));
const EventRegisterPage = lazy(() => import("./pages/events/[id]/register/page"));
const EventManageAttendeesPage = lazy(() => import("./pages/events/[id]/manage/page"));
const EventTeamManagePage = lazy(() => import("./pages/events/[id]/teams/manage/page"));
const CustomEventFormPage = lazy(() => import("./pages/events/[id]/forms/custom/page"));
const CommunitiesPage = lazy(() => import("./pages/communities/page"));
const CommunityDetailPage = lazy(() => import("./pages/communities/[id]/page"));
const CommunityAdminPage = lazy(() => import("./pages/communities/[id]/admin/page"));
const CreateCommunityPage = lazy(
    () => import("./pages/communities/create/page")
);
const SpotlightPage = lazy(() => import("./pages/spotlight/page"));
const ExplorePage = lazy(() => import("./pages/explore/page"));
const AboutPage = lazy(() => import("./pages/about/page"));
// Booking page from feature branch
const BookingPage = lazy(() => import("./pages/(dashboard)/book/[code]/page"));
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
    return (
        <Router>
            <SidebarContextProvider>
                <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                        {/* HOME PAGE - Main hub */}
                        <Route path="/" element={<HomePage />} />

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

                        {/* PUBLIC ROUTES - Ungated, accessible to all */}
                        <Route element={<PublicLayout />}>
                            <Route path="/jobs" element={<JobsPage />} />
                            {/* External job detail (static "e" segment) MUST be
                                registered before /jobs/:slug so it isn't
                                shadowed by the dynamic slug route. */}
                            <Route
                                path="/jobs/e/:id"
                                element={<ExternalJobPage />}
                            />
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
                            <Route path="/events" element={<EventsPage />} />
                            <Route
                                path="/events/:id"
                                element={<EventDetailPage />}
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
                            <Route
                                path="/communities"
                                element={<CommunitiesPage />}
                            />
                            {/* Legacy/external links used "/community" (singular);
                                keep a redirect as a safety net now that all
                                in-app links point to "/communities" directly. */}
                            <Route
                                path="/community"
                                element={<Navigate to="/communities" replace />}
                            />
                            <Route
                                path="/communities/:id"
                                element={<CommunityDetailPage />}
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
                        </Route>

                        {/* DASHBOARD ROUTES - With sidebar for authenticated users */}
                        <Route element={<DashboardLayout />}>
                            {/* Keep legacy dashboard route for backward compatibility */}
                            <Route path="/dashboard" element={<Dashboard />} />
                            {/* PROTECTED ROUTES - Require authentication */}
                            <Route
                                path="/account"
                                element={
                                    <PrivateRoute>
                                        <Account />
                                    </PrivateRoute>
                                }
                            />
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
