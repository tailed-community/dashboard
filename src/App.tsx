import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
const CompaniesPage = lazy(() => import("./pages/companies/page"));
const EventsPage = lazy(() => import("./pages/events/page"));
const EventDetailPage = lazy(() => import("./pages/events/[id]/page"));
const CreateEventPage = lazy(() => import("./pages/events/create/page"));
const AssociationPage = lazy(() => import("./pages/association/page"));
const CreateAssociationPage = lazy(() => import("./pages/association/create/page"));
const SpotlightPage = lazy(() => import("./pages/spotlight/page"));
const ExplorePage = lazy(() => import("./pages/explore/page"));
const AboutPage = lazy(() => import("./pages/about/page"));

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
                            <Route
                                path="/jobs/:slug"
                                element={<PublicJobPage />}
                            />
                            <Route path="/companies" element={<CompaniesPage />} />
                            <Route path="/events" element={<EventsPage />} />
                            <Route path="/events/:id" element={<EventDetailPage />} />
                            <Route
                                path="/events/create"
                                element={
                                    <PrivateRoute>
                                        <CreateEventPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route path="/association" element={<AssociationPage />} />
                            <Route
                                path="/association/create"
                                element={
                                    <PrivateRoute>
                                        <CreateAssociationPage />
                                    </PrivateRoute>
                                }
                            />
                            <Route path="/spotlight" element={<SpotlightPage />} />
                            <Route path="/explore" element={<ExplorePage />} />
                            <Route path="/about" element={<AboutPage />} />
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
