import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { BreadcrumbSeparator } from "@/components/ui/sidebar";
import { UnifiedJobBoard } from "@/components/unified-job-board";
import { useState, useEffect } from "react";

export default function JobsPage() {
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
                className={`sticky top-0 z-[50] bg-card border-b border-border flex h-16 shrink-0 items-center gap-2 ${
                    scrolled ? "shadow-soft" : ""
                }`}
            >
                <div className="flex items-center gap-2 px-6">
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                <BreadcrumbLink href="/">
                                    Home
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/jobs">
                                    Jobs
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-6 p-6">
                <div className="max-w-6xl mx-auto w-full">
                    <h1 className="text-3xl font-bold mb-2">All Opportunities</h1>
                    <p className="text-muted-foreground mb-6">Browse all available positions</p>
                    <UnifiedJobBoard />
                </div>
            </div>
        </>
    );
}
