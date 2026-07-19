import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Flame, Check } from "lucide-react";
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

/** Small line-art fox head — the page's one, restrained mascot appearance. */
function FoxMark({ size = 24 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M4 9 L7 3 L10 8" />
            <path d="M20 9 L17 3 L14 8" />
            <path d="M4 9 C4 15.5 7.8 20 12 20 C16.2 20 20 15.5 20 9 C17.5 10.4 14.8 11 12 11 C9.2 11 6.5 10.4 4 9 Z" />
            <circle cx="9.5" cy="13.6" r="0.55" fill="currentColor" stroke="none" />
            <circle cx="14.5" cy="13.6" r="0.55" fill="currentColor" stroke="none" />
        </svg>
    );
}

function jobTypeChipLabel(type: "internship" | "new-grad"): string {
    return type === "internship" ? "Internship" : "New grad";
}

function jobTypeChipClass(type: "internship" | "new-grad"): string {
    return type === "internship"
        ? "bg-[#f06c1f]/10 text-[#c74a05]"
        : "bg-black/5 text-black/60";
}

/** "Daily · react intern · Internships" style summary of a configured alert. */
function scopeSummary(frequency: "daily" | "weekly", query: string, jobType: "internship" | "new-grad" | null): string {
    const freqLabel = frequency === "daily" ? "Daily" : "Weekly";
    const typeLabel =
        jobType === "internship" ? "Internships" : jobType === "new-grad" ? "New grad" : "Internships & new grad";
    const queryLabel = query.trim() || "All roles";
    return `${freqLabel} · ${queryLabel} · ${typeLabel}`;
}

/** Chunky-but-grown-up button: rounded, single hero-orange accent, a subtle pressed edge. */
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
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50";
    const styles: Record<string, string> = {
        primary:
            "bg-[#f06c1f] text-white shadow-[0_3px_0_#c74a05] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_#c74a05]",
        outline:
            "border border-black/15 bg-white text-[#241b12] hover:border-black/30 active:translate-y-px",
        quiet: "text-black/60 hover:text-[#241b12]",
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
    { to: "/communities", title: "Communities", blurb: "Find student groups building in your field." },
    { to: "/events", title: "Events", blurb: "Workshops, meetups, and career events near you." },
    { to: "/spotlight", title: "Spotlight", blurb: "Real stories from students who landed the role." },
];

export default function StreakDuoPage() {
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
            keywordInputRef.current?.focus();
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
            className="min-h-screen w-full overflow-x-hidden bg-[#fdf8ee] text-[#241b12]"
            style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
                .font-display { font-family: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif; }
                @keyframes labSwapIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .lab-swap { animation: labSwapIn 0.32s ease both; }
            `}</style>

            {/* ---------------- Header ---------------- */}
            <header className="sticky top-0 z-40 border-b border-black/10 bg-[#fdf8ee]/95 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
                    <Link to="/" className="flex items-center gap-2 text-[#241b12]">
                        <FoxMark size={22} />
                        <span className="font-display text-lg font-bold">Tail&apos;ed Community</span>
                    </Link>
                    <nav className="hidden items-center gap-1 md:flex">
                        {NAV_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="rounded-lg px-3.5 py-2 text-sm font-medium text-black/60 transition hover:bg-black/5 hover:text-[#241b12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/sign-in"
                            className="hidden text-sm font-medium text-black/60 hover:text-[#241b12] sm:inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 rounded"
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
            <section className="px-5 pb-14 pt-12 md:pt-16">
                <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:items-center">
                    <div>
                        <div className="inline-flex items-center rounded-full border border-black/10 bg-white px-3.5 py-1">
                            <span className="text-xs font-medium text-black/60">
                                Free forever · student-run non-profit
                            </span>
                        </div>
                        <h1 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight text-[#241b12] sm:text-5xl">
                            Never miss the drop.
                        </h1>
                        <p className="mt-5 max-w-md text-lg text-black/60">
                            {jobsLabel} live internships &amp; new-grad roles, updated daily. Set up an
                            alert once, and let the roles come to you.
                        </p>
                        <div className="mt-7 flex flex-wrap items-center gap-3">
                            <Button onClick={() => focusAlertBuilder()}>Get alerts</Button>
                            <Button to="/jobs" variant="outline">
                                Browse {jobsLabel} jobs
                            </Button>
                        </div>
                        <p className="mt-8 text-sm font-medium text-black/40">
                            {companiesLabel} companies hiring right now
                        </p>
                    </div>

                    {/* Momentum / streak card */}
                    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-[0_3px_0_rgba(36,27,18,0.06)]">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-black/40">
                                Product preview
                            </span>
                            <Flame className="h-4 w-4 text-[#f06c1f]" aria-hidden="true" />
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="font-display text-4xl font-bold text-[#241b12]">12</span>
                            <span className="text-sm font-medium text-black/50">day streak</span>
                        </div>
                        <div className="mt-4 flex items-center gap-1.5">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <span
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full ${i < 5 ? "bg-[#f06c1f]" : "bg-black/10"}`}
                                />
                            ))}
                        </div>
                        <p className="mt-3 text-sm text-black/60">
                            Check in daily, keep the streak, never miss a drop.
                        </p>
                    </div>
                </div>
            </section>

            {/* ---------------- Jobs / search-swap ---------------- */}
            <section className="px-5 py-14">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#c74a05]">
                                Fresh drops
                            </p>
                            <h2 className="mt-1 font-display text-3xl font-bold text-[#241b12]">
                                {isSearching ? "Search the full feed" : "Just landed"}
                            </h2>
                        </div>
                        <div className="relative w-full max-w-sm">
                            <Search
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30"
                                aria-hidden="true"
                            />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search role, company, location…"
                                className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#241b12] placeholder:text-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50"
                            />
                        </div>
                    </div>

                    <div key={isSearching ? "results" : "grid"} className="lab-swap mt-8">
                        {!isSearching ? (
                            freshLoading ? (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-32 animate-pulse rounded-xl border border-black/10 bg-white/70" />
                                    ))}
                                </div>
                            ) : freshJobs.length === 0 ? (
                                <p className="text-sm text-black/40">
                                    The feed is quiet right now — check back shortly, or set up an alert to be notified.
                                </p>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {freshJobs.map((job) => (
                                        <Link
                                            key={job.id}
                                            to={`/jobs/e/${job.id}`}
                                            className="flex flex-col rounded-xl border border-black/10 bg-white p-4 transition hover:border-[#f06c1f]/40 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50"
                                        >
                                            <p className="truncate font-display text-sm font-semibold text-[#241b12]">
                                                {job.title}
                                            </p>
                                            <p className="mt-0.5 truncate text-sm text-black/50">{job.company_name}</p>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${jobTypeChipClass(job.type)}`}>
                                                    {jobTypeChipLabel(job.type)}
                                                </span>
                                                {job.locations[0] && (
                                                    <span className="truncate text-xs text-black/40">{job.locations[0]}</span>
                                                )}
                                            </div>
                                            <p className="mt-2 text-xs text-black/35">{formatPostedLabel(job)}</p>
                                        </Link>
                                    ))}
                                </div>
                            )
                        ) : allLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-14 animate-pulse rounded-xl border border-black/10 bg-white/70" />
                                ))}
                                <p className="pt-1 text-xs text-black/40">Searching…</p>
                            </div>
                        ) : (
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-black/60">
                                        {filteredMatches.length} match{filteredMatches.length === 1 ? "" : "es"} for &ldquo;
                                        {debouncedQuery.trim()}&rdquo;
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        {(["all", "internship", "new-grad"] as const).map((f) => (
                                            <button
                                                key={f}
                                                type="button"
                                                onClick={() => setTypeFilter(f)}
                                                className={`rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 ${
                                                    typeFilter === f
                                                        ? "border-[#f06c1f]/40 bg-[#f06c1f]/10 text-[#c74a05]"
                                                        : "border-black/10 text-black/50 hover:border-black/25"
                                                }`}
                                            >
                                                {f === "all" ? "All" : f === "internship" ? "Internships" : "New grad"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {filteredMatches.length === 0 ? (
                                    <div className="mt-6 rounded-xl border border-black/10 bg-white p-6 text-center">
                                        <p className="text-sm text-black/60">
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
                                    <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-white">
                                        {displayedMatches.map((job) => (
                                            <Link
                                                key={job.id}
                                                to={`/jobs/e/${job.id}`}
                                                className="flex flex-col gap-1 border-b border-black/5 px-4 py-3 last:border-b-0 hover:bg-black/[0.02] sm:flex-row sm:items-center sm:justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f06c1f]/50"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-[#241b12]">{job.title}</p>
                                                    <p className="truncate text-xs text-black/45">
                                                        {job.company_name}
                                                        {job.locations[0] ? ` · ${job.locations[0]}` : ""}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2.5">
                                                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${jobTypeChipClass(job.type)}`}>
                                                        {jobTypeChipLabel(job.type)}
                                                    </span>
                                                    <span className="text-xs text-black/35">{formatPostedLabel(job)}</span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                <Link
                                    to={`/jobs?search=${encodeURIComponent(debouncedQuery.trim())}`}
                                    className="mt-4 inline-block text-sm font-semibold text-[#c74a05] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 rounded"
                                >
                                    See all {filteredMatches.length} on the job board →
                                </Link>

                                {filteredMatches.length > 0 && (
                                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#f06c1f]/30 bg-[#f06c1f]/5 px-4 py-3">
                                        <p className="text-sm text-black/70">
                                            Get a {frequency} email when new &ldquo;{debouncedQuery.trim()}&rdquo; roles drop.
                                        </p>
                                        <Button onClick={() => focusAlertBuilder(searchQuery.trim())} className="!px-4 !py-2 !text-xs shrink-0">
                                            Get alerts for this search
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Alert builder ---------------- */}
            <section ref={alertSectionRef} id="alert-builder" className="bg-[#f6efe0] px-5 py-16">
                <div className="mx-auto max-w-2xl">
                    <div className="text-center">
                        <h2 className="font-display text-3xl font-bold text-[#241b12]">Get alerts</h2>
                        <p className="mt-2 text-black/60">
                            Tell us what you&apos;re after — we&apos;ll email you the moment matching roles drop.
                        </p>
                    </div>

                    <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6 shadow-[0_3px_0_rgba(36,27,18,0.05)] sm:p-8">
                        {subscribed ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f06c1f]/10">
                                    <Check className="h-5 w-5 text-[#c74a05]" aria-hidden="true" />
                                </span>
                                <p className="font-display text-lg font-semibold text-[#241b12]">
                                    You&apos;re set — first digest tomorrow morning
                                </p>
                                <p className="text-sm text-black/50">{scopeSummary(frequency, alertQuery, jobType)}</p>
                                <button
                                    type="button"
                                    onClick={() => setSubscribed(false)}
                                    className="mt-1 text-sm font-medium text-[#c74a05] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 rounded"
                                >
                                    Edit alert
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Frequency</p>
                                        <div className="mt-2 inline-flex rounded-lg bg-black/5 p-1">
                                            {(["daily", "weekly"] as const).map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setFrequency(f)}
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 ${
                                                        frequency === f ? "bg-white text-[#241b12] shadow-sm" : "text-black/50"
                                                    }`}
                                                >
                                                    {f === "daily" ? "Daily" : "Weekly"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Job type</p>
                                        <div className="mt-2 inline-flex rounded-lg bg-black/5 p-1">
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
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 ${
                                                        jobType === opt.value ? "bg-white text-[#241b12] shadow-sm" : "text-black/50"
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-black/40">Keywords</p>
                                    <input
                                        ref={keywordInputRef}
                                        value={alertQuery}
                                        onChange={(e) => setAlertQuery(e.target.value)}
                                        placeholder="react, data, Toronto — optional"
                                        className="mt-2 w-full rounded-xl border border-black/10 bg-[#fdf8ee] px-3.5 py-2.5 text-sm text-[#241b12] placeholder:text-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50"
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
                                            className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-[#241b12] placeholder:text-black/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50"
                                        />
                                        <Button type="submit" className="shrink-0">
                                            {submitting ? "Signing up…" : "Get alerts"}
                                        </Button>
                                    </form>

                                    <span className="hidden text-center text-xs font-medium uppercase tracking-wide text-black/30 sm:block">
                                        or
                                    </span>

                                    <div>
                                        <button
                                            type="button"
                                            onClick={handleGoogleContinue}
                                            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm font-medium text-[#241b12] transition hover:border-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50"
                                        >
                                            <FcGoogle className="h-4 w-4" aria-hidden="true" />
                                            Continue with Google
                                        </button>
                                        <p className="mt-1.5 text-center text-xs text-black/40 sm:text-left">
                                            We&apos;ll create your account and save this alert.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Communities / Events / Spotlight ---------------- */}
            <section className="px-5 py-16">
                <div className="mx-auto max-w-5xl">
                    <h2 className="font-display text-2xl font-bold text-[#241b12]">Beyond the job board</h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-3">
                        {COMMUNITY_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 rounded-lg"
                            >
                                <p className="font-display text-base font-semibold text-[#241b12]">
                                    {item.title}{" "}
                                    <span className="text-black/30 transition group-hover:translate-x-0.5 group-hover:text-[#c74a05] inline-block">
                                        →
                                    </span>
                                </p>
                                <p className="mt-1 text-sm text-black/55">{item.blurb}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ---------------- Why free ---------------- */}
            <section className="border-t border-black/10 px-5 py-14">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="font-display text-xl font-bold text-[#241b12]">Why free?</h2>
                    <p className="mt-3 text-sm leading-relaxed text-black/60">
                        Tail&apos;ed Community is built and run by students, for students — a non-profit with no
                        investors and no paywall between you and a job. The whole project is open source;
                        dig through the code or contribute on{" "}
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[#c74a05] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 rounded"
                        >
                            GitHub
                        </a>
                        .
                    </p>
                </div>
            </section>

            {/* ---------------- Footer ---------------- */}
            <footer className="border-t border-black/10 px-5 py-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
                    <div className="flex items-center gap-2 text-[#241b12]">
                        <FoxMark size={18} />
                        <span className="font-display text-sm font-semibold">Tail&apos;ed Community</span>
                        <span className="text-xs text-black/40">· built by students, for students</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-black/50">
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-[#241b12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 rounded"
                        >
                            GitHub
                        </a>
                        <Link to="/sign-in" className="hover:text-[#241b12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f06c1f]/50 rounded">
                            Sign in
                        </Link>
                    </div>
                </div>
            </footer>

            <LabSwitcher />
        </div>
    );
}
