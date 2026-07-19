import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink, GraduationCap, MapPin } from "lucide-react";
import { Seo, SITE_URL } from "@/components/seo";
import { trackEvent } from "@/lib/analytics";
import { fetchExternalJobs, activeExternalJobs, formatPostedLabel, toMillis } from "@/lib/external-jobs";
import {
    formatLocationForDisplay,
    normalizeLocations,
    normalizeSearchText,
    type NormalizedJobLocation,
} from "@/lib/location-normalization";
import type { ExternalJob } from "@/types/jobs";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { jobTypeChipClass, jobTypeChipLabel } from "@/components/playground/joy-primitives";
import { JoyJobRow } from "@/components/playground/joy-job-row";

/**
 * NEW joy-styled external job detail (Phase D of the joy design migration).
 * Adapts `src/pages/design-lab/playground-job-detail.tsx` for production:
 * fetches the external feed directly (not through `useAllJobs`, matching
 * `ExternalJobPage`'s exact lookup semantics — inactive jobs still resolve
 * for direct links, only "more roles" excludes them), and adds Seo + a
 * JobPosting JSON-LD block + `job_detail_view`/`job_apply_click` tracking to
 * match the current live `ExternalJobPage`.
 *
 * NOT yet wired into a route. Phase G decides whether this replaces
 * `ExternalJobPage` at `/jobs/e/:id` or `ExternalJobPage` stays as-is — see
 * the Phase D report for the recommendation.
 */

/** Neutral outline chip for secondary metadata (category / term / degree). */
const NEUTRAL_CHIP_CLASS =
    "inline-flex items-center gap-1 rounded-full border border-joy-ink/12 px-2.5 py-0.5 text-xs font-bold text-joy-ink-muted";

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
        hiringOrganization: { "@type": "Organization", name: job.company_name },
        employmentType: job.type === "internship" ? "INTERN" : "FULL_TIME",
        directApply: false,
        url: canonicalUrl,
    };

    const datePostedIso = job.date_posted ? new Date(toMillis(job.date_posted)).toISOString().slice(0, 10) : null;
    if (datePostedIso) jsonLd.datePosted = datePostedIso;

    type PostalAddress = { "@type": "PostalAddress" } & Record<string, string>;
    type PlaceEntry = { "@type": "Place"; address: PostalAddress };

    const jobLocation: PlaceEntry[] = locations
        .map((loc): PlaceEntry | null => {
            const address: Record<string, string> = {};
            if (loc.normalized.city) address.addressLocality = loc.normalized.city;
            if (loc.normalized.region) address.addressRegion = loc.normalized.region;
            if (loc.normalized.country_code) address.addressCountry = loc.normalized.country_code;
            if (Object.keys(address).length === 0) return null;
            return { "@type": "Place", address: { "@type": "PostalAddress", ...address } };
        })
        .filter((entry): entry is PlaceEntry => entry !== null);
    if (jobLocation.length > 0) jsonLd.jobLocation = jobLocation;

    const remoteLocation = locations.find((loc) => loc.type === "remote");
    if (remoteLocation) {
        jsonLd.jobLocationType = "TELECOMMUTE";
        if (remoteLocation.normalized.country) {
            jsonLd.applicantLocationRequirements = { "@type": "Country", name: remoteLocation.normalized.country };
        }
    }

    return jsonLd;
}

function DetailSkeleton() {
    return (
        <section className="px-5 py-10">
            <div className="mx-auto max-w-3xl">
                <div className="h-4 w-32 animate-pulse rounded-full bg-joy-ink/8" />
                <div className="mt-6 rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm sm:p-8">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-joy-ink/8" />
                    <div className="mt-4 h-8 w-2/3 animate-pulse rounded-lg bg-joy-ink/8" />
                    <div className="mt-3 flex gap-2">
                        <div className="h-5 w-20 animate-pulse rounded-full bg-joy-ink/8" />
                        <div className="h-5 w-28 animate-pulse rounded-full bg-joy-ink/8" />
                    </div>
                    <div className="mt-6 h-10 w-40 animate-pulse rounded-xl bg-joy-ink/8" />
                </div>
            </div>
        </section>
    );
}

function NotFoundState() {
    return (
        <>
            <Seo title="Job not found" description="This listing may have been removed or filled." noSuffix={false} />
            <section className="px-5 py-16">
                <div className="mx-auto max-w-xl text-center">
                    <p className="joy-display text-2xl font-extrabold text-joy-ink">Hmm, we can&apos;t find that role</p>
                    <p className="mt-2 text-sm text-joy-ink-muted">
                        It may have been filled, pulled by the employer, or the link is off. The rest of the board is
                        still very much alive.
                    </p>
                    <PlaygroundButton to={LIVE_ROUTES.jobs} className="mt-6">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Back to the job board
                    </PlaygroundButton>
                </div>
            </section>
        </>
    );
}

export default function JoyExternalJobPage() {
    const { id: rawId } = useParams<{ id: string }>();
    const id = rawId ? decodeURIComponent(rawId) : "";

    const [jobs, setJobs] = useState<ExternalJob[] | null>(null);
    const [loading, setLoading] = useState(true);

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

    const job = useMemo(() => (jobs ? jobs.find((candidate) => candidate.id === id) || null : null), [jobs, id]);

    useEffect(() => {
        if (job) trackEvent("job_detail_view", { jobId: job.id });
    }, [job]);

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

    // "More roles like this": same company first, then overlapping
    // city/region, then same type + season, then just same type — same
    // scoring as ExternalJobPage's relatedJobs.
    const relatedJobs = useMemo(() => {
        if (!job || !jobs) return [];
        const candidates = activeExternalJobs(jobs).filter((candidate) => candidate.id !== job.id);
        const scored = candidates
            .map((candidate) => {
                const sameCompany = normalizeSearchText(candidate.company_name) === normalizeSearchText(job.company_name);
                const sameType = candidate.type === job.type;
                const sameSeason = Boolean(job.season) && job.season === candidate.season;

                let score = 0;
                if (sameCompany) {
                    score = 100;
                } else {
                    const candidateLocations = normalizedLocationsByJobId.get(candidate.id) || [];
                    const overlaps = jobLocations.some((jl) =>
                        candidateLocations.some(
                            (cl) =>
                                (jl.normalized.city && jl.normalized.city === cl.normalized.city) ||
                                (jl.normalized.region && jl.normalized.region === cl.normalized.region)
                        )
                    );
                    if (overlaps) score = 50;
                    else if (sameType && sameSeason) score = 20;
                    else if (sameType) score = 5;
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
        return (
            <div style={{ colorScheme: "light" }}>
                <PlaygroundShell routes={LIVE_ROUTES} showSwitcher={false} activeNav={null} cta={{ label: "Get alerts", to: LIVE_ROUTES.alertBuilder }}>
                    <DetailSkeleton />
                </PlaygroundShell>
            </div>
        );
    }

    if (!job) {
        return (
            <div style={{ colorScheme: "light" }}>
                <PlaygroundShell routes={LIVE_ROUTES} showSwitcher={false} activeNav={null} cta={{ label: "Get alerts", to: LIVE_ROUTES.alertBuilder }}>
                    <NotFoundState />
                </PlaygroundShell>
            </div>
        );
    }

    const locationSummary = formatLocationForDisplay(jobLocations) || "Location not specified";
    const postedLabel = formatPostedLabel(job);
    const roleLabel = job.type === "internship" ? "Internship role" : "New-grad role";
    const description = `Apply for ${job.title} at ${job.company_name}. ${roleLabel} in ${locationSummary}. Found on Tail'ed Community — free job board for students.`;
    const path = `/jobs/e/${encodeURIComponent(job.id)}`;
    const canonicalUrl = `${SITE_URL}${path}`;
    const jsonLd = buildJobPostingJsonLd(job, jobLocations, description, canonicalUrl);

    return (
        // See joy-page.tsx for why colorScheme:"light" is enough here — joy
        // tokens have no `.dark` override and nothing on this page uses a
        // `dark:` variant.
        <div style={{ colorScheme: "light" }}>
            <Seo title={`${job.title} at ${job.company_name}`} description={description} path={path} jsonLd={jsonLd} />
            <PlaygroundShell
                routes={LIVE_ROUTES}
                showSwitcher={false}
                activeNav={null}
                cta={{ label: "Get alerts", to: LIVE_ROUTES.alertBuilder }}
            >
                <section className="px-5 pb-4 pt-8">
                    <div className="mx-auto max-w-3xl">
                        <PlaygroundButton to={LIVE_ROUTES.jobs} variant="quiet" className="!px-0 !py-0">
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Back to the job board
                        </PlaygroundButton>
                    </div>
                </section>

                <section className="joy-swap px-5 pb-8">
                    <div className="mx-auto max-w-3xl">
                        <div className="rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm sm:p-8">
                            <p className="text-sm font-semibold text-joy-ink-muted">{job.company_name}</p>
                            <h1 className="joy-display mt-1 text-3xl font-extrabold leading-[1.1] text-joy-ink sm:text-4xl">
                                {job.title}
                            </h1>

                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${jobTypeChipClass(job.type)}`}>
                                    {jobTypeChipLabel(job.type)}
                                </span>
                                {job.category && <span className={NEUTRAL_CHIP_CLASS}>{job.category}</span>}
                                {job.terms?.map((term) => (
                                    <span key={term} className={NEUTRAL_CHIP_CLASS}>
                                        <Calendar className="h-3 w-3" aria-hidden="true" />
                                        {term}
                                    </span>
                                ))}
                                {job.degrees?.map((degree) => (
                                    <span key={degree} className={NEUTRAL_CHIP_CLASS}>
                                        <GraduationCap className="h-3 w-3" aria-hidden="true" />
                                        {degree}
                                    </span>
                                ))}
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-joy-ink-muted">
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4 text-joy-ink/35" aria-hidden="true" />
                                    {locationSummary}
                                </span>
                                <span className="joy-mono flex items-center gap-1.5">
                                    <Calendar className="h-4 w-4 text-joy-ink/35" aria-hidden="true" />
                                    {postedLabel}
                                </span>
                            </div>

                            <p className="mt-6 text-sm leading-relaxed text-joy-ink-muted">
                                This listing is posted on {job.company_name}&apos;s own careers site. Tail&apos;ed Community
                                surfaces it as part of our free job board for students — applying happens on the
                                employer&apos;s site.
                            </p>

                            {/* PlaygroundButton ignores `onClick` when `href` is set (it renders a
                                plain <a>), so the apply-click track fires from this wrapper instead. */}
                            <div
                                className="mt-6"
                                onClick={() => trackEvent("job_apply_click", { jobId: job.id, source: "detail" })}
                            >
                                <PlaygroundButton href={job.url} className="w-full sm:w-auto">
                                    Apply now
                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </PlaygroundButton>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-joy-grass/30 bg-joy-grass-bright/8 px-4 py-4 sm:px-6">
                            <div>
                                <p className="joy-display text-base font-bold text-joy-ink">Get alerts for roles like this</p>
                                <p className="mt-0.5 text-sm text-joy-ink-muted">
                                    We&apos;ll email you the moment similar {jobTypeChipLabel(job.type).toLowerCase()} roles
                                    drop. Nothing else, ever.
                                </p>
                            </div>
                            <PlaygroundButton to={LIVE_ROUTES.alertBuilder} variant="outline" className="shrink-0">
                                Set up alerts
                            </PlaygroundButton>
                        </div>

                        {relatedJobs.length > 0 && (
                            <div className="mt-8">
                                <h2 className="joy-display mb-3 text-lg font-extrabold text-joy-ink">More roles like this</h2>
                                <div className="overflow-hidden rounded-2xl border border-joy-ink/8 bg-white shadow-sm">
                                    <ul>
                                        {relatedJobs.map((related, i) => (
                                            <JoyJobRow
                                                key={related.id}
                                                first={i === 0}
                                                job={{
                                                    id: related.id,
                                                    title: related.title,
                                                    company: related.company_name,
                                                    logo: null,
                                                    locations: related.locations ?? [],
                                                    type: related.type,
                                                    featured: false,
                                                    category: related.category ?? null,
                                                    postedLabel: formatPostedLabel(related),
                                                    postedMillis: toMillis(related.date_posted),
                                                    href: `/jobs/e/${encodeURIComponent(related.id)}`,
                                                    external: related,
                                                }}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </PlaygroundShell>
        </div>
    );
}
