import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import SignIn from "./pages/(auth)/sign-in/page";
import AuthCallback from "./pages/(auth)/auth/callback/page";

import Dashboard from "./pages/(dashboard)/page";
import DashboardLayout from "./layouts/dashboard-layout";
import Account from "./pages/(dashboard)/account/page";
import JobApplyPage from "./pages/(dashboard)/jobs/[slug]/apply/page";
import PublicJobPage from "./pages/(dashboard)/jobs/[slug]/page";
import LandingPage from "./pages/landing/page";
import AppliedJobsPage from "./pages/(dashboard)/jobs/applied/page";

import { SidebarContextProvider } from "./contexts/sidebar-context";

function App() {
  return (
    <Router>
      <SidebarContextProvider>
        <Routes>
          {/* PUBLIC LANDING */}
          <Route path="/" element={<LandingPage />} />
          {/* AUTHENTICATION */}
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/account" element={<Account />} />
            <Route path="/jobs/applied" element={<AppliedJobsPage />} />
            <Route path="/jobs/:slug" element={<PublicJobPage />} />
            <Route path="/jobs/:slug/apply" element={<JobApplyPage />} />
          </Route>
        </Routes>
      </SidebarContextProvider>
      <Toaster />
    </Router>
  );
}

export default App;
