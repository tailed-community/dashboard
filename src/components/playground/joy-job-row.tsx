import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { jobTypeChipClass, jobTypeChipLabel } from "@/components/playground/joy-primitives";
import type { JoyJob } from "@/components/playground/joy-live-jobs";

/** Tint chip for the "Featured" badge — sun accent, checked against white/cream ~4.7:1 (same formula as jobTypeChipClass). */
const FEATURED_CHIP_CLASS =
    "inline-flex shrink-0 items-center gap-1 rounded-full bg-joy-sun/30 px-2 py-0.5 text-[10px] font-bold text-joy-sun-ink";

/**
 * One row in the merged featured+external job list. Links via `job.href`
 * (already resolved by `joy-live-jobs.ts` to `/jobs/:id` for featured jobs or
 * `/jobs/e/:id` for external jobs) rather than through `usePlaygroundRoutes()`
 * — `LIVE_ROUTES.jobDetail` only knows the internal-slug shape, so it can't
 * route a mixed featured/external dataset correctly.
 */
export function JoyJobRow({ job, first }: { job: JoyJob; first: boolean }) {
    return (
        <li className={first ? "" : "border-t border-joy-ink/8"}>
            <Link
                to={job.href}
                className="grid grid-cols-1 gap-1 px-4 py-3 transition hover:bg-joy-grass-bright/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-joy-grass/60 sm:grid-cols-[2.3fr_1.3fr_6.5rem_7.5rem] sm:items-center sm:gap-3"
            >
                <div className="flex min-w-0 items-center gap-2.5">
                    {job.featured && job.logo && (
                        <img
                            src={job.logo}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-md border border-joy-ink/8 bg-white object-contain"
                        />
                    )}
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <p className="truncate text-sm font-bold text-joy-ink">{job.title}</p>
                            {job.featured && (
                                <span className={FEATURED_CHIP_CLASS}>
                                    <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                                    Featured
                                </span>
                            )}
                        </div>
                        <p className="truncate text-xs text-joy-ink-muted">{job.company}</p>
                    </div>
                </div>
                <span className="truncate text-xs text-joy-ink-muted sm:text-sm">
                    {job.locations[0] ?? "Remote / Unlisted"}
                </span>
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${jobTypeChipClass(job.type)}`}>
                    {jobTypeChipLabel(job.type)}
                </span>
                <span className="joy-mono whitespace-nowrap text-xs text-joy-ink-muted sm:text-right">
                    {job.postedLabel}
                </span>
            </Link>
        </li>
    );
}
