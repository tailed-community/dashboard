import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Search } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { SiDiscord } from "react-icons/si";
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

const INK = "#1C1C1C";
const VIOLET = "#6C3BFF";
const PINK = "#FF90E8";
const YELLOW = "#FFD600";

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

/** Tiny 7-day posting histogram; today's bar pops in violet, the rest sit back in ink at low opacity. */
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
                        fill={isToday ? VIOLET : INK}
                        opacity={isToday ? 1 : 0.2}
                    />
                );
            })}
        </svg>
    );
}

/** Monogram-square fills cycled across job cards; black text except on violet. */
const MONOGRAM_FILLS: { bg: string; text: string }[] = [
    { bg: VIOLET, text: "#ffffff" },
    { bg: PINK, text: INK },
    { bg: YELLOW, text: INK },
];

/** Derives 1-2 letter initials from a company name for the monogram square. */
function monogram(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function jobTypeChipLabel(type: "internship" | "new-grad"): string {
    return type === "internship" ? "Internship" : "New grad";
}

function jobTypeChipClass(type: "internship" | "new-grad"): string {
    return type === "internship"
        ? "bg-[#6C3BFF]/10 text-[#5227CC]"
        : "bg-black/5 text-black/60";
}

/** "Daily · react intern · Internships" style summary of a configured alert. */
function scopeSummary(
    frequency: "daily" | "weekly",
    query: string,
    jobType: "internship" | "new-grad" | null,
): string {
    const freqLabel = frequency === "daily" ? "Daily" : "Weekly";
    const typeLabel =
        jobType === "internship" ? "Internships" : jobType === "new-grad" ? "New grad" : "Internships & new grad";
    const queryLabel = query.trim() || "All roles";
    return `${freqLabel} · ${queryLabel} · ${typeLabel}`;
}

const FOCUS_RING =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6C3BFF]";

/** Poster button: 2px ink border, flat fill, crisp offset shadow on emphasis. */
function Button({
    children,
    to,
    variant = "primary",
    className = "",
    onClick,
    type = "button",
    disabled = false,
}: {
    children: React.ReactNode;
    to?: string;
    variant?: "primary" | "outline" | "quiet";
    className?: string;
    onClick?: () => void;
    type?: "button" | "submit";
    disabled?: boolean;
}) {
    const base = `inline-flex items-center justify-center gap-2 rounded-lg border-2 px-5 py-2.5 text-sm font-bold transition-all duration-150 ${FOCUS_RING}`;
    const styles: Record<string, string> = {
        primary:
            "border-[#1C1C1C] bg-[#6C3BFF] text-white shadow-[4px_4px_0_#1C1C1C] hover:bg-[#5227CC] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#1C1C1C]",
        outline: "border-[#1C1C1C] bg-white text-[#1C1C1C] hover:bg-black/5 active:translate-y-px",
        quiet: "border-transparent text-black/60 hover:text-[#1C1C1C]",
    };
    const cls = `${base} ${styles[variant]} ${className} ${disabled ? "opacity-60" : ""}`;
    if (to) {
        return (
            <Link to={to} className={cls}>
                {children}
            </Link>
        );
    }
    return (
        <button type={type} onClick={onClick} className={cls} disabled={disabled}>
            {children}
        </button>
    );
}

/** One row in the search-results list; fixed grid columns keep title/company vs. chip/date aligned across rows. */
function ResultRow({ job, first }: { job: ExternalJob; first: boolean }) {
    return (
        <li className={first ? "" : "border-t border-black/10"}>
            <Link
                to={`/jobs/e/${job.id}`}
                className={`grid grid-cols-1 gap-1 px-4 py-3 text-sm transition-colors hover:bg-[#FFD600]/15 sm:grid-cols-[1.4fr_2fr_1.2fr_6.5rem_7.5rem] sm:items-center sm:gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#6C3BFF]`}
            >
                <span className="truncate font-bold">{job.company_name}</span>
                <span className="truncate text-black/80">{job.title}</span>
                <span className="truncate text-black/50">{job.locations[0] ?? "Remote / Unlisted"}</span>
                <span className={`w-fit rounded px-2 py-0.5 text-xs font-semibold ${jobTypeChipClass(job.type)}`}>
                    {jobTypeChipLabel(job.type)}
                </span>
                <span className="poster-mono whitespace-nowrap text-[11px] text-black/40 sm:text-right">
                    {formatPostedLabel(job)}
                </span>
            </Link>
        </li>
    );
}

const NAV_LINKS = [
    { label: "Jobs", to: "/jobs" },
    { label: "Events", to: "/events" },
    { label: "Communities", to: "/communities" },
    { label: "Spotlight", to: "/spotlight" },
];

/** Events / Communities / Spotlight tiles; black text on pink/yellow, white on violet. */
const BEYOND_TILES = [
    {
        to: "/events",
        title: "Events",
        blurb: "Career fairs, workshops, hackathons — find what's next.",
        bg: VIOLET,
        text: "#ffffff",
    },
    {
        to: "/communities",
        title: "Communities",
        blurb: "Student-run clubs and orgs building careers together.",
        bg: PINK,
        text: INK,
    },
    {
        to: "/spotlight",
        title: "Spotlight",
        blurb: "Real stories from students who landed the role.",
        bg: YELLOW,
        text: INK,
    },
];

export default function PosterPage() {
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
        [rawMatches],
    );
    const filteredMatches = useMemo<ExternalJob[]>(
        () => (typeFilter === "all" ? sortedMatches : sortedMatches.filter((j) => j.type === typeFilter)),
        [sortedMatches, typeFilter],
    );
    const displayedMatches = filteredMatches.slice(0, 25);

    // ---------------- Feed pulse (real feed data, no streaks) ----------------
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
        if (prefillQuery !== undefined) {
            setAlertQuery(prefillQuery);
            setSubscribed(false);
        }
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
            className="min-h-screen w-full overflow-x-hidden bg-[#FFFDF8] text-[#1C1C1C]"
            style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
                .poster-display { font-family: 'Archivo', ui-sans-serif, system-ui, sans-serif; }
                .poster-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
                @keyframes posterSwapIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .poster-swap { animation: posterSwapIn 0.28s ease both; }
                @keyframes posterPulseDot {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.35; }
                }
                .poster-pulse-dot { animation: posterPulseDot 2s ease-in-out infinite; }
                @media (prefers-reduced-motion: reduce) {
                    .poster-swap, .poster-pulse-dot { animation: none; }
                }
            `}</style>

            {/* ---------------- Header ---------------- */}
            {/* No background rectangle or full-width rule: the header sits on the same
                warm-white field as the hero below it, separated only by spacing. The
                wordmark gets a single hand-drawn ink underline stroke as its one
                illustrative flourish, echoing the sticker-badge language used elsewhere. */}
            <header className="relative z-10">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pb-5 pt-7">
                    <Link to="/" className={`flex items-center gap-2.5 rounded ${FOCUS_RING}`}>
                        <span className="relative inline-block">
                            <span className="poster-display text-xl font-black tracking-tight">Tail&apos;ed Community</span>
                            <svg
                                className="pointer-events-none absolute -bottom-1.5 left-0 h-2 w-full"
                                viewBox="0 0 100 8"
                                preserveAspectRatio="none"
                                aria-hidden="true"
                            >
                                <path
                                    d="M1 5.5 Q 25 1, 50 4.5 T 99 3"
                                    fill="none"
                                    stroke={INK}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </span>
                        {activeCount !== null && (
                            <span className="poster-mono hidden rounded border-2 border-[#1C1C1C] bg-[#FFD600] px-1.5 py-0.5 text-[11px] font-bold text-[#1C1C1C] sm:inline-block">
                                {activeCount.toLocaleString("en-US")} live
                            </span>
                        )}
                    </Link>
                    <nav className="hidden items-center gap-1 md:flex">
                        {NAV_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`rounded-lg px-3.5 py-2 text-sm font-semibold text-black/60 transition hover:bg-black/5 hover:text-[#1C1C1C] ${FOCUS_RING}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/sign-in"
                            className={`hidden rounded text-sm font-semibold text-black/60 hover:text-[#1C1C1C] sm:inline-block ${FOCUS_RING}`}
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
            <section className="px-5 pb-12 pt-12 md:pt-16">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-7 flex flex-wrap items-center gap-3">
                        <span className="-rotate-2 rounded border-2 border-[#1C1C1C] bg-[#FF90E8] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#1C1C1C]">
                            Non-profit ★
                        </span>
                        <span className="rotate-1 rounded border-2 border-[#1C1C1C] bg-[#FFD600] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#1C1C1C]">
                            Free forever · $0.00
                        </span>
                        <span className="poster-mono text-xs font-medium text-black/50">
                            for humans, not ATS bots
                        </span>
                    </div>

                    <h1 className="poster-display max-w-3xl text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
                        {jobsLabel} jobs.
                        <br />
                        <span className="text-[#6C3BFF]">No suits, no spam.</span>
                    </h1>

                    <p className="mt-6 max-w-xl text-lg font-medium leading-snug text-black/70">
                        Tail&apos;ed Community is a non-profit run by students who were also sick of job
                        boards. No recruiters, no premium tier, no selling your resume.
                    </p>

                    <div className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                            <Search
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35"
                                aria-hidden="true"
                            />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="SWE intern, Toronto, Shopify…"
                                aria-label="Search jobs"
                                className={`w-full rounded-lg border-2 border-[#1C1C1C] bg-white py-2.5 pl-10 pr-3.5 text-sm font-medium text-[#1C1C1C] placeholder:text-black/40 focus:outline-none ${FOCUS_RING}`}
                            />
                        </div>
                        <Button onClick={() => focusAlertBuilder()} className="shrink-0">
                            Get alerts <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>

                    {pulse && (
                        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                            <span className="flex items-center gap-2 rounded-lg border-2 border-[#1C1C1C] bg-white px-2.5 py-1.5">
                                <span
                                    className="poster-pulse-dot h-2 w-2 rounded-full bg-[#6C3BFF]"
                                    aria-hidden="true"
                                />
                                <span className="poster-mono text-xs font-bold text-[#5227CC]">
                                    {pulse.addedToday.toLocaleString("en-US")} added today ·{" "}
                                    {pulse.addedThisWeek.toLocaleString("en-US")} this week · last drop{" "}
                                    {pulse.lastDropLabel}
                                </span>
                            </span>
                            <span className="flex items-center gap-2" title="Jobs posted per day, last 7 days">
                                <PostingSparkline counts={pulse.dayCounts} />
                                <span className="poster-mono text-[10px] font-bold uppercase tracking-wide text-black/40">
                                    7 days
                                </span>
                            </span>
                        </div>
                    )}
                    <p className="poster-mono mt-3 text-xs font-medium text-black/45">
                        {companiesLabel} companies hiring right now
                    </p>
                </div>
            </section>

            {/* ---------------- Jobs / search-swap ---------------- */}
            <section className="px-5 py-12">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <h2 className="poster-display text-3xl font-black tracking-tight">
                            {isSearching ? "Search the full feed" : "Fresh off the feed"}
                        </h2>
                        {!isSearching && (
                            <Link
                                to="/jobs"
                                className={`rounded text-sm font-bold text-[#5227CC] hover:underline ${FOCUS_RING}`}
                            >
                                See all {jobsLabel} jobs →
                            </Link>
                        )}
                    </div>

                    <div key={isSearching ? "results" : "grid"} className="poster-swap mt-7">
                        {!isSearching ? (
                            freshLoading ? (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-32 animate-pulse rounded-lg border-2 border-black/15 bg-white" />
                                    ))}
                                </div>
                            ) : freshJobs.length === 0 ? (
                                <p className="text-sm text-black/50">
                                    The feed is quiet right now — check back shortly, or set up an alert to be notified.
                                </p>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {freshJobs.map((job, i) => {
                                        const fill = MONOGRAM_FILLS[i % MONOGRAM_FILLS.length];
                                        return (
                                            <Link
                                                key={job.id}
                                                to={`/jobs/e/${job.id}`}
                                                className={`flex flex-col rounded-lg border-2 border-[#1C1C1C] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C1C1C] ${FOCUS_RING}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span
                                                        className="poster-display flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-[#1C1C1C] text-sm font-black"
                                                        style={{ backgroundColor: fill.bg, color: fill.text }}
                                                        aria-hidden="true"
                                                    >
                                                        {monogram(job.company_name)}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-bold">{job.title}</p>
                                                        <p className="mt-0.5 truncate text-sm text-black/55">{job.company_name}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${jobTypeChipClass(job.type)}`}>
                                                        {jobTypeChipLabel(job.type)}
                                                    </span>
                                                    {job.locations[0] && (
                                                        <span className="truncate text-xs text-black/45">{job.locations[0]}</span>
                                                    )}
                                                    <span className="poster-mono ml-auto whitespace-nowrap text-[11px] text-black/40">
                                                        {formatPostedLabel(job)}
                                                    </span>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )
                        ) : allLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-14 animate-pulse rounded-lg border-2 border-black/15 bg-white" />
                                ))}
                                <p className="poster-mono pt-1 text-xs text-black/45">Searching…</p>
                            </div>
                        ) : (
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-black/70">
                                        {filteredMatches.length.toLocaleString("en-US")} match
                                        {filteredMatches.length === 1 ? "" : "es"} for &ldquo;{debouncedQuery.trim()}&rdquo;
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-1.5">
                                            {(["all", "internship", "new-grad"] as const).map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setTypeFilter(f)}
                                                    aria-pressed={typeFilter === f}
                                                    className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition ${FOCUS_RING} ${
                                                        typeFilter === f
                                                            ? "border-[#1C1C1C] bg-[#1C1C1C] text-white"
                                                            : "border-black/20 text-black/55 hover:border-[#1C1C1C]"
                                                    }`}
                                                >
                                                    {f === "all" ? "All" : f === "internship" ? "Internships" : "New grad"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {filteredMatches.length > 0 && (
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-dashed border-[#6C3BFF]/50 bg-[#6C3BFF]/5 px-4 py-3">
                                        <p className="text-sm font-medium text-black/75">
                                            Get a {frequency} email when new &ldquo;{debouncedQuery.trim()}&rdquo; roles drop.
                                        </p>
                                        <Button
                                            onClick={() => focusAlertBuilder(searchQuery.trim())}
                                            className="!px-4 !py-2 !text-xs shrink-0"
                                        >
                                            Get alerts for this search
                                        </Button>
                                    </div>
                                )}

                                {filteredMatches.length === 0 ? (
                                    <div className="mt-6 rounded-lg border-2 border-[#1C1C1C] bg-white p-6 text-center">
                                        <p className="text-sm text-black/70">
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
                                    <div className="mt-4 overflow-hidden overflow-x-auto rounded-lg border-2 border-[#1C1C1C] bg-white">
                                        <div className="hidden grid-cols-[1.4fr_2fr_1.2fr_6.5rem_7.5rem] gap-3 border-b-2 border-[#1C1C1C] bg-black/5 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-black/50 sm:grid">
                                            <span>Company</span>
                                            <span>Role</span>
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
                                    to={`/jobs?search=${encodeURIComponent(debouncedQuery.trim())}`}
                                    className={`mt-4 inline-block rounded text-sm font-bold text-[#5227CC] hover:underline ${FOCUS_RING}`}
                                >
                                    See all {filteredMatches.length.toLocaleString("en-US")} on the board →
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Alert builder ---------------- */}
            <section ref={alertSectionRef} id="alert-builder" className="px-5 py-16">
                <div className="mx-auto max-w-2xl">
                    <div className="text-center">
                        <h2 className="poster-display text-3xl font-black tracking-tight">
                            Alerts, not spam
                        </h2>
                        <p className="mt-2 font-medium text-black/65">
                            Tell us what you&apos;re hunting for. We&apos;ll email you when it
                            drops — nothing else, ever.
                        </p>
                    </div>

                    <div className="relative mt-9 rounded-xl border-2 border-[#1C1C1C] bg-white p-6 shadow-[4px_4px_0_#1C1C1C] sm:p-8">
                        <span className="absolute -top-4 right-4 rotate-2 rounded border-2 border-[#1C1C1C] bg-[#FFD600] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#1C1C1C]">
                            Free intel
                        </span>

                        {subscribed ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#1C1C1C] bg-[#FF90E8]">
                                    <Check className="h-5 w-5 text-[#1C1C1C]" aria-hidden="true" />
                                </span>
                                <p className="poster-display text-lg font-black">
                                    You&apos;re in — first digest tomorrow morning
                                </p>
                                <p className="poster-mono text-xs text-black/55">
                                    {scopeSummary(frequency, alertQuery, jobType)}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSubscribed(false)}
                                    className={`mt-1 rounded text-sm font-bold text-[#5227CC] hover:underline ${FOCUS_RING}`}
                                >
                                    Edit alert
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wide text-black/50">Frequency</p>
                                        <div className="mt-2 inline-flex rounded-lg border-2 border-[#1C1C1C] bg-white p-1">
                                            {(["daily", "weekly"] as const).map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setFrequency(f)}
                                                    aria-pressed={frequency === f}
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition ${FOCUS_RING} ${
                                                        frequency === f ? "bg-[#6C3BFF] text-white" : "text-black/55"
                                                    }`}
                                                >
                                                    {f === "daily" ? "Daily" : "Weekly"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-wide text-black/50">Job type</p>
                                        <div className="mt-2 inline-flex rounded-lg border-2 border-[#1C1C1C] bg-white p-1">
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
                                                    aria-pressed={jobType === opt.value}
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition ${FOCUS_RING} ${
                                                        jobType === opt.value ? "bg-[#6C3BFF] text-white" : "text-black/55"
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <label className="text-xs font-black uppercase tracking-wide text-black/50" htmlFor="poster-keywords">
                                        Keywords (optional)
                                    </label>
                                    <input
                                        id="poster-keywords"
                                        ref={keywordInputRef}
                                        value={alertQuery}
                                        onChange={(e) => setAlertQuery(e.target.value)}
                                        placeholder="react, data, Toronto…"
                                        className={`mt-2 w-full rounded-lg border-2 border-[#1C1C1C] bg-[#FFFDF8] px-3.5 py-2.5 text-sm font-medium text-[#1C1C1C] placeholder:text-black/40 focus:outline-none ${FOCUS_RING}`}
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
                                            aria-label="Email address"
                                            className={`min-w-0 flex-1 rounded-lg border-2 border-[#1C1C1C] bg-white px-3.5 py-2.5 text-sm font-medium text-[#1C1C1C] placeholder:text-black/40 focus:outline-none ${FOCUS_RING}`}
                                        />
                                        <Button type="submit" className="shrink-0" disabled={submitting}>
                                            {submitting ? "Signing up…" : "Get alerts"}
                                        </Button>
                                    </form>

                                    <span className="hidden text-center text-xs font-bold uppercase tracking-wide text-black/35 sm:block">
                                        or
                                    </span>

                                    <div>
                                        <button
                                            type="button"
                                            onClick={handleGoogleContinue}
                                            className={`flex w-full items-center justify-center gap-2.5 rounded-lg border-2 border-[#1C1C1C] bg-white px-4 py-2.5 text-sm font-bold text-[#1C1C1C] transition hover:bg-black/5 ${FOCUS_RING}`}
                                        >
                                            <FcGoogle className="h-4 w-4" aria-hidden="true" />
                                            Continue with Google
                                        </button>
                                        <p className="mt-1.5 text-center text-xs text-black/45 sm:text-left">
                                            We&apos;ll create your account and save this alert.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Why free (honest human element) ---------------- */}
            <section className="border-y-2 border-[#1C1C1C] bg-[#1C1C1C] px-5 py-14 text-[#FFFDF8]">
                <div className="mx-auto max-w-3xl">
                    <h2 className="poster-display text-3xl font-black tracking-tight text-[#FFD600]">
                        Why is this free?
                    </h2>
                    <p className="mt-4 text-lg leading-relaxed">
                        Tail&apos;ed Community is a non-profit built by students, for students. We
                        don&apos;t sell your data, and there is no premium tier hiding the good
                        jobs. Every line of code is public.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-5">
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded text-sm font-bold uppercase tracking-wide underline decoration-2 underline-offset-4 hover:text-[#FF90E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFFDF8]"
                        >
                            We build in the open
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded text-sm font-bold uppercase tracking-wide underline decoration-2 underline-offset-4 hover:text-[#FF90E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFFDF8]"
                        >
                            <SiDiscord className="h-4 w-4" aria-hidden="true" />
                            Come say hi
                        </a>
                    </div>
                </div>
            </section>

            {/* ---------------- Beyond the board ---------------- */}
            <section className="px-5 py-14">
                <div className="mx-auto max-w-6xl">
                    <h2 className="poster-display text-2xl font-black tracking-tight">Beyond the job board</h2>
                    <div className="mt-6 grid gap-5 sm:grid-cols-3">
                        {BEYOND_TILES.map((tile) => (
                            <Link
                                key={tile.to}
                                to={tile.to}
                                className={`group flex flex-col justify-between rounded-xl border-2 border-[#1C1C1C] p-6 transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1C1C1C] ${FOCUS_RING}`}
                                style={{ backgroundColor: tile.bg, color: tile.text }}
                            >
                                <div>
                                    <h3 className="poster-display text-xl font-black">{tile.title}</h3>
                                    <p className="mt-2 text-sm font-medium">{tile.blurb}</p>
                                </div>
                                <ArrowRight
                                    className="mt-6 h-5 w-5 transition-transform group-hover:translate-x-1"
                                    aria-hidden="true"
                                />
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------------- Final CTA ---------------- */}
            <section className="px-5 pb-16">
                <div className="mx-auto max-w-6xl rounded-xl border-2 border-[#1C1C1C] bg-white p-8 text-center shadow-[4px_4px_0_#1C1C1C] sm:p-12">
                    <h2 className="poster-display text-4xl font-black leading-[0.98] tracking-tight sm:text-5xl">
                        Stop scrolling.
                        <br />
                        <span className="text-[#6C3BFF]">Start applying.</span>
                    </h2>
                    <div className="mt-7">
                        <Button onClick={() => focusAlertBuilder()} className="!px-7 !py-3 !text-base">
                            Get alerts <ArrowRight className="h-5 w-5" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            </section>

            {/* ---------------- Footer ---------------- */}
            <footer className="border-t-2 border-[#1C1C1C] bg-[#1C1C1C] px-5 py-8 text-[#FFFDF8]">
                <div className="poster-mono mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs uppercase tracking-wide sm:flex-row">
                    <p>&copy; Tail&apos;ed Community — non-profit, built by students.</p>
                    <nav className="flex flex-wrap items-center justify-center gap-4">
                        <Link
                            to="/about"
                            className="hover:text-[#FFD600] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFFDF8]"
                        >
                            About
                        </Link>
                        <Link
                            to="/jobs"
                            className="hover:text-[#FFD600] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFFDF8]"
                        >
                            Jobs
                        </Link>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-[#FFD600] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFFDF8]"
                        >
                            <SiDiscord className="h-3.5 w-3.5" aria-hidden="true" />
                            Discord
                        </a>
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#FFD600] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFFDF8]"
                        >
                            GitHub
                        </a>
                    </nav>
                </div>
            </footer>

            <LabSwitcher />
        </div>
    );
}
