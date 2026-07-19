import { Link } from "react-router-dom";
import { Monitor, Globe2, MapPin } from "lucide-react";
import { formatPostedLabel, toMillis } from "@/lib/external-jobs";
import type { ExternalJob } from "@/types/jobs";
import { usePlaygroundRoutes } from "@/components/playground/playground-routes";

const DAY_MS = 86_400_000;

/** ---------------- Job-type chips ---------------- */

export function jobTypeChipLabel(type: "internship" | "new-grad"): string {
    return type === "internship" ? "Internship" : "New grad";
}

/** Tint chips checked against white/cream: joy-grass ~5:1, joy-sky-ink ~5.4:1. */
export function jobTypeChipClass(type: "internship" | "new-grad"): string {
    return type === "internship" ? "bg-joy-grass/10 text-joy-grass" : "bg-joy-sky/12 text-joy-sky-ink";
}

/** ---------------- Event mode chips ---------------- */

export type EventMode = "Online" | "In Person" | "Hybrid";

/** Tint chips checked against white/cream, same formula as the job-type chips. */
export function modeChipClass(mode: EventMode): string {
    if (mode === "Online") return "bg-joy-sky/12 text-joy-sky-ink";
    if (mode === "Hybrid") return "bg-joy-sun/25 text-joy-sun-ink";
    return "bg-joy-grass/10 text-joy-grass";
}

export function ModeIcon({ mode, className }: { mode: EventMode; className?: string }) {
    if (mode === "Online") return <Monitor className={className} aria-hidden="true" />;
    if (mode === "Hybrid") return <Globe2 className={className} aria-hidden="true" />;
    return <MapPin className={className} aria-hidden="true" />;
}

/** ---------------- Community member counts ---------------- */

export function formatMemberCount(count: number): string {
    if (count >= 1000) {
        const value = (count / 1000).toFixed(1).replace(/\.0$/, "");
        return `${value}k`;
    }
    return count.toString();
}

/** Cycled card-grid accents (border only — the card itself stays white/cream). Shared by the jobs, events, and communities grids. */
export const FRESH_ACCENTS = [
    "border-joy-grass/30 hover:border-joy-grass/55",
    "border-joy-sky/35 hover:border-joy-sky/60",
    "border-joy-sun/70 hover:border-joy-sun/95",
];

/** ---------------- Feed pulse (jobs board activity readout) ---------------- */

/**
 * The board's pulse, derived entirely from the live feed: how many roles
 * landed today / this week, when the most recent one dropped, and a 7-day
 * per-day posting histogram (oldest -> today). Null when the feed is empty
 * or has no usable timestamps, in which case the readout is hidden.
 */
export interface FeedPulse {
    addedToday: number;
    addedThisWeek: number;
    lastDropLabel: string;
    dayCounts: number[];
}

export function computeFeedPulse(all: ExternalJob[]): FeedPulse | null {
    if (all.length === 0) return null;
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = startOfToday.getTime() + DAY_MS;

    let addedToday = 0;
    let addedThisWeek = 0;
    let latest = 0;
    const dayCounts = new Array(7).fill(0);

    for (const job of all) {
        const t = toMillis(job.date_posted);
        if (t <= 0 || t > now + DAY_MS) continue;
        if (t > latest) latest = t;
        // Rolling 24h window (not calendar day): feed timestamps are date-
        // granular, so a midnight boundary reads "0 added today" all morning.
        if (t >= now - DAY_MS) addedToday++;
        if (t >= now - 7 * DAY_MS) addedThisWeek++;
        const daysAgo = Math.floor((endOfToday - t) / DAY_MS);
        if (daysAgo >= 0 && daysAgo < 7) dayCounts[6 - daysAgo]++;
    }

    if (latest === 0) return null;
    const diff = Math.max(0, now - latest);
    const lastDropLabel =
        diff < 3_600_000
            ? `${Math.max(1, Math.floor(diff / 60_000))}m ago`
            : diff < DAY_MS
              ? `${Math.floor(diff / 3_600_000)}h ago`
              : `${Math.floor(diff / DAY_MS)}d ago`;

    return { addedToday, addedThisWeek, lastDropLabel, dayCounts };
}

/** Tiny 7-day posting histogram; today's bar glows bright green, the rest sit back at low opacity. */
export function PostingSparkline({ counts }: { counts: number[] }) {
    const max = Math.max(...counts, 1);
    const barWidth = 7;
    const gap = 4;
    const height = 22;
    const width = counts.length * (barWidth + gap) - gap;
    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-label="Jobs posted per day, last 7 days"
            role="img"
        >
            {counts.map((c, i) => {
                const h = Math.max(2, Math.round((c / max) * height));
                const isToday = i === counts.length - 1;
                return (
                    <rect
                        key={i}
                        x={i * (barWidth + gap)}
                        y={height - h}
                        width={barWidth}
                        height={h}
                        rx={1.5}
                        fill={isToday ? "var(--joy-grass)" : "var(--joy-grass-bright)"}
                        opacity={isToday ? 1 : 0.4}
                    />
                );
            })}
        </svg>
    );
}

/** ---------------- Job search-result row ---------------- */

/** One row in a job search-results list — a fixed-column grid so rows line up regardless of title length. Links via the active route map so it works for both lab and (later) live listings. */
export function JobResultRow({ job, first }: { job: ExternalJob; first: boolean }) {
    const routes = usePlaygroundRoutes();
    return (
        <li className={first ? "" : "border-t border-joy-ink/8"}>
            <Link
                to={routes.jobDetail(job.id)}
                className="grid grid-cols-1 gap-1 px-4 py-3 transition hover:bg-joy-grass-bright/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-joy-grass/60 sm:grid-cols-[2.3fr_1.3fr_6.5rem_7.5rem] sm:items-center sm:gap-3"
            >
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-joy-ink">{job.title}</p>
                    <p className="truncate text-xs text-joy-ink-muted">{job.company_name}</p>
                </div>
                <span className="truncate text-xs text-joy-ink-muted sm:text-sm">
                    {job.locations[0] ?? "Remote / Unlisted"}
                </span>
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${jobTypeChipClass(job.type)}`}>
                    {jobTypeChipLabel(job.type)}
                </span>
                <span className="joy-mono whitespace-nowrap text-xs text-joy-ink-muted sm:text-right">
                    {formatPostedLabel(job)}
                </span>
            </Link>
        </li>
    );
}
