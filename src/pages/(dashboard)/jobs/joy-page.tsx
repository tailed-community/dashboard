import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Seo } from "@/components/seo";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { useProfileSummary } from "@/hooks/use-profile-summary";
import {
    roundedCountLabel,
    stashAlertPrefsForSignup,
    type AlertPrefs,
} from "@/pages/design-lab/lab-shared";
import {
    useLiveJobs,
    searchJoyJobs,
    matchesJoyTypeFilter,
    computeJoyFeedPulse,
    type JoyJobTypeFilter,
} from "@/components/playground/joy-live-jobs";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { PostingSparkline } from "@/components/playground/joy-primitives";
import { JoyJobRow } from "@/components/playground/joy-job-row";

/**
 * NEW production `/jobs` list (Phase D of the joy design migration). Adapts
 * the look of `src/pages/design-lab/playground-jobs.tsx`, but swaps that
 * page's external-only data source for the SAME merged featured+external
 * dataset `UnifiedJobBoard` (the current live board) produces — see
 * `useLiveJobs` in `src/components/playground/joy-live-jobs.ts`. Not yet
 * wired into a route; Phase G registers this at `/jobs` in App.tsx.
 */

/** How many rows are shown per "page"; Load more bumps the visible window by this much. */
const PAGE_SIZE = 30;

const RESULT_TYPE_FILTERS: { label: string; value: JoyJobTypeFilter }[] = [
    { label: "All", value: "all" },
    { label: "Featured", value: "featured" },
    { label: "Internships", value: "internship" },
    { label: "New grad", value: "new-grad" },
];

/**
 * Slim, dismissible profile-completion nudge shown on the jobs board for
 * signed-in users whose profile isn't finished yet. Additive and ambient —
 * renders nothing while loading, when logged out, or at 100%. Dismissal is
 * session-only local state (no persistence). Reuses the shared
 * `useProfileSummary` hook — no new data fetching.
 */
function JobsProfileNudge() {
    const { user } = useAuth();
    const { loading, score } = useProfileSummary();
    const [dismissed, setDismissed] = useState(false);

    if (dismissed || loading || !user || score >= 100) return null;

    return (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-joy-ink/8 bg-joy-sun/20 px-4 py-2.5 text-joy-ink">
            <p className="min-w-0 flex-1 text-sm font-semibold">
                Complete your profile to apply faster —{" "}
                <span className="font-bold text-joy-grass">{score}% done</span>
            </p>
            <PlaygroundButton to={LIVE_ROUTES.account} className="shrink-0 !px-4 !py-1.5 !text-xs">
                Finish profile
            </PlaygroundButton>
            <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="shrink-0 rounded-full p-1 text-joy-ink/40 transition hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
            >
                <X className="h-4 w-4" aria-hidden="true" />
            </button>
        </div>
    );
}

export default function JoyJobsPage() {
    const navigate = useNavigate();
    const { all, loading } = useLiveJobs();

    const [searchQuery, setSearchQuery] = useState(
        () => new URLSearchParams(window.location.search).get("search") ?? ""
    );
    const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
    const [typeFilter, setTypeFilter] = useState<JoyJobTypeFilter>("all");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {
        trackEvent("jobs_view");
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 250);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const isSearching = debouncedQuery.trim().length > 0;

    const activeCount = all.length;
    const featuredCount = useMemo(() => all.filter((j) => j.featured).length, [all]);
    const companyCount = useMemo(() => new Set(all.map((j) => j.company)).size, [all]);
    const pulse = useMemo(() => computeJoyFeedPulse(all), [all]);

    // Search/filter over the already featured-first, newest-first merged
    // dataset — filtering never re-sorts, so featured jobs stay pinned to the
    // top of the results exactly like UnifiedJobBoard.
    const baseMatches = useMemo(
        () => (isSearching ? searchJoyJobs(all, debouncedQuery) : all),
        [all, debouncedQuery, isSearching]
    );
    const filteredMatches = useMemo(
        () => baseMatches.filter((job) => matchesJoyTypeFilter(job, typeFilter)),
        [baseMatches, typeFilter]
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
            jobType: typeFilter === "internship" || typeFilter === "new-grad" ? typeFilter : null,
        };
        navigate(stashAlertPrefsForSignup(prefs));
    }

    const jobsLabel = roundedCountLabel(loading ? null : activeCount);
    const companiesLabel = roundedCountLabel(loading ? null : companyCount, "hundreds of");

    return (
        // Joy tokens (--joy-*) are only ever defined at :root with no `.dark`
        // override, and nothing in this page/its playground components uses a
        // `dark:` Tailwind variant — so this page is structurally light-only
        // regardless of ancestor theme classes. colorScheme is an explicit
        // belt-and-suspenders signal for native form-control theming.
        <div style={{ colorScheme: "light" }}>
            <Seo
                title="Tech Internships & New-Grad Jobs for Students"
                description="Browse thousands of tech internships and new-grad jobs. Updated daily. Free forever — no account required to search."
                path="/jobs"
            />
            <PlaygroundShell
                routes={LIVE_ROUTES}
                showSwitcher={false}
                activeNav="jobs"
                cta={{ label: "Get alerts", onClick: handleGetAlertsForSearch }}
            >
                {/* ---------------- Page hero ---------------- */}
                <section className="px-5 pb-8 pt-10 md:pt-12">
                    <div className="mx-auto max-w-6xl">
                        <div className="inline-flex items-center rounded-full bg-white px-3.5 py-1 shadow-sm">
                            <span className="text-xs font-bold text-joy-ink-muted">
                                Non-profit · built by students · free forever
                            </span>
                        </div>
                        <h1 className="joy-display mt-4 text-3xl font-extrabold leading-[1.08] tracking-tight text-joy-ink sm:text-4xl">
                            Every live role, <span className="text-joy-grass">one board.</span>
                        </h1>
                        <p className="mt-3 max-w-2xl text-base text-joy-ink-muted">
                            {jobsLabel} internships &amp; new-grad roles from {companiesLabel} companies, updated daily
                            {featuredCount > 0 ? `, including ${featuredCount} featured roles` : ""}. Search, filter,
                            and go — no account required.
                        </p>

                        {pulse && (
                            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                                <span className="flex items-center gap-2">
                                    <span className="joy-pulse-dot h-2 w-2 rounded-full bg-joy-grass-bright" aria-hidden="true" />
                                    <span className="joy-mono text-xs text-joy-ink-muted">
                                        <span className="font-bold text-joy-grass">
                                            {pulse.addedToday.toLocaleString("en-US")}
                                        </span>{" "}
                                        added today · {pulse.addedThisWeek.toLocaleString("en-US")} this week · last drop{" "}
                                        {pulse.lastDropLabel}
                                    </span>
                                </span>
                                <span className="flex items-center gap-2" title="Jobs posted per day, last 7 days">
                                    <PostingSparkline counts={pulse.dayCounts} />
                                    <span className="joy-mono text-[10px] uppercase tracking-wide text-joy-ink/35">
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
                        <div className="rounded-2xl border-2 border-joy-ink/10 bg-white p-4 shadow-sm sm:p-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="relative w-full">
                                    <Search
                                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-joy-ink/30"
                                        aria-hidden="true"
                                    />
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search role, company, location…"
                                        aria-label="Search jobs"
                                        className="w-full rounded-xl border border-joy-ink/10 bg-joy-surface py-3 pl-10 pr-3.5 text-sm text-joy-ink placeholder:text-joy-ink/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                    />
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                    {RESULT_TYPE_FILTERS.map((f) => (
                                        <button
                                            key={f.value}
                                            type="button"
                                            onClick={() => setTypeFilter(f.value)}
                                            className={`rounded-full border px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
                                                typeFilter === f.value
                                                    ? "border-joy-grass/40 bg-joy-grass/10 text-joy-grass"
                                                    : "border-joy-ink/10 text-joy-ink-muted hover:border-joy-ink/25"
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <JobsProfileNudge />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-joy-ink-muted">
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
                                <PlaygroundButton
                                    onClick={handleGetAlertsForSearch}
                                    variant="outline"
                                    className="!px-4 !py-2 !text-xs"
                                >
                                    Get alerts for this search
                                </PlaygroundButton>
                            )}
                        </div>

                        <div key={`${typeFilter}:${debouncedQuery}`} className="joy-swap mt-4">
                            {loading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-14 animate-pulse rounded-xl border border-joy-ink/8 bg-white" />
                                    ))}
                                </div>
                            ) : filteredMatches.length === 0 ? (
                                <div className="rounded-2xl border border-joy-ink/8 bg-white p-8 text-center shadow-sm">
                                    <p className="text-sm text-joy-ink-muted">
                                        No live roles match that yet — be first to know when one appears.
                                    </p>
                                    <PlaygroundButton onClick={handleGetAlertsForSearch} variant="outline" className="mt-4">
                                        Get alerts for this search
                                    </PlaygroundButton>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-2xl border border-joy-ink/8 bg-white shadow-sm">
                                    <div className="hidden grid-cols-[2.3fr_1.3fr_6.5rem_7.5rem] gap-3 border-b border-joy-ink/8 bg-joy-surface-sunk px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-joy-ink-muted sm:grid">
                                        <span>Role · Company</span>
                                        <span>Location</span>
                                        <span>Type</span>
                                        <span className="text-right">Posted</span>
                                    </div>
                                    <ul>
                                        {displayedMatches.map((job, i) => (
                                            <JoyJobRow key={job.id} job={job} first={i === 0} />
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {!loading && hasMore && (
                            <div className="mt-6 flex flex-col items-center gap-2">
                                <PlaygroundButton variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                                    Load more roles
                                </PlaygroundButton>
                                <p className="joy-mono text-xs text-joy-ink/35">
                                    Showing {displayedMatches.length.toLocaleString("en-US")} of{" "}
                                    {filteredMatches.length.toLocaleString("en-US")}
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </PlaygroundShell>
        </div>
    );
}
