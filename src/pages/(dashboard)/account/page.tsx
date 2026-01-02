import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbPage,
    BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import AccountPage from "@/pages/(dashboard)/account/account-new";
import { useState, useEffect } from "react";

export default function Page() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 30);
        };
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return (
        <>
            <header
                className={`sticky top-0 z-[50] bg-white flex h-16 shrink-0 items-center gap-2 ${
                    scrolled ? "shadow-sm" : ""
                }`}
            >
                <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Account</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min">
                    <AccountPage />
                </div>
            </div>
        </>
    );
}
