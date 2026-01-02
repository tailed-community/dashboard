import * as React from "react";
import {
    BriefcaseBusiness,
    ChartPie,
    Command,
    Frame,
    LifeBuoy,
    Map,
    PieChart,
    Send,
} from "lucide-react";

import { NavMain } from "@/components/layout/nav-main";
import { NavSecondary } from "@/components/layout/nav-secondary";
import { NavUser } from "@/components/layout/nav-user";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link } from "react-router-dom";
import { useSidebarContext } from "@/contexts/sidebar-context";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

const data = {
    // Company and user data will be fetched dynamically
    navMain: [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: ChartPie,
            isActive: true,
        },
        {
            title: "Job Board",
            url: "/jobs",
            icon: Command,
            isActive: false,
        },
        {
            title: "My Applications",
            url: "/jobs/applied",
            icon: BriefcaseBusiness,
            isActive: false,
        },
    ],
    navSecondary: [
        {
            title: "Support",
            url: "mailto:support@tailed.ca",
            icon: LifeBuoy,
        },
        {
            title: "Feedback",
            url: "mailto:feedback@tailed.ca",
            icon: Send,
        },
    ],
    projects: [
        {
            name: "Design Engineering",
            url: "#",
            icon: Frame,
        },
        {
            name: "Sales & Marketing",
            url: "#",
            icon: PieChart,
        },
        {
            name: "Travel",
            url: "#",
            icon: Map,
        },
    ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { user, loading } = useSidebarContext() || {
        user: null,
        loading: true,
    };

    useEffect(() => {}, [user]);

    // Filter nav items based on user authentication
    const navMainItems = user
        ? data.navMain
        : data.navMain.filter(
              (item) =>
                  item.title !== "My Applications" && item.title !== "Dashboard"
          );

    return (
        <Sidebar variant="inset" {...props}>
            <SidebarContent>
                <NavMain items={navMainItems} />
                {/*<NavProjects projects={data.projects} />*/}
                <NavSecondary items={data.navSecondary} className="mt-auto" />
            </SidebarContent>
            <SidebarFooter>
                {loading ? (
                    <div className="flex items-center gap-3 px-2 py-1.5">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="mt-1 h-3 w-32" />
                        </div>
                    </div>
                ) : (
                    <NavUser user={user} />
                )}
            </SidebarFooter>
        </Sidebar>
    );
}
