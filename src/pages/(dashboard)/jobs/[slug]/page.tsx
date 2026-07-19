import { useState, useEffect } from "react";
import {
    useParams,
    Link,
    useSearchParams,
    useNavigate,
} from "react-router-dom";
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
import { PlaygroundButton } from "@/components/playground/playground-button";
import { PreloadLink } from "@/components/preload-link";
import { type Job, type Organization } from "@/types/jobs";
import { HTMLContent } from "@/components/ui/html-content";
import { Seo } from "@/components/seo";

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function toIsoDate(dateString?: string): string | undefined {
    if (!dateString) return undefined;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
}

function mapEmploymentType(type?: string): string | undefined {
    if (!type) return undefined;
    const normalized = type.trim().toLowerCase();
    const map: Record<string, string> = {
        "full-time": "FULL_TIME",
        "full time": "FULL_TIME",
        fulltime: "FULL_TIME",
        "part-time": "PART_TIME",
        "part time": "PART_TIME",
        parttime: "PART_TIME",
        internship: "INTERN",
        intern: "INTERN",
        "co-op": "INTERN",
        coop: "INTERN",
        contract: "CONTRACTOR",
        contractor: "CONTRACTOR",
        temporary: "TEMPORARY",
        volunteer: "VOLUNTEER",
    };
    return map[normalized];
}

export default function PublicJobPage() {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const sharedId = searchParams.get("sharedId");
    const [job, setJob] = useState<Job | null>(null);
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasApplied, setHasApplied] = useState(false);
    const navigate = useNavigate();

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

                // Fetch job data and applied jobs in parallel
                const [jobResponse, appliedJobsResponse] = await Promise.all([
                    apiFetch(endpoint, {}, true),
                    apiFetch("/job/applied-jobs").catch(() => null), // Don't fail if user is not authenticated
                ]);

                if (!jobResponse.ok) {
                    const errorData = await jobResponse.json();
                    throw new Error(errorData.error || "Failed to load job");
                }

                const data = await jobResponse.json();

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

                // Check if user has already applied to this job
                if (appliedJobsResponse && appliedJobsResponse.ok) {
                    const appliedJobIds = await appliedJobsResponse.json();
                    // Only check if response is an array (successful profile fetch)
                    if (Array.isArray(appliedJobIds)) {
                        const jobId = data.job?.id || data.id;
                        const appliedIds = appliedJobIds.map(
                            (item: any) => item.jobId
                        );
                        setHasApplied(appliedIds.includes(jobId));
                    }
                    // If it's not an array (e.g., {error: "Profile not found"}), hasApplied remains false
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
            <div className="mx-auto max-w-3xl px-5 py-16 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-joy-grass" />
                <p className="mt-2 text-joy-ink-muted">Loading job...</p>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="mx-auto max-w-md px-5 py-16 text-center">
                <h1 className="joy-display text-2xl font-extrabold text-joy-ink">
                    Error
                </h1>
                <p className="mt-2 text-joy-ink-muted">
                    {error ||
                        "This job posting is not available or has expired."}
                </p>
                <div className="mt-5 flex justify-center">
                    <PlaygroundButton to="/jobs">Return to Home</PlaygroundButton>
                </div>
            </div>
        );
    }

    const orgName = organization?.name ?? "Tail'ed Community partner";
    const seoDescription = job.description
        ? truncate(stripHtml(job.description), 160)
        : `${job.title} at ${orgName} — apply now on Tail'ed, the free job board for students.`;
    const seoImage =
        organization?.logo && /^https?:\/\//.test(organization.logo)
            ? organization.logo
            : undefined;

    const jobPostingJsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: job.title,
        description: job.description
            ? truncate(stripHtml(job.description), 500)
            : seoDescription,
        hiringOrganization: {
            "@type": "Organization",
            name: orgName,
        },
    };

    const datePosted = toIsoDate(job.postingDate);
    if (datePosted) jobPostingJsonLd.datePosted = datePosted;

    const validThrough = toIsoDate(job.endPostingDate);
    if (validThrough) jobPostingJsonLd.validThrough = validThrough;

    const employmentType = mapEmploymentType(job.type);
    if (employmentType) jobPostingJsonLd.employmentType = employmentType;

    if (job.location) {
        jobPostingJsonLd.jobLocation = {
            "@type": "Place",
            address: {
                "@type": "PostalAddress",
                addressLocality: job.location,
            },
        };
    }

    if (job.salary && (job.salary.min || job.salary.max)) {
        jobPostingJsonLd.baseSalary = {
            "@type": "MonetaryAmount",
            currency: "CAD",
            value: {
                "@type": "QuantitativeValue",
                ...(job.salary.min ? { minValue: job.salary.min } : {}),
                ...(job.salary.max ? { maxValue: job.salary.max } : {}),
                unitText: "YEAR",
            },
        };
    }

    return (
        <div className="mx-auto max-w-3xl px-5 py-10">
            <Seo
                title={`${job.title} at ${orgName}`}
                description={seoDescription}
                path={`/jobs/${slug}`}
                image={seoImage}
                jsonLd={jobPostingJsonLd}
            />
            <Link
                to=".."
                onClick={(e) => {
                    e.preventDefault();
                    navigate(-1);
                }}
                className="mb-6 inline-flex items-center text-sm font-semibold text-joy-ink-muted transition hover:text-joy-ink"
            >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
            </Link>

            <div className="rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm md:p-8">
                {/* Header */}
                {organization && (
                    <div className="mb-4 flex items-center gap-3">
                        {organization.logo ? (
                            <img
                                src={organization.logo}
                                alt={`${organization.name} logo`}
                                className="h-20 w-20 object-contain"
                            />
                        ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-joy-grass/10 text-joy-grass">
                                <Building2 className="h-6 w-6" />
                            </div>
                        )}
                        <PreloadLink
                            to={`/companies/${organization.slug || organization.id}`}
                            className="text-lg font-semibold text-joy-ink-muted transition-colors hover:text-joy-ink hover:underline"
                        >
                            {organization.name}
                        </PreloadLink>
                    </div>
                )}

                <div>
                    <h1 className="joy-display text-2xl font-extrabold leading-tight text-joy-ink sm:text-3xl">
                        {job.title}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-joy-ink-muted">
                        <div className="flex items-center">
                            <Briefcase className="mr-1 h-4 w-4" />
                            <span>{job.type}</span>
                        </div>
                        <div className="flex items-center">
                            <MapPin className="mr-1 h-4 w-4" />
                            <span>{job.location}</span>
                        </div>
                        <div className="flex items-center">
                            <Calendar className="mr-1 h-4 w-4" />
                            <span>
                                Posted{" "}
                                {job.postingDate
                                    ? formatDate(job.postingDate)
                                    : "Recently"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="mt-6 space-y-6">
                    {/* Job description section */}
                    {job.description && (
                        <div>
                            <HTMLContent
                                content={
                                    job.description ||
                                    "<p>No description provided.</p>"
                                }
                                className="text-md"
                            />
                        </div>
                    )}

                    {/* Job requirements section */}
                    {job.requirements &&
                        job.requirements.replace(/<[^>]*>/g, "").trim().length >
                            0 && (
                            <>
                                <div className="border-t border-joy-ink/8" />
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
                        )}

                    {/* Additional information section */}
                    <div className="mt-4 border-t border-joy-ink/8 pt-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {job.postingDate && (
                                <div>
                                    <p className="text-sm font-semibold text-joy-ink">
                                        Posted on
                                    </p>
                                    <p className="text-sm text-joy-ink-muted">
                                        {formatDate(job.postingDate)}
                                    </p>
                                </div>
                            )}

                            {job.endPostingDate && (
                                <div>
                                    <p className="text-sm font-semibold text-joy-ink">
                                        Application Deadline
                                    </p>
                                    <p className="text-sm text-joy-ink-muted">
                                        {formatDate(job.endPostingDate)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer / CTA */}
                <div className="mt-8">
                    {hasApplied ? (
                        <button
                            type="button"
                            disabled
                            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-joy-ink/8 px-5 py-2.5 text-sm font-bold text-joy-ink-muted"
                        >
                            Applied
                        </button>
                    ) : (
                        <PlaygroundButton
                            to={`/jobs/${slug}/apply${
                                token
                                    ? `?token=${encodeURIComponent(token)}`
                                    : sharedId
                                    ? `?sharedId=${encodeURIComponent(sharedId)}`
                                    : ""
                            }`}
                            className="w-full"
                        >
                            Apply for this position
                            <ExternalLink className="h-4 w-4" />
                        </PlaygroundButton>
                    )}
                </div>
            </div>
        </div>
    );
}
