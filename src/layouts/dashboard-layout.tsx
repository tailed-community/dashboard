import { AppSidebar } from "@/components/layout/app-sidebar";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
