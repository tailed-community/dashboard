import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Bookmark,
    Briefcase,
    Building2,
    Calendar,
    ExternalLink,
    GraduationCap,
    MapPin,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Seo, SITE_URL } from "@/components/seo";
import { fetchExternalJobs, activeExternalJobs, toMillis } from "@/lib/external-jobs";
import { type ExternalJob } from "@/types/jobs";
import {
    formatLocationForDisplay,
    normalizeLocations,
    normalizeSearchText,
    type NormalizedJobLocation,
} from "@/lib/location-normalization";
import { cn } from "@/lib/utils";
import { useSavedJobs } from "@/lib/saved-jobs";
import { JobAlertSignup } from "@/components/capture/job-alert-signup";
import { trackEvent } from "@/lib/analytics";

const TYPE_LABEL: Record<ExternalJob["type"], string> = {
    internship: "Internship",
    "new-grad": "New Grad",
};

function formatPostedDate(epoch?: number): string | null {
    if (!epoch) return null;
    const date = new Date(toMillis(epoch));
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(date);
}

function buildJobPostingJsonLd(
    job: ExternalJob,
    locations: NormalizedJobLocation[],
    description: string,
    canonicalUrl: string
) {
    const jsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: job.title,
        description,
        hiringOrganization: {
            "@type": "Organization",
            name: job.company_name,
        },
        employmentType: job.type === "internship" ? "INTERN" : "FULL_TIME",
        directApply: false,
        url: canonicalUrl,
    };

    const datePostedIso = job.date_posted
        ? new Date(toMillis(job.date_posted)).toISOString().slice(0, 10)
        : null;
    if (datePostedIso) jsonLd.datePosted = datePostedIso;

    type PostalAddress = { "@type": "PostalAddress" } & Record<string, string>;
    type PlaceEntry = { "@type": "Place"; address: PostalAddress };

    const jobLocation: PlaceEntry[] = locations
        .map((loc): PlaceEntry | null => {
            const address: Record<string, string> = {};
            if (loc.normalized.city) address.addressLocality = loc.normalized.city;
            if (loc.normalized.region) address.addressRegion = loc.normalized.region;
            if (loc.normalized.country_code)
                address.addressCountry = loc.normalized.country_code;
            if (Object.keys(address).length === 0) return null;
            return {
                "@type": "Place",
                address: { "@type": "PostalAddress", ...address },
            };
        })
        .filter((entry): entry is PlaceEntry => entry !== null);
    if (jobLocation.length > 0) jsonLd.jobLocation = jobLocation;

    const remoteLocation = locations.find((loc) => loc.type === "remote");
    if (remoteLocation) {
        jsonLd.jobLocationType = "TELECOMMUTE";
        if (remoteLocation.normalized.country) {
            jsonLd.applicantLocationRequirements = {
                "@type": "Country",
                name: remoteLocation.normalized.country,
            };
        }
    }

    return jsonLd;
}

function JobDetailSkeleton() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="mx-auto max-w-5xl">
                <Skeleton className="mb-6 h-4 w-24" />
                <Card className="border shadow-md">
                    <CardHeader>
                        <Skeleton className="mb-4 h-4 w-40" />
                        <Skeleton className="h-8 w-2/3" />
                        <div className="mt-3 flex gap-3">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

export default function ExternalJobPage() {
    const { id: rawId } = useParams<{ id: string }>();
    const id = rawId ? decodeURIComponent(rawId) : "";

    const [jobs, setJobs] = useState<ExternalJob[] | null>(null);
    const [loading, setLoading] = useState(true);
    const { isSaved, toggleSaved } = useSavedJobs();

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchExternalJobs()
            .then((data) => {
                if (!cancelled) setJobs(data);
            })
            .catch((err) => {
                console.error("Failed to load external jobs:", err);
                if (!cancelled) setJobs([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [id]);

    const job = useMemo(() => {
        if (!jobs) return null;
        return jobs.find((candidate) => candidate.id === id) || null;
    }, [jobs, id]);

    useEffect(() => {
        if (job) trackEvent("job_detail_view", { jobId: job.id });
    }, [job]);

    // Per-job normalized locations, keyed only on the jobs array (not on
    // which job is currently open) so navigating between job detail pages
    // reuses this instead of rescanning all ~11k jobs on every navigation.
    const normalizedLocationsByJobId = useMemo(() => {
        const output = new Map<string, NormalizedJobLocation[]>();
        (jobs || []).forEach((candidate) => {
            output.set(candidate.id, normalizeLocations(candidate.locations || []));
        });
        return output;
    }, [jobs]);

    const jobLocations = useMemo(
        () => (job ? normalizedLocationsByJobId.get(job.id) || [] : []),
        [job, normalizedLocationsByJobId]
    );

    // "More jobs like this": score by same company (highest), then
    // overlapping normalized city/region, then same type + season, then
    // just same type.
    const relatedJobs = useMemo(() => {
        if (!job || !jobs) return [];
        const candidates = activeExternalJobs(jobs).filter(
            (candidate) => candidate.id !== job.id
        );
        const scored = candidates
            .map((candidate) => {
                const sameCompany =
                    normalizeSearchText(candidate.company_name) ===
                    normalizeSearchText(job.company_name);
                const sameType = candidate.type === job.type;
                const sameSeason =
                    Boolean(job.season) && job.season === candidate.season;

                let score = 0;
                if (sameCompany) {
                    score = 100;
                } else {
                    const candidateLocations =
                        normalizedLocationsByJobId.get(candidate.id) || [];
                    const overlaps = jobLocations.some((jl) =>
                        candidateLocations.some(
                            (cl) =>
                                (jl.normalized.city &&
                                    jl.normalized.city === cl.normalized.city) ||
                                (jl.normalized.region &&
                                    jl.normalized.region === cl.normalized.region)
                        )
                    );
                    if (overlaps) {
                        score = 50;
                    } else if (sameType && sameSeason) {
                        score = 20;
                    } else if (sameType) {
                        score = 5;
                    }
                }
                return { candidate, score };
            })
            .filter((entry) => entry.score > 0);

        scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (b.candidate.date_posted || 0) - (a.candidate.date_posted || 0);
        });

        return scored.slice(0, 6).map((entry) => entry.candidate);
    }, [job, jobs, jobLocations, normalizedLocationsByJobId]);

    if (loading) {
        return <JobDetailSkeleton />;
    }

    if (!job) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
                <div className="w-full max-w-md text-center">
                    <h1 className="text-2xl font-bold">Job not found</h1>
                    <p className="mt-2 text-muted-foreground">
                        This listing may have been removed, filled, or the link is
                        incorrect.
                    </p>
                    <Button className="mt-4" asChild>
                        <Link to="/jobs">Browse all jobs</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const locationSummary =
        formatLocationForDisplay(jobLocations) || "Location not specified";
    const roleLabel =
        job.type === "internship" ? "Internship role" : "New-grad role";
    const description = `Apply for ${job.title} at ${job.company_name}. ${roleLabel} in ${locationSummary}. Found on Tail'ed — free job board for students.`;
    const path = `/jobs/e/${encodeURIComponent(job.id)}`;
    const canonicalUrl = `${SITE_URL}${path}`;
    const postedDate = formatPostedDate(job.date_posted);
    const postedLabel = job.date_posted_label || (postedDate ? `Posted ${postedDate}` : null);
    const jsonLd = buildJobPostingJsonLd(job, jobLocations, description, canonicalUrl);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <Seo
                title={`${job.title} at ${job.company_name}`}
                description={description}
                path={path}
                jsonLd={jsonLd}
            />
            <div className="mx-auto max-w-5xl">
                <Link
                    to="/jobs"
                    className="mb-6 flex items-center text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back to jobs
                </Link>

                <Card className="border shadow-md">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 bg-muted flex items-center justify-center rounded-md">
                                <Building2 className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <span className="text-lg text-muted-foreground">
                                {job.company_name}
                            </span>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-2xl">{job.title}</CardTitle>
                            <button
                                type="button"
                                onClick={() => {
                                    const { saved } = toggleSaved(job.id);
                                    if (saved) trackEvent("job_saved", { jobId: job.id, source: "detail" });
                                }}
                                aria-label={isSaved(job.id) ? "Remove from saved jobs" : "Save job"}
                                className="p-2 rounded-md hover:bg-muted transition-colors shrink-0"
                            >
                                <Bookmark
                                    className={cn(
                                        "h-5 w-5",
                                        isSaved(job.id) ? "fill-current text-primary" : "text-muted-foreground"
                                    )}
                                />
                            </button>
                        </div>
                        <CardDescription className="mt-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center text-muted-foreground">
                                    <MapPin className="mr-1 h-4 w-4" />
                                    <span>{locationSummary}</span>
                                </div>
                                {postedLabel && (
                                    <div className="flex items-center text-muted-foreground">
                                        <Calendar className="mr-1 h-4 w-4" />
                                        <span>{postedLabel}</span>
                                    </div>
                                )}
                            </div>
                        </CardDescription>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <Badge
                                variant={
                                    job.type === "internship" ? "secondary" : "default"
                                }
                            >
                                {TYPE_LABEL[job.type]}
                            </Badge>
                            {job.category && (
                                <Badge variant="outline">{job.category}</Badge>
                            )}
                            {job.terms?.map((term) => (
                                <Badge key={term} variant="outline">
                                    <Calendar className="h-3 w-3" />
                                    {term}
                                </Badge>
                            ))}
                            {job.degrees?.map((degree) => (
                                <Badge key={degree} variant="outline">
                                    <GraduationCap className="h-3 w-3" />
                                    {degree}
                                </Badge>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            This listing is posted on {job.company_name}'s own careers
                            site. Tail'ed surfaces it as part of our free job board for
                            students — applying happens on the employer's site.
                        </p>
                    </CardContent>
                    <CardFooter className="flex flex-col items-stretch gap-4">
                        <Button
                            className="w-full"
                            size="lg"
                            asChild
                            onClick={() => trackEvent("job_apply_click", { jobId: job.id, source: "detail" })}
                        >
                            <a
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2"
                            >
                                <Briefcase className="h-4 w-4" />
                                Apply on company site
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>
                        <div className="rounded-lg border bg-muted/40 p-4">
                            <p className="text-sm font-medium mb-2">Jobs like this, daily</p>
                            <JobAlertSignup
                                source="job_detail"
                                variant="inline"
                                query={job.title}
                                jobType={job.type}
                            />
                        </div>
                    </CardFooter>
                </Card>

                {relatedJobs.length > 0 && (
                    <div className="mt-10">
                        <h2 className="text-xl font-semibold mb-4">
                            More jobs like this
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {relatedJobs.map((related) => {
                                const relatedLocations =
                                    normalizedLocationsByJobId.get(related.id) || [];
                                return (
                                    <Link
                                        key={related.id}
                                        to={`/jobs/e/${encodeURIComponent(related.id)}`}
                                        className="block"
                                    >
                                        <Card className="h-full hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="font-semibold text-sm">
                                                            {related.title}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {related.company_name}
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        variant={
                                                            related.type === "internship"
                                                                ? "secondary"
                                                                : "default"
                                                        }
                                                    >
                                                        {TYPE_LABEL[related.type]}
                                                    </Badge>
                                                </div>
                                                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />
                                                    <span>
                                                        {formatLocationForDisplay(
                                                            relatedLocations
                                                        ) || "Location not specified"}
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
