import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Check, ArrowRight, Github } from "lucide-react";
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

const DAY_MS = 86_400_000;

/**
 * The board's pulse, derived entirely from the live feed: how many roles
 * landed today / this week, when the most recent one dropped, and a 7-day
 * per-day posting histogram (oldest → today). Null when the feed is empty
 * or has no usable timestamps, in which case the ticker is hidden.
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

/** Tiny 7-day posting histogram; today's bar glows mint, the rest sit back in violet. */
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
                        fill={isToday ? "#4ADE80" : "#7C6CFF"}
                        opacity={isToday ? 1 : 0.45}
                    />
                );
            })}
        </svg>
    );
}

function jobTypeChipLabel(type: "internship" | "new-grad"): string {
    return type === "internship" ? "Internship" : "New grad";
}

/** Chip tints checked against the #161922 card: #A79DFF 7.4:1, #4ADE80 10:1. */
function jobTypeChipClass(type: "internship" | "new-grad"): string {
    return type === "internship"
        ? "bg-[#7C6CFF]/15 text-[#A79DFF]"
        : "bg-[#4ADE80]/10 text-[#4ADE80]";
}

/** "Daily · react intern · Internships" style summary of a configured alert. */
function scopeSummary(frequency: "daily" | "weekly", query: string, jobType: "internship" | "new-grad" | null): string {
    const freqLabel = frequency === "daily" ? "Daily" : "Weekly";
    const typeLabel =
        jobType === "internship" ? "Internships" : jobType === "new-grad" ? "New grad" : "Internships & new grad";
    const queryLabel = query.trim() || "All roles";
    return `${freqLabel} · ${queryLabel} · ${typeLabel}`;
}

/** Filled buttons use the pressed violet #5F4FE0 (white passes AA); #7C6CFF is reserved for outlines/links. */
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
    variant?: "primary" | "outline" | "quiet";
    className?: string;
    onClick?: () => void;
    type?: "button" | "submit";
}) {
    const base =
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70";
    const styles: Record<string, string> = {
        primary: "bg-[#5F4FE0] text-white hover:brightness-110 active:translate-y-px",
        outline:
            "border border-white/15 bg-transparent text-[#EDEFF4] hover:border-[#7C6CFF]/60 hover:bg-white/5 active:translate-y-px",
        quiet: "text-white/60 hover:text-[#EDEFF4]",
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
    { label: "Jobs", to: "/jobs" },
    { label: "Events", to: "/events" },
    { label: "Communities", to: "/communities" },
    { label: "Spotlight", to: "/spotlight" },
];

const COMMUNITY_LINKS = [
    { to: "/communities", title: "Communities", blurb: "Student groups building in your field." },
    { to: "/events", title: "Events", blurb: "Workshops, meetups, and career events near you." },
    { to: "/spotlight", title: "Spotlight", blurb: "Real stories from students who landed the role." },
];

export default function AfterHoursPage() {
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
            className="min-h-screen w-full overflow-x-hidden bg-[#0D0F14] text-[#EDEFF4]"
            style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');
                .ah-display { font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif; }
                .ah-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
                @keyframes ah-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.35; }
                }
                .ah-pulse-dot { animation: ah-pulse 2s ease-in-out infinite; }
                @keyframes ah-swap-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .ah-swap { animation: ah-swap-in 0.32s ease both; }
                @media (prefers-reduced-motion: reduce) {
                    .ah-pulse-dot, .ah-swap { animation: none; }
                }
            `}</style>

            {/* ---------------- Header ---------------- */}
            <header className="sticky top-4 z-40 px-4">
                <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-[#12141C]/90 px-5 py-3 shadow-lg shadow-black/30 backdrop-blur-md">
                    <Link
                        to="/"
                        className="flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                    >
                        <span className="ah-display text-lg font-bold text-[#EDEFF4]">Tail&apos;ed</span>
                        {activeCount !== null ? (
                            <span className="hidden items-center gap-1.5 sm:flex">
                                <span className="ah-pulse-dot h-1.5 w-1.5 rounded-full bg-[#4ADE80]" aria-hidden="true" />
                                <span className="ah-mono text-[11px] font-medium text-white/50">
                                    {activeCount.toLocaleString("en-US")} live
                                </span>
                            </span>
                        ) : (
                            <span className="hidden h-3 w-16 animate-pulse rounded-full bg-white/5 sm:block" aria-hidden="true" />
                        )}
                    </Link>
                    <nav className="hidden items-center gap-1 md:flex">
                        {NAV_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="rounded-lg px-3.5 py-2 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-[#EDEFF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/sign-in"
                            className="hidden rounded text-sm font-medium text-white/60 hover:text-[#EDEFF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70 sm:inline-block"
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
            <section className="relative overflow-hidden px-5 pb-14 pt-14 md:pt-20">
                <div
                    className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-[#7C6CFF]/10 blur-3xl"
                    aria-hidden="true"
                />
                <div className="relative mx-auto max-w-6xl">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3.5 py-1">
                            <span className="text-xs font-medium text-white/60">
                                Non-profit · built by students · free forever
                            </span>
                        </div>
                        <h1 className="ah-display mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-[#EDEFF4] sm:text-6xl">
                            Stop refreshing job boards.
                            <br />
                            <span className="text-[#A79DFF]">Start catching the drops.</span>
                        </h1>
                        <p className="mt-5 max-w-xl text-lg text-white/60">
                            {jobsLabel} live internships &amp; new-grad roles from {companiesLabel} companies,
                            updated daily. No recruiters, no premium tier, no selling your data.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative w-full max-w-md">
                                <Search
                                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
                                    aria-hidden="true"
                                />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search role, company, location…"
                                    aria-label="Search jobs"
                                    className="w-full rounded-xl border border-white/10 bg-[#161922] py-3 pl-10 pr-3.5 text-sm text-[#EDEFF4] placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                                />
                            </div>
                            <Button onClick={() => focusAlertBuilder()} className="shrink-0 !py-3">
                                Get alerts
                            </Button>
                        </div>

                        {pulse && (
                            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                                <span className="flex items-center gap-2">
                                    <span className="ah-pulse-dot h-2 w-2 rounded-full bg-[#4ADE80]" aria-hidden="true" />
                                    <span className="ah-mono text-xs text-white/60">
                                        <span className="text-[#4ADE80]">{pulse.addedToday.toLocaleString("en-US")}</span>{" "}
                                        added today · {pulse.addedThisWeek.toLocaleString("en-US")} this week · last
                                        drop {pulse.lastDropLabel}
                                    </span>
                                </span>
                                <span className="flex items-center gap-2" title="Jobs posted per day, last 7 days">
                                    <PostingSparkline counts={pulse.dayCounts} />
                                    <span className="ah-mono text-[10px] uppercase tracking-wide text-white/35">7 days</span>
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
                            <p className="ah-mono text-xs font-semibold uppercase tracking-wide text-[#A79DFF]">
                                {isSearching ? "Full feed" : "Fresh tonight"}
                            </p>
                            <h2 className="ah-display mt-1 text-3xl font-bold text-[#EDEFF4]">
                                {isSearching ? "Search the whole board" : "Just landed"}
                            </h2>
                        </div>
                        {!isSearching && (
                            <Link
                                to="/jobs"
                                className="rounded text-sm font-semibold text-[#A79DFF] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                            >
                                See all {jobsLabel} jobs →
                            </Link>
                        )}
                    </div>

                    <div key={isSearching ? "results" : "grid"} className="ah-swap mt-8">
                        {!isSearching ? (
                            freshLoading ? (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-32 animate-pulse rounded-xl border border-white/10 bg-[#161922]" />
                                    ))}
                                </div>
                            ) : freshJobs.length === 0 ? (
                                <p className="text-sm text-white/40">
                                    The feed is quiet right now — check back shortly, or set up an alert to be notified.
                                </p>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {freshJobs.map((job) => (
                                        <Link
                                            key={job.id}
                                            to={`/jobs/e/${job.id}`}
                                            className="flex flex-col rounded-xl border border-white/10 bg-[#161922] p-4 transition hover:-translate-y-0.5 hover:border-[#7C6CFF]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                                        >
                                            <p className="ah-display truncate text-sm font-semibold text-[#EDEFF4]">
                                                {job.title}
                                            </p>
                                            <p className="mt-0.5 truncate text-sm text-white/50">{job.company_name}</p>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${jobTypeChipClass(job.type)}`}>
                                                    {jobTypeChipLabel(job.type)}
                                                </span>
                                                {job.locations[0] && (
                                                    <span className="truncate text-xs text-white/40">{job.locations[0]}</span>
                                                )}
                                            </div>
                                            <p className="ah-mono mt-2 text-xs text-white/35">{formatPostedLabel(job)}</p>
                                        </Link>
                                    ))}
                                </div>
                            )
                        ) : allLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-14 animate-pulse rounded-xl border border-white/10 bg-[#161922]" />
                                ))}
                                <p className="pt-1 text-xs text-white/40">Searching…</p>
                            </div>
                        ) : (
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-white/60">
                                        <span className="ah-mono">{filteredMatches.length.toLocaleString("en-US")}</span>{" "}
                                        match{filteredMatches.length === 1 ? "" : "es"} for &ldquo;{debouncedQuery.trim()}&rdquo;
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        {(["all", "internship", "new-grad"] as const).map((f) => (
                                            <button
                                                key={f}
                                                type="button"
                                                onClick={() => setTypeFilter(f)}
                                                className={`rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70 ${
                                                    typeFilter === f
                                                        ? "border-[#7C6CFF]/60 bg-[#7C6CFF]/15 text-[#A79DFF]"
                                                        : "border-white/10 text-white/50 hover:border-white/30"
                                                }`}
                                            >
                                                {f === "all" ? "All" : f === "internship" ? "Internships" : "New grad"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {filteredMatches.length > 0 && (
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#7C6CFF]/40 bg-[#7C6CFF]/5 px-4 py-3">
                                        <p className="text-sm text-white/70">
                                            Get a {frequency} email when new &ldquo;{debouncedQuery.trim()}&rdquo; roles drop.
                                        </p>
                                        <Button onClick={() => focusAlertBuilder(searchQuery.trim())} className="shrink-0 !px-4 !py-2 !text-xs">
                                            Get alerts for this search
                                        </Button>
                                    </div>
                                )}

                                {filteredMatches.length === 0 ? (
                                    <div className="mt-6 rounded-xl border border-white/10 bg-[#161922] p-6 text-center">
                                        <p className="text-sm text-white/60">
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
                                    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#161922]">
                                        <div className="hidden grid-cols-[2fr_1.2fr_6.5rem_7.5rem] gap-3 border-b border-white/5 px-4 py-2 sm:grid">
                                            <span className="ah-mono text-[11px] font-medium uppercase tracking-wide text-white/40">
                                                Role
                                            </span>
                                            <span className="ah-mono text-[11px] font-medium uppercase tracking-wide text-white/40">
                                                Location
                                            </span>
                                            <span className="ah-mono text-[11px] font-medium uppercase tracking-wide text-white/40">
                                                Type
                                            </span>
                                            <span className="ah-mono text-right text-[11px] font-medium uppercase tracking-wide text-white/40">
                                                Posted
                                            </span>
                                        </div>
                                        <div>
                                            {displayedMatches.map((job, i) => (
                                                <Link
                                                    key={job.id}
                                                    to={`/jobs/e/${job.id}`}
                                                    className={`grid grid-cols-1 gap-1 px-4 py-3 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7C6CFF]/70 sm:grid-cols-[2fr_1.2fr_6.5rem_7.5rem] sm:items-center sm:gap-3 ${
                                                        i === 0 ? "" : "border-t border-white/5"
                                                    }`}
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-[#EDEFF4]">{job.title}</p>
                                                        <p className="truncate text-xs text-white/45">{job.company_name}</p>
                                                    </div>
                                                    <span className="truncate text-xs text-white/45 sm:text-sm">
                                                        {job.locations[0] ?? "Remote / Unlisted"}
                                                    </span>
                                                    <span
                                                        className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${jobTypeChipClass(job.type)}`}
                                                    >
                                                        {jobTypeChipLabel(job.type)}
                                                    </span>
                                                    <span className="ah-mono whitespace-nowrap text-xs text-white/35 sm:text-right">
                                                        {formatPostedLabel(job)}
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <Link
                                    to={`/jobs?search=${encodeURIComponent(debouncedQuery.trim())}`}
                                    className="mt-4 inline-block rounded text-sm font-semibold text-[#A79DFF] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                                >
                                    See all {filteredMatches.length.toLocaleString("en-US")} on the job board →
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Alert builder ---------------- */}
            <section ref={alertSectionRef} id="alert-builder" className="relative overflow-hidden px-5 py-16">
                <div
                    className="pointer-events-none absolute left-1/2 top-8 h-[320px] w-[560px] -translate-x-1/2 rounded-full bg-[#7C6CFF]/10 blur-3xl"
                    aria-hidden="true"
                />
                <div className="relative mx-auto max-w-2xl">
                    <div className="text-center">
                        <h2 className="ah-display text-3xl font-bold text-[#EDEFF4]">Get alerts, not spam</h2>
                        <p className="mt-2 text-white/60">
                            Tell us what you&apos;re hunting for — we&apos;ll email you the moment matching roles drop.
                            Nothing else, ever.
                        </p>
                    </div>

                    <div className="mt-8 rounded-2xl border border-white/10 bg-[#161922] p-6 sm:p-8">
                        {subscribed ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4ADE80]/10">
                                    <Check className="h-5 w-5 text-[#4ADE80]" aria-hidden="true" />
                                </span>
                                <p className="ah-display text-lg font-semibold text-[#EDEFF4]">
                                    You&apos;re set — first digest tomorrow morning
                                </p>
                                <p className="ah-mono text-sm text-white/50">{scopeSummary(frequency, alertQuery, jobType)}</p>
                                <button
                                    type="button"
                                    onClick={() => setSubscribed(false)}
                                    className="mt-1 rounded text-sm font-medium text-[#A79DFF] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                                >
                                    Edit alert
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Frequency</p>
                                        <div className="mt-2 inline-flex rounded-lg bg-white/5 p-1">
                                            {(["daily", "weekly"] as const).map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setFrequency(f)}
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70 ${
                                                        frequency === f ? "bg-[#5F4FE0] text-white" : "text-white/50"
                                                    }`}
                                                >
                                                    {f === "daily" ? "Daily" : "Weekly"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Job type</p>
                                        <div className="mt-2 inline-flex rounded-lg bg-white/5 p-1">
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
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70 ${
                                                        jobType === opt.value ? "bg-[#5F4FE0] text-white" : "text-white/50"
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Keywords</p>
                                    <input
                                        ref={keywordInputRef}
                                        value={alertQuery}
                                        onChange={(e) => setAlertQuery(e.target.value)}
                                        placeholder="react, data, Toronto — optional"
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-[#0D0F14] px-3.5 py-2.5 text-sm text-[#EDEFF4] placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                                    />
                                </div>

                                <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                    <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2 sm:flex-row">
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@school.edu"
                                            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0D0F14] px-3.5 py-2.5 text-sm text-[#EDEFF4] placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                                        />
                                        <Button type="submit" className="shrink-0">
                                            {submitting ? "Signing up…" : "Get alerts"}
                                        </Button>
                                    </form>

                                    <span className="hidden text-center text-xs font-medium uppercase tracking-wide text-white/30 sm:block">
                                        or
                                    </span>

                                    <div>
                                        <button
                                            type="button"
                                            onClick={handleGoogleContinue}
                                            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-[#1c1c1c] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                                        >
                                            <FcGoogle className="h-4 w-4" aria-hidden="true" />
                                            Continue with Google
                                        </button>
                                        <p className="mt-1.5 text-center text-xs text-white/40 sm:text-left">
                                            We&apos;ll create your account and save this alert.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Built after hours (human element) ---------------- */}
            <section className="border-t border-white/10 px-5 py-16">
                <div className="mx-auto max-w-2xl">
                    <p className="ah-mono text-xs font-semibold uppercase tracking-wide text-[#A79DFF]">Why free?</p>
                    <h2 className="ah-display mt-1 text-2xl font-bold text-[#EDEFF4]">
                        Built after hours, by students.
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">
                        Tail&apos;ed is a non-profit run by students who were also sick of job boards — no
                        investors, no premium tier, no selling your resume. This site gets built between
                        lectures and late-night commits, and every line of it is public. If it helps you land
                        the role, that&apos;s the whole business model.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded text-sm font-semibold text-[#A79DFF] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                        >
                            <Github className="h-4 w-4" aria-hidden="true" />
                            We build in the open
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded text-sm font-semibold text-[#A79DFF] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                        >
                            <SiDiscord className="h-4 w-4" aria-hidden="true" />
                            Come say hi on Discord
                        </a>
                    </div>
                </div>
            </section>

            {/* ---------------- Beyond the board ---------------- */}
            <section className="border-t border-white/10 px-5 py-14">
                <div className="mx-auto max-w-5xl">
                    <h2 className="ah-display text-2xl font-bold text-[#EDEFF4]">Beyond the job board</h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-3">
                        {COMMUNITY_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                            >
                                <p className="ah-display text-base font-semibold text-[#EDEFF4]">
                                    {item.title}{" "}
                                    <ArrowRight
                                        className="inline-block h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-[#A79DFF]"
                                        aria-hidden="true"
                                    />
                                </p>
                                <p className="mt-1 text-sm text-white/55">{item.blurb}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------------- Footer ---------------- */}
            <footer className="border-t border-white/10 px-5 py-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
                    <div className="flex items-center gap-2">
                        <span className="ah-display text-sm font-semibold text-[#EDEFF4]">Tail&apos;ed</span>
                        <span className="text-xs text-white/40">· shipped after class, free forever</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-white/50">
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded hover:text-[#EDEFF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                        >
                            GitHub
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded hover:text-[#EDEFF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
                        >
                            Discord
                        </a>
                        <Link
                            to="/sign-in"
                            className="rounded hover:text-[#EDEFF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6CFF]/70"
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
