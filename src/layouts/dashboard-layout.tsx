import { Header } from "@/components/landing/header";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useSidebarContext } from "@/contexts/sidebar-context";
import { useEffect } from "react";

export default function DashboardLayout() {
  const { onboardingRequired, loading } = useSidebarContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirect to onboarding if required, but not if already on onboarding page
    if (!loading && onboardingRequired && location.pathname !== "/student-onboarding") {
      navigate("/student-onboarding");
    }
  }, [onboardingRequired, loading, navigate, location]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
