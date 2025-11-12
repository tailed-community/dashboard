import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/fetch";
import { Loader2, Briefcase, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Job } from "@/types/jobs";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger, BreadcrumbSeparator } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";

type AppliedJob = Job & {
    appliedAt?: string; // If we have application date
};

export default function AppliedJobsPage() {
    const navigate = useNavigate();
    const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setScrolled(window.scrollY > 30);
        };
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        async function fetchAppliedJobs() {
            try {
                setLoading(true);
                setError(null);

                // First, get the applied job IDs
                const appliedIdsRes = await apiFetch("/job/applied-jobs");

                // Handle case where profile doesn't exist yet
                if (!appliedIdsRes.ok) {
                    // If profile not found (404), treat as empty applied jobs list
                    if (appliedIdsRes.status === 404) {
                        setAppliedJobs([]);
                        return;
                    }

                    // Try to parse error message
                    try {
                        const errorData = await appliedIdsRes.json();
                        // If profile not found error, treat as empty
                        if (errorData.error === "Profile not found") {
                            setAppliedJobs([]);
                            return;
                        }
                        throw new Error(
                            errorData.error || "Failed to load applied jobs"
                        );
                    } catch (parseError) {
                        // If parsing fails, just show generic error
                        throw new Error("Failed to load applied jobs");
                    }
                }

                const appliedIds = await appliedIdsRes.json();

                if (!Array.isArray(appliedIds) || appliedIds.length === 0) {
                    setAppliedJobs([]);
                    return;
                }

                // Then, fetch each job details
                const jobPromises = appliedIds.map(async (id: string) => {
                    const jobRes = await apiFetch(
                        `/public/jobs/${id}`,
                        {},
                        true
                    );
                    if (jobRes.ok) {
                        const data = await jobRes.json();
                        // Merge job and organization data
                        const jobData = data.job || data;
                        if (data.organization) {
                            jobData.organization = data.organization;
                        }
                        return jobData;
                    }
                    return null;
                });

                const jobs = await Promise.all(jobPromises);
                const validJobs = jobs.filter((job) => job !== null);

                setAppliedJobs(validJobs);
            } catch (err) {
                console.error("Error loading applied jobs:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "An unexpected error occurred"
                );
            } finally {
                setLoading(false);
            }
        }

        fetchAppliedJobs();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <p className="text-destructive mb-4">{error}</p>
                    <Button onClick={() => window.location.reload()}>
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

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
                                <BreadcrumbLink href="/dashboard">
                                    Dashboard
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/jobs/applied">
                                    My Applications
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </header>
            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-3xl font-bold">My Applications</h1>
                    <p className="text-muted-foreground">
                        View all the jobs you've applied to.
                    </p>
                </div>

                {appliedJobs.length === 0 ? (
                    <div className="text-center py-12">
                        <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h2 className="text-xl font-semibold mb-2">
                            No applications yet
                        </h2>
                        <p className="text-muted-foreground">
                            You haven't applied to any jobs yet. Start exploring
                            opportunities!
                        </p>
                    </div>
                ) : (
                    <div className="mt-8">
                        <ul className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            {appliedJobs.map((job) => (
                                <li key={job.id} className="lg:col-span-4">
                                    <Card
                                        className="transition-all cursor-pointer group"
                                        onClick={() =>
                                            navigate(`/jobs/${job.id}`)
                                        }
                                        tabIndex={0}
                                        aria-label={`View job: ${job.title}`}
                                    >
                                        <CardContent className="flex gap-6 items-center p-6">
                                            {/* Logo with luxury border and shadow */}
                                            <div className="flex-shrink-0">
                                                <div className="h-20 w-30 bg-muted flex items-center justify-center rounded-md">
                                                    {job.organization?.logo ? (
                                                        <img
                                                            src={
                                                                job.organization
                                                                    .logo
                                                            }
                                                            alt={`${job.organization.name} logo`}
                                                        />
                                                    ) : (
                                                        <Building2 className="h-6 w-6 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </div>
                                            {/* Main info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors truncate">
                                                        {job.title}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-green-600 border-green-600"
                                                    >
                                                        Applied
                                                    </Badge>
                                                </div>

                                                <span className="font-medium text-gray-700">
                                                    {job.organization?.name ||
                                                        "Unknown Organization"}
                                                </span>
                                                <div className="flex gap-2 mt-2">
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-gray-700 capitalize"
                                                    >
                                                        {job.type}
                                                    </Badge>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-gray-700"
                                                    >
                                                        {job.location}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </>
    );
}
