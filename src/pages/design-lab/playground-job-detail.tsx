import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink, GraduationCap, MapPin } from "lucide-react";
import { useAllJobs } from "@/pages/design-lab/lab-shared";
import { formatPostedLabel } from "@/lib/external-jobs";
import type { ExternalJob } from "@/types/jobs";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LAB_ROUTES } from "@/components/playground/playground-routes";
import { jobTypeChipClass, jobTypeChipLabel } from "@/components/playground/joy-primitives";

/** Neutral outline chip for secondary metadata (category / term / degree). */
const NEUTRAL_CHIP_CLASS =
    "inline-flex items-center gap-1 rounded-full border border-joy-ink/12 px-2.5 py-0.5 text-xs font-bold text-joy-ink-muted";

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
        <section className="px-5 py-16">
            <div className="mx-auto max-w-xl text-center">
                <p className="joy-display text-2xl font-extrabold text-joy-ink">
                    Hmm, we can&apos;t find that role
                </p>
                <p className="mt-2 text-sm text-joy-ink-muted">
                    It may have been filled, pulled by the employer, or the link is off. The rest of the board is
                    still very much alive.
                </p>
                <PlaygroundButton to={LAB_ROUTES.jobs} className="mt-6">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to the job board
                </PlaygroundButton>
            </div>
        </section>
    );
}

function JobDetailBody({ job }: { job: ExternalJob }) {
    const locationSummary = job.locations.length > 0 ? job.locations.join(" · ") : "Remote / Unlisted";
    const postedLabel = formatPostedLabel(job);

    return (
        <>
            <section className="px-5 pb-4 pt-8">
                <div className="mx-auto max-w-3xl">
                    <Link
                        to={LAB_ROUTES.jobs}
                        className="inline-flex items-center gap-1.5 rounded text-sm font-bold text-joy-ink-muted hover:text-joy-grass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Back to the job board
                    </Link>
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

                        <div className="mt-6">
                            <PlaygroundButton href={job.url} className="w-full sm:w-auto">
                                Apply now
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            </PlaygroundButton>
                        </div>
                    </div>

                    {/* ---------------- Alerts CTA ---------------- */}
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-joy-grass/30 bg-joy-grass-bright/8 px-4 py-4 sm:px-6">
                        <div>
                            <p className="joy-display text-base font-bold text-joy-ink">
                                Get alerts for roles like this
                            </p>
                            <p className="mt-0.5 text-sm text-joy-ink-muted">
                                We&apos;ll email you the moment similar {jobTypeChipLabel(job.type).toLowerCase()} roles
                                drop. Nothing else, ever.
                            </p>
                        </div>
                        <PlaygroundButton to={LAB_ROUTES.alertBuilder} variant="outline" className="shrink-0">
                            Set up alerts
                        </PlaygroundButton>
                    </div>
                </div>
            </section>
        </>
    );
}

export default function PlaygroundJobDetailPage() {
    const { id: rawId } = useParams<{ id: string }>();
    const id = rawId ? decodeURIComponent(rawId) : "";
    const { all, loading } = useAllJobs();

    const job = useMemo(() => all.find((candidate) => candidate.id === id) ?? null, [all, id]);

    return (
        <PlaygroundShell
            routes={LAB_ROUTES}
            showSwitcher
            activeNav={null}
            cta={{ label: "Get alerts", to: LAB_ROUTES.alertBuilder }}
        >
            {loading ? <DetailSkeleton /> : job ? <JobDetailBody job={job} /> : <NotFoundState />}
        </PlaygroundShell>
    );
}
