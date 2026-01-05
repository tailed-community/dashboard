import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
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
