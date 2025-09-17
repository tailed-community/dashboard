import { AppSidebar } from "@/components/layout/app-sidebar";
import { Outlet } from "react-router-dom";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
