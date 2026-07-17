import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Github, Search } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { FcGoogle } from "react-icons/fc";
import {
    useLabJobs,
    useAllJobs,
    searchJobs,
    stashAlertPrefsForSignup,
    roundedCountLabel,
    LabSwitcher,
    type AlertPrefs,
} from "@/pages/design-lab/lab-shared";
import { formatPostedLabel, toMillis } from "@/lib/external-jobs";
import { apiFetch } from "@/lib/fetch";
import type { ExternalJob } from "@/types/jobs";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const DAY_MS = 86_400_000;

/**
 * The board's pulse, derived entirely from the live feed: how many roles
 * landed today / this week, when the most recent one dropped, and a 7-day
 * per-day posting histogram (oldest -> today). Null when the feed is empty
 * or has no usable timestamps, in which case the readout is hidden.
 * (Ported from after-hours.tsx's computeFeedPulse — same rolling-window
 * logic, restyled colors only.)
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

/** Warm little "you're in" illustration for the alert-builder success state — an envelope with a checkmark badge. */
function MilestoneBadge({ size = 64 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
            <rect x="9" y="21" width="58" height="42" rx="7" fill="#FFF6E0" stroke="#2B2118" strokeWidth="3" />
            <path d="M9 23 L38 47 L67 23" fill="none" stroke="#2B2118" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="58" cy="55" r="16" fill="#2E7D02" stroke="#FFF6E0" strokeWidth="3" />
            <path
                d="M50 55 L55 61 L67 47"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
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

/** "Daily · react intern · Internships" style summary of a configured alert. */
function scopeSummary(frequency: "daily" | "weekly", query: string, jobType: "internship" | "new-grad" | null): string {
    const freqLabel = frequency === "daily" ? "Daily" : "Weekly";
    const typeLabel =
        jobType === "internship" ? "Internships" : jobType === "new-grad" ? "New grad" : "Internships & new grad";
    const queryLabel = query.trim() || "All roles";
    return `${freqLabel} · ${queryLabel} · ${typeLabel}`;
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

const NAV_LINKS = [
    { label: "Jobs", to: "/design-lab/playground/jobs" },
    { label: "Events", to: "/design-lab/playground/events" },
    { label: "Communities", to: "/design-lab/playground/communities" },
    { label: "Spotlight", to: "/spotlight" },
];

const COMMUNITY_LINKS = [
    { to: "/design-lab/playground/communities", title: "Communities", blurb: "Student groups building in your field." },
    { to: "/design-lab/playground/events", title: "Events", blurb: "Workshops, meetups, and career events near you." },
    { to: "/spotlight", title: "Spotlight", blurb: "Real stories from students who landed the role." },
];

/** Cycled fresh-grid card accents (border only — the card itself stays white/cream). */
const FRESH_ACCENTS = ["border-[#2E7D02]/30 hover:border-[#2E7D02]/55", "border-[#1CB0F6]/35 hover:border-[#1CB0F6]/60", "border-[#FFC800]/70 hover:border-[#FFC800]/95"];

const RESULT_TYPE_FILTERS: { label: string; value: "all" | "internship" | "new-grad" }[] = [
    { label: "All", value: "all" },
    { label: "Internships", value: "internship" },
    { label: "New grad", value: "new-grad" },
];

/** One row in the search-results list — a fixed-column grid so rows line up regardless of title length. */
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

export default function PlaygroundPage() {
    const navigate = useNavigate();
    const { jobs: freshJobs, activeCount, companyCount, loading: freshLoading } = useLabJobs(6, 2);
    const { all, loading: allLoading } = useAllJobs();

    // ---------------- Search-swap state ----------------
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "internship" | "new-grad">("all");

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 250);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const isSearching = debouncedQuery.trim().length > 0;

    const rawMatches = useMemo<ExternalJob[]>(() => searchJobs(all, debouncedQuery), [all, debouncedQuery]);
    const sortedMatches = useMemo<ExternalJob[]>(
        () => [...rawMatches].sort((a, b) => toMillis(b.date_posted) - toMillis(a.date_posted)),
        [rawMatches]
    );
    const filteredMatches = useMemo<ExternalJob[]>(
        () => (typeFilter === "all" ? sortedMatches : sortedMatches.filter((j) => j.type === typeFilter)),
        [sortedMatches, typeFilter]
    );
    const displayedMatches = filteredMatches.slice(0, 25);

    const pulse = useMemo(() => computeFeedPulse(all), [all]);

    // ---------------- Alert builder state ----------------
    const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
    const [alertQuery, setAlertQuery] = useState("");
    const [jobType, setJobType] = useState<"internship" | "new-grad" | null>(null);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [subscribed, setSubscribed] = useState(false);

    const alertSectionRef = useRef<HTMLElement>(null);
    const keywordInputRef = useRef<HTMLInputElement>(null);

    function focusAlertBuilder(prefillQuery?: string) {
        if (prefillQuery !== undefined) setAlertQuery(prefillQuery);
        requestAnimationFrame(() => {
            alertSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            keywordInputRef.current?.focus({ preventScroll: true });
        });
    }

    async function handleEmailSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed || submitting) return;
        setSubmitting(true);
        try {
            // PROTOTYPE BEHAVIOR: we fire the request but always move to the
            // success state below, since local dev has no live backend.
            // Production must gate `setSubscribed(true)` on `response.ok`.
            await apiFetch("/alerts/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: trimmed,
                    source: "landing_strip",
                    ...(alertQuery.trim() ? { query: alertQuery.trim() } : {}),
                    ...(jobType ? { jobType } : {}),
                }),
            });
        } catch (error) {
            console.error("Alert subscribe request failed (prototype continues anyway):", error);
        } finally {
            setSubmitting(false);
            setSubscribed(true);
        }
    }

    function handleGoogleContinue() {
        const prefs: AlertPrefs = { frequency, query: alertQuery.trim(), jobType };
        navigate(stashAlertPrefsForSignup(prefs));
    }

    const jobsLabel = roundedCountLabel(activeCount);
    const companiesLabel = roundedCountLabel(companyCount, "hundreds of");

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
                        <div className="flex items-center h-8 w-[100px] sm:h-9 sm:w-[113px]">
                            <AspectRatio ratio={3042 / 968}>
                                <img
                                    src="/Tailed_Community_logo.png"
                                    alt="Tail'ed Community logo"
                                    className="object-contain h-full w-full"
                                />
                            </AspectRatio>
                        </div>
                    </Link>
                    <nav className="hidden items-center gap-1 md:flex">
                        {NAV_LINKS.map((item) => (
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
                        <Button onClick={() => focusAlertBuilder()} className="!px-4 !py-2 !text-xs">
                            Get alerts
                        </Button>
                    </div>
                </div>
            </header>

            {/* ---------------- Hero ---------------- */}
            <section className="relative overflow-hidden px-5 pb-14 pt-12 md:pt-16">
                <div className="relative mx-auto max-w-6xl">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center rounded-full bg-white px-3.5 py-1 shadow-sm">
                            <span className="text-xs font-bold text-[#6B5D4F]">
                                Non-profit · built by students · free forever
                            </span>
                        </div>
                        <h1 className="joy-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-[#2B2118] sm:text-5xl md:text-6xl">
                            Every internship. 
                            <br />
                            One place.
                            <br />
                            <span className="text-[#2E7D02]">Updated daily.</span>
                        </h1>
                        <p className="mt-5 max-w-xl text-lg text-[#6B5D4F]">
                            {jobsLabel} live internships &amp; new-grad roles from {companiesLabel} companies,
                            updated daily. 
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative w-full max-w-md">
                                <Search
                                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2B2118]/30"
                                    aria-hidden="true"
                                />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search role, company, location…"
                                    aria-label="Search jobs"
                                    className="w-full rounded-xl border border-[#2B2118]/10 bg-white py-3 pl-10 pr-3.5 text-sm text-[#2B2118] shadow-sm placeholder:text-[#2B2118]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                                />
                            </div>
                            <Button onClick={() => focusAlertBuilder()} className="shrink-0 !py-3">
                                Get alerts
                            </Button>
                        </div>

                        {pulse && (
                            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                                <span className="flex items-center gap-2">
                                    <span className="joy-pulse-dot h-2 w-2 rounded-full bg-[#58CC02]" aria-hidden="true" />
                                    <span className="joy-mono text-xs text-[#6B5D4F]">
                                        <span className="font-bold text-[#2E7D02]">
                                            {pulse.addedToday.toLocaleString("en-US")}
                                        </span>{" "}
                                        added today · {pulse.addedThisWeek.toLocaleString("en-US")} this week · last
                                        drop {pulse.lastDropLabel}
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
                </div>
            </section>

            {/* ---------------- Jobs / search-swap ---------------- */}
            <section className="px-5 py-14">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="joy-mono text-xs font-bold uppercase tracking-wide text-[#2E7D02]">
                                {isSearching ? "Full feed" : "Fresh drops"}
                            </p>
                            <h2 className="joy-display mt-1 text-3xl font-extrabold text-[#2B2118]">
                                {isSearching ? "Search the whole board" : "Just landed"}
                            </h2>
                        </div>
                        {!isSearching && (
                            <Link
                                to="/design-lab/playground/jobs"
                                className="rounded text-sm font-bold text-[#2E7D02] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                            >
                                See all {jobsLabel} jobs →
                            </Link>
                        )}
                    </div>

                    <div key={isSearching ? "results" : "grid"} className="joy-swap mt-8">
                        {!isSearching ? (
                            freshLoading ? (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-32 animate-pulse rounded-2xl border border-[#2B2118]/8 bg-white" />
                                    ))}
                                </div>
                            ) : freshJobs.length === 0 ? (
                                <p className="text-sm text-[#6B5D4F]">
                                    The feed is quiet right now — check back shortly, or set up an alert to be notified.
                                </p>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {freshJobs.map((job, i) => (
                                        <Link
                                            key={job.id}
                                            to={`/design-lab/playground/jobs/${job.id}`}
                                            className={`flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 ${FRESH_ACCENTS[i % FRESH_ACCENTS.length]}`}
                                        >
                                            <p className="joy-display truncate text-sm font-bold text-[#2B2118]">
                                                {job.title}
                                            </p>
                                            <p className="mt-0.5 truncate text-sm text-[#6B5D4F]">{job.company_name}</p>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${jobTypeChipClass(job.type)}`}>
                                                    {jobTypeChipLabel(job.type)}
                                                </span>
                                                {job.locations[0] && (
                                                    <span className="truncate text-xs text-[#2B2118]/40">{job.locations[0]}</span>
                                                )}
                                            </div>
                                            <p className="joy-mono mt-2 text-xs text-[#2B2118]/35">{formatPostedLabel(job)}</p>
                                        </Link>
                                    ))}
                                </div>
                            )
                        ) : allLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-14 animate-pulse rounded-xl border border-[#2B2118]/8 bg-white" />
                                ))}
                                <p className="pt-1 text-xs text-[#6B5D4F]">Searching…</p>
                            </div>
                        ) : (
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-[#6B5D4F]">
                                        <span className="joy-mono">{filteredMatches.length.toLocaleString("en-US")}</span>{" "}
                                        match{filteredMatches.length === 1 ? "" : "es"} for &ldquo;{debouncedQuery.trim()}&rdquo;
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        {RESULT_TYPE_FILTERS.map((f) => (
                                            <button
                                                key={f.value}
                                                type="button"
                                                onClick={() => setTypeFilter(f.value)}
                                                className={`rounded-full border px-3 py-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 ${
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

                                {filteredMatches.length > 0 && (
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-[#2E7D02]/30 bg-[#58CC02]/8 px-4 py-3">
                                        <p className="text-sm text-[#2B2118]/80">
                                            Get a {frequency} email when new &ldquo;{debouncedQuery.trim()}&rdquo; roles drop.
                                        </p>
                                        <Button onClick={() => focusAlertBuilder(searchQuery.trim())} className="shrink-0 !px-4 !py-2 !text-xs">
                                            Get alerts for this search
                                        </Button>
                                    </div>
                                )}

                                {filteredMatches.length === 0 ? (
                                    <div className="mt-6 rounded-2xl border border-[#2B2118]/8 bg-white p-6 text-center shadow-sm">
                                        <p className="text-sm text-[#6B5D4F]">
                                            No live roles match that yet — be first to know when one appears.
                                        </p>
                                        <Button
                                            onClick={() => focusAlertBuilder(searchQuery.trim())}
                                            variant="outline"
                                            className="mt-4"
                                        >
                                            Get alerts for this search
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="mt-4 overflow-hidden rounded-2xl border border-[#2B2118]/8 bg-white shadow-sm">
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

                                <Link
                                    to={`/design-lab/playground/jobs?search=${encodeURIComponent(debouncedQuery.trim())}`}
                                    className="mt-4 inline-block rounded text-sm font-bold text-[#2E7D02] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                                >
                                    See all {filteredMatches.length.toLocaleString("en-US")} on the job board →
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Alert builder ---------------- */}
            <section ref={alertSectionRef} id="alert-builder" className="bg-[#FFF3DC] px-5 py-16">
                <div className="mx-auto max-w-2xl">
                    <div className="text-center">
                        <h2 className="joy-display text-3xl font-extrabold text-[#2B2118]">Get alerts</h2>
                        <p className="mt-2 text-[#6B5D4F]">
                            Tell us what you&apos;re hunting for — we&apos;ll email you the moment matching roles
                            drop.
                        </p>
                    </div>

                    <div className="mt-8 rounded-2xl border border-[#2B2118]/8 bg-white p-6 shadow-[0_4px_0_rgba(43,33,24,0.05)] sm:p-8">
                        {subscribed ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                                <MilestoneBadge size={64} />
                                <p className="joy-display text-lg font-bold text-[#2B2118]">
                                    You&apos;re in — first digest tomorrow morning
                                </p>
                                <p className="joy-mono text-sm text-[#6B5D4F]">
                                    {scopeSummary(frequency, alertQuery, jobType)}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSubscribed(false)}
                                    className="mt-1 rounded text-sm font-bold text-[#2E7D02] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                                >
                                    Edit alert
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-[#6B5D4F]">Frequency</p>
                                        <div className="mt-2 inline-flex rounded-lg bg-[#2B2118]/5 p-1">
                                            {(["daily", "weekly"] as const).map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setFrequency(f)}
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 ${
                                                        frequency === f ? "bg-white text-[#2B2118] shadow-sm" : "text-[#6B5D4F]"
                                                    }`}
                                                >
                                                    {f === "daily" ? "Daily" : "Weekly"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-[#6B5D4F]">Job type</p>
                                        <div className="mt-2 inline-flex rounded-lg bg-[#2B2118]/5 p-1">
                                            {(
                                                [
                                                    { value: "internship" as const, label: "Internships" },
                                                    { value: "new-grad" as const, label: "New grad" },
                                                    { value: null, label: "Both" },
                                                ]
                                            ).map((opt) => (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    onClick={() => setJobType(opt.value)}
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 ${
                                                        jobType === opt.value ? "bg-white text-[#2B2118] shadow-sm" : "text-[#6B5D4F]"
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <p className="text-xs font-bold uppercase tracking-wide text-[#6B5D4F]">Keywords</p>
                                    <input
                                        ref={keywordInputRef}
                                        value={alertQuery}
                                        onChange={(e) => setAlertQuery(e.target.value)}
                                        placeholder="react, data, Toronto — optional"
                                        className="mt-2 w-full rounded-xl border border-[#2B2118]/10 bg-[#FFFBF0] px-3.5 py-2.5 text-sm text-[#2B2118] placeholder:text-[#2B2118]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                                    />
                                </div>

                                <div className="mt-6">
                                    <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2 sm:flex-row">
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@school.edu"
                                            className="min-w-0 flex-1 rounded-xl border border-[#2B2118]/10 bg-white px-3.5 py-2.5 text-sm text-[#2B2118] placeholder:text-[#2B2118]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                                        />
                                        <Button type="submit" className="shrink-0">
                                            {submitting ? "Signing up…" : "Get alerts"}
                                        </Button>
                                    </form>

                                    <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-[#2B2118]/40">
                                        <span className="h-px flex-1 bg-[#2B2118]/15" />
                                        or
                                        <span className="h-px flex-1 bg-[#2B2118]/15" />
                                    </div>

                                    <div>
                                        <button
                                            type="button"
                                            onClick={handleGoogleContinue}
                                            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#2B2118]/12 bg-white px-4 py-2.5 text-sm font-semibold text-[#2B2118] transition hover:border-[#2B2118]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                                        >
                                            <FcGoogle className="h-4 w-4" aria-hidden="true" />
                                            Continue with Google
                                        </button>
                                        <p className="mt-1.5 text-center text-xs text-[#6B5D4F]">
                                            We&apos;ll create your account and save this alert.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Why free (human element) ---------------- */}
            <section className="px-5 py-16">
                <div className="mx-auto max-w-2xl">
                    <p className="joy-mono text-xs font-bold uppercase tracking-wide text-[#2E7D02]">Why free?</p>
                    <h2 className="joy-display mt-1 text-2xl font-extrabold text-[#2B2118]">
                        Built by students, for students.
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-[#6B5D4F]">
                        Tail&apos;ed is a non-profit run by students who were sick of job boards and gatekept
                        opportunities. Every line of it is public, and it stays free forever.
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-[#6B5D4F]">
                        We believe we have the power to change how things are done — and that by building a
                        community together, we can have a seat at the table.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded text-sm font-bold text-[#2E7D02] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <Github className="h-4 w-4" aria-hidden="true" />
                            We build in the open
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded text-sm font-bold text-[#2E7D02] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <SiDiscord className="h-4 w-4" aria-hidden="true" />
                            Come say hi on Discord
                        </a>
                    </div>
                </div>
            </section>

            {/* ---------------- Beyond the board ---------------- */}
            <section className="border-t border-[#2B2118]/8 px-5 py-14">
                <div className="mx-auto max-w-5xl">
                    <h2 className="joy-display text-2xl font-extrabold text-[#2B2118]">Beyond the job board</h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-3">
                        {COMMUNITY_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                            >
                                <p className="joy-display text-base font-bold text-[#2B2118]">
                                    {item.title}{" "}
                                    <ArrowRight
                                        className="inline-block h-4 w-4 text-[#2B2118]/30 transition group-hover:translate-x-0.5 group-hover:text-[#2E7D02]"
                                        aria-hidden="true"
                                    />
                                </p>
                                <p className="mt-1 text-sm text-[#6B5D4F]">{item.blurb}</p>
                            </Link>
                        ))}
                    </div>
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
                            className="rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            GitHub
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
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
