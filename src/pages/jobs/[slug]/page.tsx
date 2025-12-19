import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import {
    Loader2,
    ArrowLeft,
    Briefcase,
    MapPin,
    Calendar,
    ExternalLink,
    Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { type Job, type Organization } from "@/types/jobs";
import { HTMLContent } from "@/components/ui/html-content";
import { Separator } from "@/components/ui/separator";

export default function PublicJobPage() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const sharedId = searchParams.get("sharedId");
    const [job, setJob] = useState<Job | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchJob() {
            try {
                setLoading(true);
                setError(null);

                // Build the endpoint with appropriate query parameters
                let endpoint = `/public/jobs/${slug}`;

                // Add token or sharedId as query parameters if they exist
                if (token) {
                    endpoint += `?token=${encodeURIComponent(token)}`;
                } else if (sharedId) {
                    endpoint += `?sharedId=${encodeURIComponent(sharedId)}`;
                }

                const response = await apiFetch(endpoint, {}, true);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to load job");
                }

                const data = await response.json();

                // Handle nested job and organization structure
                if (data.job) {
                    setJob(data.job);
                } else {
                    // Fallback if API returns job directly instead of nested
                    setJob(data);
                }

                if (data.organization) {
                    setOrganization(data.organization);
                }
            } catch (err) {
                console.error("Error loading job:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "An unexpected error occurred"
                );
            } finally {
                setLoading(false);
            }
        }

        fetchJob();
    }, [slug, token, sharedId]);

    // Format date to readable string
    const formatDate = (dateString?: string) => {
        if (!dateString) return "";

        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            }).format(date);
        } catch (e) {
            return dateString;
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground">Loading job...</p>
                </div>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <h1 className="text-2xl font-bold text-destructive">
                        Error
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        {error ||
                            "This job posting is not available or has expired."}
                    </p>
                    <Button className="mt-4" asChild>
                        <Link to="/">Return to Home</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="mx-auto max-w-3xl">
                <Link
                    to="/dashboard"
                    className="mb-6 flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back to home
                </Link>

                <Card className="border shadow-md">
                    <CardHeader>
                        {organization && (
                            <div className="flex items-center gap-3 mb-4">
                                {organization.logo ? (
                                    <img
                                        src={organization.logo}
                                        alt={`${organization.name} logo`}
                                        className="h-10 w-10 object-contain"
                                    />
                                ) : (
                                    <div className="h-10 w-10 bg-muted flex items-center justify-center rounded-md">
                                        <Building2 className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="text-sm text-muted-foreground">
                                    {organization.name}
                                </div>
                            </div>
                        )}

                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-2xl">
                                    {job.title}
                                </CardTitle>
                                <CardDescription className="mt-2">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center text-muted-foreground">
                                            <Briefcase className="mr-1 h-4 w-4" />
                                            <span>{job.type}</span>
                                        </div>
                                        <div className="flex items-center text-muted-foreground">
                                            <MapPin className="mr-1 h-4 w-4" />
                                            <span>{job.location}</span>
                                        </div>
                                        <div className="flex items-center text-muted-foreground">
                                            <Calendar className="mr-1 h-4 w-4" />
                                            <span>
                                                Posted{" "}
                                                {job.postingDate
                                                    ? formatDate(
                                                          job.postingDate
                                                      )
                                                    : "Recently"}
                                            </span>
                                        </div>
                                    </div>
                                </CardDescription>
                            </div>

                            {/* Status badge removed from here */}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Job description section */}
                        {job.description && (
                            <div>
                                <h2 className="mb-2 font-semibold">
                                    Description
                                </h2>
                                <div className="whitespace-pre-line text-muted-foreground">
                                    {job.description}
                                </div>
                            </div>
                        )}

                        {/* Job requirements section */}
                        {job.requirements &&
                            job.requirements.replace(/<[^>]*>/g, "").trim()
                                .length > 0 && (
                                <div>
                                    <h2 className="mb-2 font-semibold">
                                        Requirements
                                    </h2>
                                    <div className="whitespace-pre-line text-muted-foreground">
                                        <>
                                            <Separator />
                                            <div>
                                                <HTMLContent
                                                    content={
                                                        job.requirements ||
                                                        "<p>No requirements provided.</p>"
                                                    }
                                                    skills={job?.skills || []}
                                                    className="text-md"
                                                />
                                            </div>
                                        </>
                                    </div>
                                </div>
                            )}

                        {/* Additional information section */}
                        <div className="border-t pt-4 mt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {job.postingDate && (
                                    <div>
                                        <p className="text-sm font-medium">
                                            Posted on
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatDate(job.postingDate)}
                                        </p>
                                    </div>
                                )}

                                {job.endPostingDate && (
                                    <div>
                                        <p className="text-sm font-medium">
                                            Application Deadline
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatDate(job.endPostingDate)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" asChild>
                            <Link
                                to={`/jobs/${slug}/apply${
                                    token
                                        ? `?token=${encodeURIComponent(token)}`
                                        : sharedId
                                        ? `?sharedId=${encodeURIComponent(
                                              sharedId
                                          )}`
                                        : ""
                                }`}
                                className="flex items-center justify-center gap-2"
                            >
                                Apply for this position
                                <ExternalLink className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
