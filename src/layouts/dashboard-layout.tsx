import { AppSidebar } from "@/components/layout/app-sidebar";
import { Outlet } from "react-router-dom";
import { SidebarContextProvider } from "@/contexts/sidebar-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <SidebarContextProvider>
        <AppSidebar />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </SidebarContextProvider>
    </SidebarProvider>
  );
}
