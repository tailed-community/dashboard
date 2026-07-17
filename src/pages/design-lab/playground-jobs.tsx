import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Github, Search } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
    useAllJobs,
    searchJobs,
    roundedCountLabel,
    stashAlertPrefsForSignup,
    LabSwitcher,
    type AlertPrefs,
} from "@/pages/design-lab/lab-shared";
import { formatPostedLabel, toMillis } from "@/lib/external-jobs";
import type { ExternalJob } from "@/types/jobs";

const DAY_MS = 86_400_000;
/** How many rows are shown per "page"; Load more bumps the visible window by this much. */
const PAGE_SIZE = 30;

/**
 * The board's pulse, derived entirely from the live feed: how many roles
 * landed today / this week, when the most recent one dropped, and a 7-day
 * per-day posting histogram (oldest -> today). Null when the feed is empty
 * or has no usable timestamps, in which case the readout is hidden.
 * (Ported from playground.tsx's computeFeedPulse — same rolling-window
 * logic, unchanged.)
 */
interface FeedPulse {
    addedToday: number;
    addedThisWeek: number;
    lastDropLabel: string;
    dayCounts: number[];
}

function computeFeedPulse(all: ExternalJob[]): FeedPulse | null {
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
function PostingSparkline({ counts }: { counts: number[] }) {
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
                        fill={isToday ? "#2E7D02" : "#58CC02"}
                        opacity={isToday ? 1 : 0.4}
                    />
                );
            })}
        </svg>
    );
}

function jobTypeChipLabel(type: "internship" | "new-grad"): string {
    return type === "internship" ? "Internship" : "New grad";
}

/** Tint chips checked against white/cream: #2E7D02 ~5:1, #0A6FA8 ~5.4:1. */
function jobTypeChipClass(type: "internship" | "new-grad"): string {
    return type === "internship" ? "bg-[#2E7D02]/10 text-[#2E7D02]" : "bg-[#1CB0F6]/12 text-[#0A6FA8]";
}

/** Chunky, joyful button: rounded, green primary with a pressed bottom-shadow edge. */
function Button({
    children,
    to,
    variant = "primary",
    className = "",
    onClick,
    type = "button",
}: {
    children: React.ReactNode;
    to?: string;
    variant?: "primary" | "quiet" | "outline";
    className?: string;
    onClick?: () => void;
    type?: "button" | "submit";
}) {
    const base =
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60";
    const styles: Record<string, string> = {
        primary:
            "bg-[#2E7D02] text-white shadow-[0_3px_0_#1F5C01] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_#1F5C01]",
        outline:
            "border-2 border-[#2B2118]/12 bg-white text-[#2B2118] hover:border-[#2E7D02]/50 active:translate-y-px",
        quiet: "text-[#6B5D4F] hover:text-[#2B2118]",
    };
    const cls = `${base} ${styles[variant]} ${className}`;
    if (to) {
        return (
            <Link to={to} className={cls}>
                {children}
            </Link>
        );
    }
    return (
        <button type={type} onClick={onClick} className={cls}>
            {children}
        </button>
    );
}

/** Nav links other than the current page — "Jobs" itself is rendered separately below, styled as active/current. */
const OTHER_NAV_LINKS = [
    { label: "Events", to: "/design-lab/playground/events" },
    { label: "Communities", to: "/design-lab/playground/communities" },
    { label: "Spotlight", to: "/spotlight" },
];

const RESULT_TYPE_FILTERS: { label: string; value: "all" | "internship" | "new-grad" }[] = [
    { label: "All", value: "all" },
    { label: "Internships", value: "internship" },
    { label: "New grad", value: "new-grad" },
];

/** One row in the results list — a fixed-column grid so rows line up regardless of title length. */
function ResultRow({ job, first }: { job: ExternalJob; first: boolean }) {
    return (
        <li className={first ? "" : "border-t border-[#2B2118]/8"}>
            <Link
                to={`/design-lab/playground/jobs/${job.id}`}
                className="grid grid-cols-1 gap-1 px-4 py-3 transition hover:bg-[#58CC02]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2E7D02]/60 sm:grid-cols-[2.3fr_1.3fr_6.5rem_7.5rem] sm:items-center sm:gap-3"
            >
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#2B2118]">{job.title}</p>
                    <p className="truncate text-xs text-[#6B5D4F]">{job.company_name}</p>
                </div>
                <span className="truncate text-xs text-[#6B5D4F] sm:text-sm">
                    {job.locations[0] ?? "Remote / Unlisted"}
                </span>
                <span className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${jobTypeChipClass(job.type)}`}>
                    {jobTypeChipLabel(job.type)}
                </span>
                <span className="joy-mono whitespace-nowrap text-xs text-[#6B5D4F] sm:text-right">
                    {formatPostedLabel(job)}
                </span>
            </Link>
        </li>
    );
}

export default function PlaygroundJobsPage() {
    const navigate = useNavigate();
    const { all, loading } = useAllJobs();

    const [searchQuery, setSearchQuery] = useState(
        () => new URLSearchParams(window.location.search).get("search") ?? ""
    );
    const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
    const [typeFilter, setTypeFilter] = useState<"all" | "internship" | "new-grad">("all");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 250);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const isSearching = debouncedQuery.trim().length > 0;

    const activeCount = all.length;
    const companyCount = useMemo(() => new Set(all.map((j) => j.company_name)).size, [all]);
    const pulse = useMemo(() => computeFeedPulse(all), [all]);

    const baseMatches = useMemo<ExternalJob[]>(
        () => (isSearching ? searchJobs(all, debouncedQuery) : all),
        [all, debouncedQuery, isSearching]
    );
    const sortedMatches = useMemo<ExternalJob[]>(
        () => [...baseMatches].sort((a, b) => toMillis(b.date_posted) - toMillis(a.date_posted)),
        [baseMatches]
    );
    const filteredMatches = useMemo<ExternalJob[]>(
        () => (typeFilter === "all" ? sortedMatches : sortedMatches.filter((j) => j.type === typeFilter)),
        [sortedMatches, typeFilter]
    );

    // Reset the "load more" window back to the first page whenever the
    // filtered set changes (new search term or type filter).
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [debouncedQuery, typeFilter]);

    const displayedMatches = filteredMatches.slice(0, visibleCount);
    const hasMore = visibleCount < filteredMatches.length;

    function handleGetAlertsForSearch() {
        const prefs: AlertPrefs = {
            frequency: "daily",
            query: debouncedQuery.trim(),
            jobType: typeFilter === "all" ? null : typeFilter,
        };
        navigate(stashAlertPrefsForSignup(prefs));
    }

    const jobsLabel = roundedCountLabel(loading ? null : activeCount);
    const companiesLabel = roundedCountLabel(loading ? null : companyCount, "hundreds of");

    return (
        <div
            className="min-h-screen w-full overflow-x-hidden bg-[#FFFBF0] text-[#2B2118]"
            style={{ fontFamily: "'Nunito', ui-sans-serif, system-ui, sans-serif" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');
                .joy-display { font-family: 'Baloo 2', ui-rounded, system-ui, sans-serif; }
                .joy-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }

                @keyframes joyPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.35; }
                }
                .joy-pulse-dot { animation: joyPulse 2s ease-in-out infinite; }

                @keyframes joySwapIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .joy-swap { animation: joySwapIn 0.32s ease both; }

                @media (prefers-reduced-motion: reduce) {
                    .joy-pulse-dot, .joy-swap { animation: none; }
                }
            `}</style>

            {/* ---------------- Header ---------------- */}
            <header className="sticky top-0 z-40 bg-gradient-to-b from-[#EAF6DC]/95 via-[#FFFBF0]/92 to-[#FFFBF0]/75 backdrop-blur-md">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
                    <Link
                        to="/"
                        className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                    >
                        <div className="flex items-center h-8 sm:h-9">
                            <AspectRatio ratio={3042 / 968} className="h-full w-auto">
                                <img
                                    src="/Tailed_Community_logo.png"
                                    alt="Tail'ed Community logo"
                                    className="object-contain h-full w-full"
                                />
                            </AspectRatio>
                        </div>
                    </Link>
                    <nav className="hidden items-center gap-1 md:flex">
                        <Link
                            to="/design-lab/playground/jobs"
                            aria-current="page"
                            className="rounded-lg px-3.5 py-2 text-sm font-extrabold text-[#2E7D02] underline decoration-2 underline-offset-4 transition hover:bg-[#2B2118]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            Jobs
                        </Link>
                        {OTHER_NAV_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="rounded-lg px-3.5 py-2 text-sm font-bold text-[#6B5D4F] transition hover:bg-[#2B2118]/5 hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/sign-in"
                            className="hidden rounded text-sm font-bold text-[#6B5D4F] hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 sm:inline-block"
                        >
                            Sign in
                        </Link>
                        <Button onClick={handleGetAlertsForSearch} className="!px-4 !py-2 !text-xs">
                            Get alerts
                        </Button>
                    </div>
                </div>
            </header>

            {/* ---------------- Page hero ---------------- */}
            <section className="px-5 pb-8 pt-10 md:pt-12">
                <div className="mx-auto max-w-6xl">
                    <div className="inline-flex items-center rounded-full bg-white px-3.5 py-1 shadow-sm">
                        <span className="text-xs font-bold text-[#6B5D4F]">
                            Non-profit · built by students · free forever
                        </span>
                    </div>
                    <h1 className="joy-display mt-4 text-3xl font-extrabold leading-[1.08] tracking-tight text-[#2B2118] sm:text-4xl">
                        Every live role, <span className="text-[#2E7D02]">one board.</span>
                    </h1>
                    <p className="mt-3 max-w-2xl text-base text-[#6B5D4F]">
                        {jobsLabel} internships &amp; new-grad roles from {companiesLabel} companies, updated daily.
                        Search, filter, and go — no account required.
                    </p>

                    {pulse && (
                        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                            <span className="flex items-center gap-2">
                                <span className="joy-pulse-dot h-2 w-2 rounded-full bg-[#58CC02]" aria-hidden="true" />
                                <span className="joy-mono text-xs text-[#6B5D4F]">
                                    <span className="font-bold text-[#2E7D02]">
                                        {pulse.addedToday.toLocaleString("en-US")}
                                    </span>{" "}
                                    added today · {pulse.addedThisWeek.toLocaleString("en-US")} this week · last drop{" "}
                                    {pulse.lastDropLabel}
                                </span>
                            </span>
                            <span className="flex items-center gap-2" title="Jobs posted per day, last 7 days">
                                <PostingSparkline counts={pulse.dayCounts} />
                                <span className="joy-mono text-[10px] uppercase tracking-wide text-[#2B2118]/35">
                                    7 days
                                </span>
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {/* ---------------- Search + filters + results ---------------- */}
            <section className="px-5 pb-16">
                <div className="mx-auto max-w-6xl">
                    <div className="rounded-2xl border-2 border-[#2B2118]/10 bg-white p-4 shadow-sm sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative w-full">
                                <Search
                                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2B2118]/30"
                                    aria-hidden="true"
                                />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search role, company, location…"
                                    aria-label="Search jobs"
                                    className="w-full rounded-xl border border-[#2B2118]/10 bg-[#FFFBF0] py-3 pl-10 pr-3.5 text-sm text-[#2B2118] placeholder:text-[#2B2118]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                                />
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                {RESULT_TYPE_FILTERS.map((f) => (
                                    <button
                                        key={f.value}
                                        type="button"
                                        onClick={() => setTypeFilter(f.value)}
                                        className={`rounded-full border px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 ${
                                            typeFilter === f.value
                                                ? "border-[#2E7D02]/40 bg-[#2E7D02]/10 text-[#2E7D02]"
                                                : "border-[#2B2118]/10 text-[#6B5D4F] hover:border-[#2B2118]/25"
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#6B5D4F]">
                            {loading ? (
                                "Loading the feed…"
                            ) : (
                                <>
                                    <span className="joy-mono">{filteredMatches.length.toLocaleString("en-US")}</span>{" "}
                                    {isSearching ? (
                                        <>
                                            match{filteredMatches.length === 1 ? "" : "es"} for &ldquo;
                                            {debouncedQuery.trim()}&rdquo;
                                        </>
                                    ) : (
                                        <>role{filteredMatches.length === 1 ? "" : "s"} live right now</>
                                    )}
                                </>
                            )}
                        </p>
                        {!loading && filteredMatches.length > 0 && (
                            <Button
                                onClick={handleGetAlertsForSearch}
                                variant="outline"
                                className="!px-4 !py-2 !text-xs"
                            >
                                Get alerts for this search
                            </Button>
                        )}
                    </div>

                    <div key={`${typeFilter}:${debouncedQuery}`} className="joy-swap mt-4">
                        {loading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-14 animate-pulse rounded-xl border border-[#2B2118]/8 bg-white" />
                                ))}
                            </div>
                        ) : filteredMatches.length === 0 ? (
                            <div className="rounded-2xl border border-[#2B2118]/8 bg-white p-8 text-center shadow-sm">
                                <p className="text-sm text-[#6B5D4F]">
                                    No live roles match that yet — be first to know when one appears.
                                </p>
                                <Button onClick={handleGetAlertsForSearch} variant="outline" className="mt-4">
                                    Get alerts for this search
                                </Button>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-[#2B2118]/8 bg-white shadow-sm">
                                <div className="hidden grid-cols-[2.3fr_1.3fr_6.5rem_7.5rem] gap-3 border-b border-[#2B2118]/8 bg-[#FFF3DC] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6B5D4F] sm:grid">
                                    <span>Role · Company</span>
                                    <span>Location</span>
                                    <span>Type</span>
                                    <span className="text-right">Posted</span>
                                </div>
                                <ul>
                                    {displayedMatches.map((job, i) => (
                                        <ResultRow key={job.id} job={job} first={i === 0} />
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {!loading && hasMore && (
                        <div className="mt-6 flex flex-col items-center gap-2">
                            <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                                Load more roles
                            </Button>
                            <p className="joy-mono text-xs text-[#2B2118]/35">
                                Showing {displayedMatches.length.toLocaleString("en-US")} of{" "}
                                {filteredMatches.length.toLocaleString("en-US")}
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* ---------------- Footer ---------------- */}
            <footer className="border-t border-[#2B2118]/8 px-5 py-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
                    <div className="flex items-center gap-2 text-[#2B2118]">
                        <span className="joy-display text-sm font-bold">Tail&apos;ed</span>
                        <span className="text-xs text-[#2B2118]/40">· built by students, free forever</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#6B5D4F]">
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <Github className="h-4 w-4" aria-hidden="true" />
                            GitHub
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <SiDiscord className="h-4 w-4" aria-hidden="true" />
                            Discord
                        </a>
                        <Link
                            to="/sign-in"
                            className="rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            Sign in
                        </Link>
                    </div>
                </div>
            </footer>

            <LabSwitcher />
        </div>
    );
}
