import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check, Github, Mail, Search, Star, X } from "lucide-react";
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
import { formatPostedLabel } from "@/lib/external-jobs";
import { apiFetch } from "@/lib/fetch";
import type { ExternalJob } from "@/types/jobs";

/** Flat fill colors cycled across monogram squares / card accents. */
const ACCENTS = ["#e8590c", "#ffd43b", "#74c0fc"];

/** Derives 1-2 letter initials from a company name for the monogram square. */
function monogram(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

const HERO_BADGES: { text: string; rotate: string; bg: string }[] = [
    { text: "NON-PROFIT ★", rotate: "-rotate-3", bg: "#ffd43b" },
    { text: "BUILT BY STUDENTS", rotate: "rotate-2", bg: "#74c0fc" },
    { text: "FREE FOREVER", rotate: "-rotate-2", bg: "#e8590c" },
    { text: "$0.00", rotate: "rotate-3", bg: "#faf5eb" },
];

const CARD_ROTATIONS = ["rotate-0", "rotate-[-1deg]", "rotate-0", "rotate-[1deg]", "rotate-0", "rotate-[-1deg]", "rotate-0", "rotate-[1deg]", "rotate-0"];

const JOB_TYPE_OPTIONS: { label: string; value: AlertPrefs["jobType"] }[] = [
    { label: "Internships", value: "internship" },
    { label: "New grad", value: "new-grad" },
    { label: "Both", value: null },
];

const RESULT_TYPE_FILTERS: { label: string; value: "all" | "internship" | "new-grad" }[] = [
    { label: "All", value: "all" },
    { label: "Internships", value: "internship" },
    { label: "New grad", value: "new-grad" },
];

/** Small stamped toggle button shared by the alert builder chips and the results-view type filter. */
function StampChip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`border-2 border-black px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2 ${
                active
                    ? "bg-black text-white shadow-[3px_3px_0_#e8590c]"
                    : "bg-white shadow-[3px_3px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#000]"
            }`}
        >
            {children}
        </button>
    );
}

function JobCard({ job, index }: { job: ExternalJob; index: number }) {
    const accent = ACCENTS[index % ACCENTS.length];
    const rotate = CARD_ROTATIONS[index % CARD_ROTATIONS.length];
    const location = job.locations[0] ?? "Remote / Unlisted";
    return (
        <Link
            to={`/jobs/e/${job.id}`}
            className={`group relative block border-2 border-black bg-white p-4 shadow-[6px_6px_0_#000] transition-all hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2 ${rotate}`}
        >
            <div className="flex items-start gap-3">
                <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-black text-sm font-black"
                    style={{ backgroundColor: accent, fontFamily: "'Archivo Black', sans-serif" }}
                >
                    {monogram(job.company_name)}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold uppercase tracking-wide text-black/60">
                        {job.company_name}
                    </p>
                    <h3 className="line-clamp-2 text-base font-extrabold leading-tight">
                        {job.title}
                    </h3>
                </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t-2 border-dashed border-black/20 pt-2 font-mono text-[11px] uppercase text-black/70">
                <span className="border border-black bg-[#faf5eb] px-1.5 py-0.5 font-bold">
                    [{job.type === "internship" ? "INTERNSHIP" : "NEW GRAD"}]
                </span>
                <span className="truncate">{location}</span>
                <span className="ml-auto whitespace-nowrap">{formatPostedLabel(job)}</span>
            </div>
        </Link>
    );
}

/** One row in the search-results list. */
function ResultRow({ job, first }: { job: ExternalJob; first: boolean }) {
    return (
        <li className={first ? "" : "border-t-2 border-dashed border-black/15"}>
            <Link
                to={`/jobs/e/${job.id}`}
                className="grid grid-cols-1 gap-1 px-3 py-3 font-mono text-sm transition-colors hover:bg-[#ffd43b]/25 focus-visible:outline focus-visible:outline-4 focus-visible:-outline-offset-2 focus-visible:outline-black sm:grid-cols-[1.4fr_2fr_1.2fr_6.5rem_7.5rem] sm:items-center sm:gap-3"
            >
                <span className="truncate font-bold">{job.company_name}</span>
                <span className="truncate">{job.title}</span>
                <span className="truncate text-black/60">{job.locations[0] ?? "Remote / Unlisted"}</span>
                <span className="w-fit border border-black bg-[#faf5eb] px-1.5 py-0.5 text-[10px] font-bold uppercase">
                    {job.type === "internship" ? "Intern" : "New grad"}
                </span>
                <span className="whitespace-nowrap text-xs text-black/50 sm:text-right">
                    {formatPostedLabel(job)}
                </span>
            </Link>
        </li>
    );
}

export default function ZinePage() {
    const navigate = useNavigate();
    const { jobs, activeCount, companyCount, loading } = useLabJobs(9, 2);
    const { all, loading: allLoading } = useAllJobs();

    // Hero search: rawQuery is what the input shows (instant), debouncedQuery
    // is what actually drives the fresh-grid <-> results-table swap so we
    // don't re-filter 11k jobs on every keystroke.
    const [rawQuery, setRawQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [resultTypeFilter, setResultTypeFilter] = useState<"all" | "internship" | "new-grad">("all");

    // Alert builder state.
    const [frequency, setFrequency] = useState<AlertPrefs["frequency"]>("daily");
    const [keywordQuery, setKeywordQuery] = useState("");
    const [jobType, setJobType] = useState<AlertPrefs["jobType"]>(null);
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [subscribed, setSubscribed] = useState(false);

    const alertBuilderRef = useRef<HTMLDivElement>(null);
    const keywordInputRef = useRef<HTMLInputElement>(null);
    const freshSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedQuery(rawQuery), 250);
        return () => clearTimeout(handle);
    }, [rawQuery]);

    const trimmedQuery = debouncedQuery.trim();
    const searchActive = trimmedQuery.length > 0;

    // Reset the type filter whenever the search term itself changes so a
    // stale "Internships only" filter doesn't silently hide a fresh search.
    useEffect(() => {
        setResultTypeFilter("all");
    }, [trimmedQuery]);

    const searchMatches = useMemo(() => {
        if (!searchActive) return [];
        return [...searchJobs(all, trimmedQuery)].sort((a, b) => b.date_posted - a.date_posted);
    }, [all, trimmedQuery, searchActive]);

    const filteredMatches = useMemo(
        () =>
            resultTypeFilter === "all"
                ? searchMatches
                : searchMatches.filter((j) => j.type === resultTypeFilter),
        [searchMatches, resultTypeFilter],
    );

    const shownMatches = filteredMatches.slice(0, 25);

    /** Scrolls to + focuses the alert builder; optionally pre-fills its keyword field (e.g. from a search). */
    function scrollToBuilder(prefillQuery?: string) {
        if (prefillQuery !== undefined) {
            setKeywordQuery(prefillQuery);
            setSubscribed(false);
        }
        requestAnimationFrame(() => {
            alertBuilderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            keywordInputRef.current?.focus({ preventScroll: true });
        });
    }

    function handleSearch(e: FormEvent) {
        e.preventDefault();
        // Results already update live as the visitor types; Enter just flushes
        // the debounce immediately and, on mobile, scrolls the results into view.
        setDebouncedQuery(rawQuery);
        if (rawQuery.trim()) {
            requestAnimationFrame(() => {
                freshSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    }

    function clearSearch() {
        setRawQuery("");
        setDebouncedQuery("");
    }

    async function handleEmailSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail || submitting) return;

        setSubmitting(true);
        try {
            await apiFetch("/alerts/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: trimmedEmail,
                    source: "landing_strip",
                    ...(keywordQuery.trim() ? { query: keywordQuery.trim() } : {}),
                    ...(jobType ? { jobType } : {}),
                }),
            });
            // PROTOTYPE: this design-lab page has no backend wired up, so we show
            // the success state unconditionally. Production must gate this on
            // `response.ok` (and surface a toast.error otherwise) the same way
            // src/components/capture/job-alert-signup.tsx does.
        } catch {
            // Same prototype note applies to network failures.
        } finally {
            setSubmitting(false);
            setSubscribed(true);
        }
    }

    function handleGoogleContinue() {
        navigate(
            stashAlertPrefsForSignup({
                frequency,
                query: keywordQuery.trim(),
                jobType,
            }),
        );
    }

    const jobTypeLabel =
        jobType === "internship" ? "INTERNSHIPS" : jobType === "new-grad" ? "NEW GRAD" : "BOTH TYPES";

    const marqueeItems =
        jobs.length > 0
            ? jobs.map((j) => `${j.title.toUpperCase()} @ ${j.company_name.toUpperCase()}`)
            : [
                  "THOUSANDS OF INTERNSHIPS",
                  "NEW GRAD ROLES DAILY",
                  "NO RECRUITER SPAM",
                  "ZERO PREMIUM TIER",
                  "BUILT BY STUDENTS",
              ];

    // Fresh-grid section shows in the non-search state only when we have data
    // (or are still loading it) so a feed failure hides it rather than
    // showing an empty grid; in the search state it always shows (results or
    // an honest empty state).
    const showFreshOrResults = searchActive || loading || jobs.length > 0;

    return (
        <div
            className="min-h-screen overflow-x-hidden bg-[#faf5eb] text-black"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;500;600;700&display=swap');

                .zine-display { font-family: 'Archivo Black', sans-serif; }

                @keyframes zine-marquee {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                }
                .zine-marquee-track {
                    animation: zine-marquee 22s linear infinite;
                }

                @keyframes zine-swap-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .zine-swap {
                    animation: zine-swap-in 0.28s ease-out;
                }

                @media (prefers-reduced-motion: reduce) {
                    .zine-marquee-track { animation: none; }
                    .zine-swap { animation: none; }
                }
            `}</style>

            {/* Header */}
            <header className="sticky top-0 z-40 border-b-2 border-black bg-[#faf5eb]">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <Link
                        to="/"
                        className="zine-display text-xl focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2 sm:text-2xl"
                    >
                        TAIL&apos;ED
                    </Link>
                    <nav className="hidden items-center gap-6 text-sm font-bold uppercase tracking-wide md:flex">
                        <Link to="/jobs" className="hover:underline focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2">
                            Jobs
                        </Link>
                        <Link to="/events" className="hover:underline focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2">
                            Events
                        </Link>
                        <Link to="/communities" className="hover:underline focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2">
                            Communities
                        </Link>
                        <Link to="/spotlight" className="hover:underline focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2">
                            Spotlight
                        </Link>
                    </nav>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link
                            to="/sign-in"
                            className="hidden text-sm font-bold uppercase tracking-wide hover:underline focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2 sm:inline"
                        >
                            Sign in
                        </Link>
                        <button
                            type="button"
                            onClick={() => scrollToBuilder()}
                            className="border-2 border-black bg-[#e8590c] px-3 py-1.5 text-sm font-black uppercase tracking-wide text-white shadow-[4px_4px_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                        >
                            Get alerts
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 sm:pt-16">
                <div className="mb-8 flex flex-wrap gap-3">
                    {HERO_BADGES.map((b) => (
                        <span
                            key={b.text}
                            className={`border-2 border-black px-3 py-1 text-xs font-black uppercase tracking-wide shadow-[4px_4px_0_#000] ${b.rotate}`}
                            style={{ backgroundColor: b.bg }}
                        >
                            {b.text}
                        </span>
                    ))}
                </div>

                <h1 className="zine-display text-5xl leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
                    {roundedCountLabel(activeCount)} JOBS.
                    <br />
                    <span className="text-[#e8590c]">NO SUITS.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-lg font-medium leading-snug sm:text-xl">
                    No recruiters. No premium tier. No selling your resume.
                    Tail&apos;ed is a non-profit run by students who were also
                    sick of job boards.
                </p>

                <form
                    onSubmit={handleSearch}
                    className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row"
                >
                    <div className="flex flex-1 items-center border-2 border-black bg-white shadow-[6px_6px_0_#000]">
                        <input
                            type="text"
                            value={rawQuery}
                            onChange={(e) => setRawQuery(e.target.value)}
                            placeholder="SWE intern, Toronto, Shopify..."
                            className="w-full bg-transparent px-4 py-3 font-mono text-sm font-medium placeholder:text-black/40 focus:outline-none sm:text-base"
                            aria-label="Search jobs"
                        />
                        {rawQuery.length > 0 && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                aria-label="Clear search"
                                className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black bg-[#faf5eb] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                            >
                                <X className="h-3.5 w-3.5" strokeWidth={3} />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="flex items-center justify-center gap-2 border-2 border-black bg-black px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-[6px_6px_0_#e8590c] transition-all hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#e8590c] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                    >
                        <Search className="h-4 w-4" strokeWidth={3} />
                        SEARCH
                        <ArrowRight className="h-4 w-4" strokeWidth={3} />
                    </button>
                </form>

                <div className="mt-6">
                    <button
                        type="button"
                        onClick={() => scrollToBuilder()}
                        className="inline-flex items-center gap-2 border-2 border-black bg-[#ffd43b] px-8 py-4 text-lg font-black uppercase tracking-wide shadow-[8px_8px_0_#000] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[4px_4px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                    >
                        Get alerts <ArrowRight className="h-5 w-5" strokeWidth={3} />
                    </button>
                </div>
            </section>

            {/* Marquee */}
            <div className="overflow-hidden border-y-2 border-black bg-black py-3">
                <div className="flex w-max flex-nowrap zine-marquee-track">
                    {[0, 1].map((rep) => (
                        <div key={rep} className="flex flex-nowrap items-center">
                            {marqueeItems.map((item, i) => (
                                <span
                                    key={`${rep}-${i}`}
                                    className="zine-display mx-4 whitespace-nowrap text-sm text-[#ffd43b] sm:text-base"
                                >
                                    {item}
                                    <span className="ml-4 text-[#e8590c]">★</span>
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Fresh off the feed <-> search results */}
            {showFreshOrResults && (
                <section ref={freshSectionRef} className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
                    {searchActive ? (
                        <div key="results" className="zine-swap">
                            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                                <h2 className="zine-display text-2xl leading-tight sm:text-4xl">
                                    {allLoading
                                        ? "SEARCHING…"
                                        : `${filteredMatches.length.toLocaleString("en-US")} MATCH${
                                              filteredMatches.length === 1 ? "" : "ES"
                                          } FOR "${trimmedQuery.toUpperCase()}"`}
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {RESULT_TYPE_FILTERS.map((f) => (
                                        <StampChip
                                            key={f.value}
                                            active={resultTypeFilter === f.value}
                                            onClick={() => setResultTypeFilter(f.value)}
                                        >
                                            {f.label}
                                        </StampChip>
                                    ))}
                                </div>
                            </div>

                            {allLoading ? (
                                <div className="space-y-2 border-2 border-black bg-white p-2 shadow-[6px_6px_0_#000]">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-10 animate-pulse bg-black/10" />
                                    ))}
                                </div>
                            ) : filteredMatches.length === 0 ? (
                                <div className="border-2 border-black bg-white p-8 text-center shadow-[6px_6px_0_#000]">
                                    <p className="zine-display text-2xl sm:text-3xl">NOTHING YET.</p>
                                    <p className="mt-2 font-medium text-black/70">
                                        No matches for &quot;{trimmedQuery}&quot; right now — but the feed updates constantly.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => scrollToBuilder(trimmedQuery)}
                                        className="mt-5 inline-flex items-center gap-2 border-2 border-black bg-[#ffd43b] px-5 py-2.5 text-sm font-black uppercase tracking-wide shadow-[4px_4px_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                                    >
                                        Be first when one drops <ArrowRight className="h-4 w-4" strokeWidth={3} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto border-2 border-black bg-white shadow-[6px_6px_0_#000]">
                                        <div className="hidden grid-cols-[1.4fr_2fr_1.2fr_6.5rem_7.5rem] gap-3 border-b-2 border-black bg-[#faf5eb] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wide text-black/60 sm:grid">
                                            <span>Company</span>
                                            <span>Role</span>
                                            <span>Location</span>
                                            <span>Type</span>
                                            <span className="text-right">Posted</span>
                                        </div>
                                        <ul>
                                            {shownMatches.map((job, i) => (
                                                <ResultRow key={job.id} job={job} first={i === 0} />
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                                        <Link
                                            to={`/jobs?search=${encodeURIComponent(trimmedQuery)}`}
                                            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide underline underline-offset-4 hover:text-[#e8590c] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                                        >
                                            See all {searchMatches.length.toLocaleString("en-US")} on the board
                                            <ArrowRight className="h-4 w-4" strokeWidth={3} />
                                        </Link>
                                    </div>

                                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-[#e8590c] px-4 py-3 text-white shadow-[4px_4px_0_#000]">
                                        <p className="text-sm font-black uppercase tracking-wide">
                                            Want these in your inbox?
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => scrollToBuilder(trimmedQuery)}
                                            className="inline-flex items-center gap-2 border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-black shadow-[3px_3px_0_#000] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white focus-visible:outline-offset-2"
                                        >
                                            Get alerts for &quot;{trimmedQuery}&quot; <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div key="fresh" className="zine-swap">
                            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                                <h2 className="zine-display text-3xl sm:text-4xl">
                                    FRESH OFF THE FEED
                                </h2>
                                <p className="font-mono text-sm font-bold uppercase text-black/60">
                                    {roundedCountLabel(activeCount)} open ·{" "}
                                    {companyCount === null ? "many" : companyCount.toLocaleString("en-US")}{" "}
                                    companies
                                </p>
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                {loading &&
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-32 animate-pulse border-2 border-black bg-black/10"
                                        />
                                    ))}
                                {!loading &&
                                    jobs.map((job, i) => (
                                        <JobCard key={job.id} job={job} index={i} />
                                    ))}
                            </div>

                            <div className="mt-8">
                                <Link
                                    to="/jobs"
                                    className="inline-flex items-center gap-2 border-2 border-black bg-white px-5 py-2.5 text-sm font-black uppercase tracking-wide shadow-[4px_4px_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                                >
                                    See all jobs
                                    <ArrowRight className="h-4 w-4" strokeWidth={3} />
                                </Link>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* Alert builder — centerpiece */}
            <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
                <div className="mb-8 max-w-xl">
                    <h2 className="zine-display text-3xl sm:text-4xl">GET ALERTS, NOT SPAM</h2>
                    <p className="mt-2 font-medium text-black/70">
                        Tell us what you&apos;re hunting for. We&apos;ll email you when it drops
                        — nothing else, ever.
                    </p>
                </div>

                <div
                    ref={alertBuilderRef}
                    className="relative mx-auto max-w-2xl border-2 border-black bg-white p-6 shadow-[10px_10px_0_#000] sm:p-8"
                >
                    <span className="absolute -right-3 -top-5 rotate-[8deg] border-2 border-black bg-[#ffd43b] px-3 py-1 text-xs font-black uppercase tracking-wide shadow-[4px_4px_0_#000] sm:-right-6">
                        Free intel
                    </span>
                    <span className="absolute -left-3 -bottom-4 -rotate-3 border-2 border-black bg-[#74c0fc] px-3 py-1 text-xs font-black uppercase tracking-wide shadow-[4px_4px_0_#000] sm:-left-6">
                        $0 spam
                    </span>

                    {subscribed ? (
                        <div className="py-6 text-center">
                            <p className="zine-display inline-flex -rotate-2 items-center gap-2 border-4 border-black bg-[#ffd43b] px-6 py-3 text-3xl shadow-[6px_6px_0_#000] sm:text-4xl">
                                <Check className="h-7 w-7" strokeWidth={4} />
                                YOU&apos;RE IN.
                            </p>
                            <p className="mt-5 font-mono text-sm font-bold uppercase tracking-wide text-black/70">
                                {frequency.toUpperCase()} ·{" "}
                                {keywordQuery.trim() ? keywordQuery.trim().toUpperCase() : "ALL JOBS"} ·{" "}
                                {jobTypeLabel}
                            </p>
                            <button
                                type="button"
                                onClick={() => setSubscribed(false)}
                                className="mt-4 text-sm font-bold uppercase tracking-wide underline underline-offset-4 hover:text-[#e8590c] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                            >
                                Edit
                            </button>
                        </div>
                    ) : (
                        <>
                            <p className="mb-2 text-xs font-black uppercase tracking-wide text-black/60">
                                How often?
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {(["daily", "weekly"] as const).map((f) => (
                                    <StampChip key={f} active={frequency === f} onClick={() => setFrequency(f)}>
                                        {f}
                                    </StampChip>
                                ))}
                            </div>

                            <label className="mt-5 block">
                                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-black/60">
                                    Keywords (optional)
                                </span>
                                <input
                                    ref={keywordInputRef}
                                    type="text"
                                    value={keywordQuery}
                                    onChange={(e) => setKeywordQuery(e.target.value)}
                                    placeholder="react, data, toronto…"
                                    className="w-full border-2 border-black bg-[#faf5eb] px-3 py-2 font-mono text-sm focus:outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                                />
                            </label>

                            <p className="mb-2 mt-5 text-xs font-black uppercase tracking-wide text-black/60">
                                Job type
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {JOB_TYPE_OPTIONS.map((opt) => (
                                    <StampChip
                                        key={opt.label}
                                        active={jobType === opt.value}
                                        onClick={() => setJobType(opt.value)}
                                    >
                                        {opt.label}
                                    </StampChip>
                                ))}
                            </div>

                            <form onSubmit={handleEmailSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row">
                                <div className="relative flex-1">
                                    <Mail
                                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40"
                                        aria-hidden="true"
                                    />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@school.edu"
                                        className="w-full border-2 border-black bg-white py-2.5 pl-9 pr-3 font-mono text-sm focus:outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex items-center justify-center gap-2 border-2 border-black bg-black px-5 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-[4px_4px_0_#e8590c] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#e8590c] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2 disabled:opacity-60"
                                >
                                    {submitting ? "Sending…" : (
                                        <>
                                            Get alerts <ArrowRight className="h-4 w-4" strokeWidth={3} />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-black/40">
                                <span className="h-px flex-1 bg-black/20" />
                                or
                                <span className="h-px flex-1 bg-black/20" />
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleContinue}
                                className="flex w-full items-center justify-center gap-2 border-2 border-black bg-white px-5 py-2.5 text-sm font-black uppercase tracking-wide shadow-[4px_4px_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                            >
                                <FcGoogle className="h-5 w-5" />
                                Continue with Google
                            </button>
                            <p className="mt-2 text-center text-xs font-medium text-black/50">
                                Creates your account + saves this alert
                            </p>
                        </>
                    )}
                </div>
            </section>

            {/* Why is this free */}
            <section className="border-y-2 border-black bg-black px-4 py-14 text-white sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <h2 className="zine-display text-3xl text-[#ffd43b] sm:text-4xl">
                        WHY IS THIS FREE?
                    </h2>
                    <p className="mt-5 text-lg leading-relaxed sm:text-xl">
                        Tail&apos;ed is a{" "}
                        <span className="relative inline-block font-bold">
                            non-profit
                            <svg
                                viewBox="0 0 100 12"
                                preserveAspectRatio="none"
                                className="absolute -bottom-1 left-0 h-3 w-full text-[#e8590c]"
                                aria-hidden="true"
                            >
                                <path
                                    d="M0,8 Q10,2 20,8 T40,8 T60,8 T80,8 T100,8"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </span>{" "}
                        built by students, for students. We don&apos;t sell your
                        data and there is no premium tier hiding the good jobs.
                        Every line of code is public.
                    </p>
                    <a
                        href="https://github.com/tailed-community"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-6 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-white underline decoration-2 underline-offset-4 hover:text-[#74c0fc] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white focus-visible:outline-offset-2"
                    >
                        we build in the open
                        <ArrowUpRight className="h-4 w-4" strokeWidth={3} />
                    </a>
                </div>
            </section>

            {/* Events / Communities / Spotlight tiles */}
            <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
                <div className="grid gap-5 sm:grid-cols-3">
                    <Link
                        to="/events"
                        className="group flex flex-col justify-between border-2 border-black bg-[#e8590c] p-6 text-white shadow-[6px_6px_0_#000] transition-all hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                    >
                        <div>
                            <h3 className="zine-display text-2xl">EVENTS</h3>
                            <p className="mt-2 font-medium">
                                Career fairs, workshops, hackathons — find what&apos;s next.
                            </p>
                        </div>
                        <ArrowRight className="mt-6 h-6 w-6 transition-transform group-hover:translate-x-1" strokeWidth={3} />
                    </Link>
                    <Link
                        to="/communities"
                        className="group flex flex-col justify-between border-2 border-black bg-[#ffd43b] p-6 shadow-[6px_6px_0_#000] transition-all hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                    >
                        <div>
                            <h3 className="zine-display text-2xl">COMMUNITIES</h3>
                            <p className="mt-2 font-medium">
                                Student-run clubs and orgs building careers together.
                            </p>
                        </div>
                        <ArrowRight className="mt-6 h-6 w-6 transition-transform group-hover:translate-x-1" strokeWidth={3} />
                    </Link>
                    <Link
                        to="/spotlight"
                        className="group flex flex-col justify-between border-2 border-black bg-[#74c0fc] p-6 shadow-[6px_6px_0_#000] transition-all hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                    >
                        <div>
                            <h3 className="zine-display text-2xl">SPOTLIGHT</h3>
                            <p className="mt-2 font-medium">
                                Real stories from students who landed the role.
                            </p>
                        </div>
                        <ArrowRight className="mt-6 h-6 w-6 transition-transform group-hover:translate-x-1" strokeWidth={3} />
                    </Link>
                </div>
            </section>

            {/* Final CTA */}
            <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
                <div className="border-2 border-black bg-white p-8 text-center shadow-[10px_10px_0_#000] sm:p-14">
                    <h2 className="zine-display text-4xl leading-[0.95] sm:text-6xl">
                        STOP SCROLLING.
                        <br />
                        <span className="text-[#e8590c]">START APPLYING.</span>
                    </h2>
                    <div className="mt-8">
                        <button
                            type="button"
                            onClick={() => scrollToBuilder()}
                            className="inline-flex items-center gap-2 border-2 border-black bg-[#ffd43b] px-8 py-4 text-lg font-black uppercase tracking-wide shadow-[8px_8px_0_#000] transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[4px_4px_0_#000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-black focus-visible:outline-offset-2"
                        >
                            <Star className="h-5 w-5" strokeWidth={3} />
                            Get alerts
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t-2 border-black bg-black px-4 py-8 text-white sm:px-6">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 font-mono text-xs uppercase tracking-wide sm:flex-row">
                    <p>&copy; Tail&apos;ed &mdash; non-profit, built by students.</p>
                    <nav className="flex flex-wrap items-center justify-center gap-4">
                        <Link to="/about" className="hover:text-[#ffd43b] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white focus-visible:outline-offset-2">
                            About
                        </Link>
                        <Link to="/jobs" className="hover:text-[#ffd43b] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white focus-visible:outline-offset-2">
                            Jobs
                        </Link>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-[#ffd43b] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white focus-visible:outline-offset-2"
                        >
                            <SiDiscord className="h-3.5 w-3.5" />
                            Discord
                        </a>
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-[#ffd43b] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white focus-visible:outline-offset-2"
                        >
                            <Github className="h-3.5 w-3.5" />
                            GitHub
                        </a>
                    </nav>
                </div>
            </footer>

            <LabSwitcher />
        </div>
    );
}
