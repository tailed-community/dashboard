import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PreloadLink } from "@/components/preload-link";
import { ArrowRight, Github, Search } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { FcGoogle } from "react-icons/fc";
import { toast } from "sonner";
import {
    useLabJobs,
    useAllJobs,
    searchJobs,
    stashAlertPrefsForSignup,
    roundedCountLabel,
    type AlertPrefs,
} from "@/pages/design-lab/lab-shared";
import { formatPostedLabel, toMillis } from "@/lib/external-jobs";
import { apiFetch } from "@/lib/fetch";
import type { ExternalJob } from "@/types/jobs";
import { Seo } from "@/components/seo";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { useProfileSummary } from "@/hooks/use-profile-summary";
import { DigestPrompt } from "@/components/capture/digest-prompt";
import { isJobAlertSubscribed } from "@/components/capture/job-alert-signup";
import { setStorageFlag } from "@/lib/storage-flags";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES, type PlaygroundRoutes } from "@/components/playground/playground-routes";
import {
    FRESH_ACCENTS,
    JobResultRow,
    computeFeedPulse,
    jobTypeChipClass,
    jobTypeChipLabel,
    PostingSparkline,
} from "@/components/playground/joy-primitives";

/**
 * Live route map for this page. Based on LIVE_ROUTES (Phase B), but with
 * `jobDetail` corrected: LIVE_ROUTES.jobDetail assumes the internal-DB
 * `/jobs/:slug` route, but every job rendered on this page comes from the
 * external feed (`ExternalJob`), which is served at `/jobs/e/:id`
 * (`ExternalJobPage` in App.tsx). See the callout in playground-routes.tsx —
 * this is that "double check before shipping" moment for this page's links.
 */
const HOME_ROUTES: PlaygroundRoutes = {
    ...LIVE_ROUTES,
    jobDetail: (id) => `/jobs/e/${id}`,
};

/**
 * Slim, warm one-line profile nudge for signed-in visitors whose profile
 * isn't complete. Renders nothing for logged-out visitors (so the public
 * home is byte-for-byte unchanged), while loading, or at 100% — keeping the
 * hero untouched. Reuses the shared `useProfileSummary` hook (no new fetch).
 */
function HomeProfileNudge() {
    const { user } = useAuth();
    const { loading, score } = useProfileSummary();

    if (loading || !user || score >= 100) return null;

    return (
        <Link
            to={HOME_ROUTES.me}
            className="mb-6 flex items-center gap-2 rounded-xl border border-joy-ink/8 bg-joy-grass/10 px-4 py-2 text-sm font-semibold text-joy-ink transition hover:bg-joy-grass/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
        >
            Welcome back — your profile is{" "}
            <span className="font-bold text-joy-grass">{score}% complete</span>
            <ArrowRight className="h-4 w-4 text-joy-grass" aria-hidden="true" />
        </Link>
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

/** "Daily · react intern · Internships" style summary of a configured alert. */
function scopeSummary(frequency: "daily" | "weekly", query: string, jobType: "internship" | "new-grad" | null): string {
    const freqLabel = frequency === "daily" ? "Daily" : "Weekly";
    const typeLabel =
        jobType === "internship" ? "Internships" : jobType === "new-grad" ? "New grad" : "Internships & new grad";
    const queryLabel = query.trim() || "All roles";
    return `${freqLabel} · ${queryLabel} · ${typeLabel}`;
}

const COMMUNITY_LINKS = [
    { to: HOME_ROUTES.communities, title: "Communities", blurb: "Student groups building in your field." },
    { to: HOME_ROUTES.events, title: "Events", blurb: "Workshops, meetups, and career events near you." },
    { to: HOME_ROUTES.spotlight, title: "Spotlight", blurb: "Real stories from students who landed the role." },
];

const RESULT_TYPE_FILTERS: { label: string; value: "all" | "internship" | "new-grad" }[] = [
    { label: "All", value: "all" },
    { label: "Internships", value: "internship" },
    { label: "New grad", value: "new-grad" },
];

/**
 * Live "/" landing page — production wiring around the joy-design landing
 * body prototyped at src/pages/design-lab/playground.tsx (Phase A/B). Same
 * layout and real data hooks (useLabJobs/useAllJobs hit the real external
 * feed), plus the production concerns the prototype didn't need: SEO,
 * analytics, and the shared capture surfaces (digest prompt) reconciled
 * against the in-page alert builder so only one email-capture surface is
 * ever on screen at a time.
 */
export default function HomePage() {
    const navigate = useNavigate();
    const { jobs: freshJobs, activeCount, companyCount, loading: freshLoading } = useLabJobs(6, 2);
    const { all, loading: allLoading } = useAllJobs();

    useEffect(() => {
        trackEvent("landing_view");
    }, []);

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
    const [subscribed, setSubscribed] = useState(() => isJobAlertSubscribed());

    // A signed-in visitor has already given us an address (and the API takes it
    // from their ID token regardless of what we send), so the builder drops the
    // email field and the Google path entirely — one button, nothing to re-enter.
    // While auth resolves, trust the prior-session hint so the signed-in layout
    // doesn't flash the logged-out one.
    const { user, loading: authLoading, likelySignedIn } = useAuth();
    const signedIn = authLoading ? likelySignedIn : !!user;

    const alertSectionRef = useRef<HTMLElement>(null);
    const keywordInputRef = useRef<HTMLInputElement>(null);

    // The alert builder is this page's primary email-capture surface. The
    // floating DigestPrompt (bottom-right) must suppress itself whenever the
    // builder is in view, mirroring how the live landing suppresses it
    // against the final-CTA panel — never two capture surfaces on screen.
    const [alertBuilderVisible, setAlertBuilderVisible] = useState(false);
    useEffect(() => {
        const node = alertSectionRef.current;
        if (!node || typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(([entry]) => setAlertBuilderVisible(entry.isIntersecting), {
            threshold: 0,
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

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
        // Signed-in submissions carry no email — the API uses the token's.
        if ((!signedIn && !trimmed) || submitting) return;
        // Showing the signed-in layout off a stale hint: hold the submit until
        // auth lands, so we never post an email-less body for a logged-out visitor.
        if (signedIn && authLoading) return;
        setSubmitting(true);
        try {
            const response = await apiFetch("/alerts/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...(signedIn ? {} : { email: trimmed }),
                    source: "landing_strip",
                    frequency,
                    ...(alertQuery.trim() ? { query: alertQuery.trim() } : {}),
                    ...(jobType ? { jobType } : {}),
                }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body?.error || "Subscription failed");
            }
            // Mirrors JobAlertSignup's own storage key so the floating
            // DigestPrompt (which checks isJobAlertSubscribed()) correctly
            // stays hidden for visitors who subscribed via this builder.
            setStorageFlag("local", "jobAlertSubscribed");
            setSubscribed(true);
            trackEvent("job_alert_subscribed", { source: "landing_strip" });
        } catch (error) {
            console.error("Alert subscribe request failed:", error);
            toast.error("Couldn't sign you up — please try again");
        } finally {
            setSubmitting(false);
        }
    }

    function handleGoogleContinue() {
        const prefs: AlertPrefs = { frequency, query: alertQuery.trim(), jobType };
        trackEvent("auth_started", { source: "landing_alert_builder" });
        navigate(stashAlertPrefsForSignup(prefs));
    }

    const jobsLabel = roundedCountLabel(activeCount);
    const companiesLabel = roundedCountLabel(companyCount, "hundreds of");

    return (
        <PlaygroundShell
            routes={HOME_ROUTES}
            showSwitcher={false}
            activeNav={null}
            cta={{ label: "Get alerts", onClick: () => focusAlertBuilder() }}
        >
            <Seo
                noSuffix
                title="Tail'ed Community — Tech internships and new-grad jobs for students, free forever"
                description="A non-profit student platform with thousands of tech internships and new-grad jobs, hackathons, events, and student communities. Free forever."
                path="/"
            />

            {/* Floating digest prompt — the secondary capture surface, suppressed
                while the in-page alert builder is in view. */}
            <DigestPrompt suppressed={alertBuilderVisible} />

            {/* ---------------- Hero ---------------- */}
            <section className="relative overflow-hidden px-5 pb-14 pt-12 md:pt-16">
                <div className="relative mx-auto max-w-6xl">
                    <div className="max-w-2xl">
                        <HomeProfileNudge />
                        <div className="inline-flex items-center rounded-full bg-white px-3.5 py-1 shadow-sm">
                            <span className="text-xs font-bold text-joy-ink-muted">
                                Non-profit · built by students · free forever
                            </span>
                        </div>
                        <h1 className="joy-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-joy-ink sm:text-5xl md:text-6xl">
                            Every internship.
                            <br />
                            One place.
                            <br />
                            <span className="text-joy-grass">Updated daily.</span>
                        </h1>
                        <p className="mt-5 max-w-xl text-lg text-joy-ink-muted">
                            {jobsLabel} live internships &amp; new-grad roles from {companiesLabel} companies,
                            updated daily.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative w-full max-w-md">
                                <Search
                                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-joy-ink/30"
                                    aria-hidden="true"
                                />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search role, company, location…"
                                    aria-label="Search jobs"
                                    className="w-full rounded-xl border border-joy-ink/10 bg-white py-3 pl-10 pr-3.5 text-sm text-joy-ink shadow-sm placeholder:text-joy-ink/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                />
                            </div>
                            <PlaygroundButton onClick={() => focusAlertBuilder()} className="shrink-0 !py-3">
                                Get alerts
                            </PlaygroundButton>
                        </div>

                        {pulse && (
                            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                                <span className="flex items-center gap-2">
                                    <span className="joy-pulse-dot h-2 w-2 rounded-full bg-joy-grass-bright" aria-hidden="true" />
                                    <span className="joy-mono text-xs text-joy-ink-muted">
                                        <span className="font-bold text-joy-grass">
                                            {pulse.addedToday.toLocaleString("en-US")}
                                        </span>{" "}
                                        added today · {pulse.addedThisWeek.toLocaleString("en-US")} this week · last
                                        drop {pulse.lastDropLabel}
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
                </div>
            </section>

            {/* ---------------- Jobs / search-swap ---------------- */}
            <section className="px-5 py-14">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="joy-mono text-xs font-bold uppercase tracking-wide text-joy-grass">
                                {isSearching ? "Full feed" : "Fresh drops"}
                            </p>
                            <h2 className="joy-display mt-1 text-3xl font-extrabold text-joy-ink">
                                {isSearching ? "Search the whole board" : "Just landed"}
                            </h2>
                        </div>
                        {!isSearching && (
                            <Link
                                to={HOME_ROUTES.jobs}
                                className="rounded text-sm font-bold text-joy-grass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
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
                                        <div key={i} className="h-32 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                                    ))}
                                </div>
                            ) : freshJobs.length === 0 ? (
                                <p className="text-sm text-joy-ink-muted">
                                    The feed is quiet right now — check back shortly, or set up an alert to be notified.
                                </p>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {freshJobs.map((job, i) => (
                                        <Link
                                            key={job.id}
                                            to={HOME_ROUTES.jobDetail(job.id)}
                                            className={`flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${FRESH_ACCENTS[i % FRESH_ACCENTS.length]}`}
                                        >
                                            <p className="joy-display truncate text-sm font-bold text-joy-ink">
                                                {job.title}
                                            </p>
                                            <p className="mt-0.5 truncate text-sm text-joy-ink-muted">{job.company_name}</p>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${jobTypeChipClass(job.type)}`}>
                                                    {jobTypeChipLabel(job.type)}
                                                </span>
                                                {job.locations[0] && (
                                                    <span className="truncate text-xs text-joy-ink/40">{job.locations[0]}</span>
                                                )}
                                            </div>
                                            <p className="joy-mono mt-2 text-xs text-joy-ink/35">{formatPostedLabel(job)}</p>
                                        </Link>
                                    ))}
                                </div>
                            )
                        ) : allLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="h-14 animate-pulse rounded-xl border border-joy-ink/8 bg-white" />
                                ))}
                                <p className="pt-1 text-xs text-joy-ink-muted">Searching…</p>
                            </div>
                        ) : (
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-joy-ink-muted">
                                        <span className="joy-mono">{filteredMatches.length.toLocaleString("en-US")}</span>{" "}
                                        match{filteredMatches.length === 1 ? "" : "es"} for &ldquo;{debouncedQuery.trim()}&rdquo;
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        {RESULT_TYPE_FILTERS.map((f) => (
                                            <button
                                                key={f.value}
                                                type="button"
                                                onClick={() => setTypeFilter(f.value)}
                                                className={`rounded-full border px-3 py-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
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

                                {filteredMatches.length > 0 && (
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-joy-grass/30 bg-joy-grass-bright/8 px-4 py-3">
                                        <p className="text-sm text-joy-ink/80">
                                            Get a {frequency} email when new &ldquo;{debouncedQuery.trim()}&rdquo; roles drop.
                                        </p>
                                        <PlaygroundButton onClick={() => focusAlertBuilder(searchQuery.trim())} className="shrink-0 !px-4 !py-2 !text-xs">
                                            Get alerts for this search
                                        </PlaygroundButton>
                                    </div>
                                )}

                                {filteredMatches.length === 0 ? (
                                    <div className="mt-6 rounded-2xl border border-joy-ink/8 bg-white p-6 text-center shadow-sm">
                                        <p className="text-sm text-joy-ink-muted">
                                            No live roles match that yet — be first to know when one appears.
                                        </p>
                                        <PlaygroundButton
                                            onClick={() => focusAlertBuilder(searchQuery.trim())}
                                            variant="outline"
                                            className="mt-4"
                                        >
                                            Get alerts for this search
                                        </PlaygroundButton>
                                    </div>
                                ) : (
                                    <div className="mt-4 overflow-hidden rounded-2xl border border-joy-ink/8 bg-white shadow-sm">
                                        <div className="hidden grid-cols-[2.3fr_1.3fr_6.5rem_7.5rem] gap-3 border-b border-joy-ink/8 bg-joy-surface-sunk px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-joy-ink-muted sm:grid">
                                            <span>Role · Company</span>
                                            <span>Location</span>
                                            <span>Type</span>
                                            <span className="text-right">Posted</span>
                                        </div>
                                        <ul>
                                            {displayedMatches.map((job, i) => (
                                                <JobResultRow key={job.id} job={job} first={i === 0} />
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <Link
                                    to={`${HOME_ROUTES.jobs}?search=${encodeURIComponent(debouncedQuery.trim())}`}
                                    className="mt-4 inline-block rounded text-sm font-bold text-joy-grass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                >
                                    See all {filteredMatches.length.toLocaleString("en-US")} on the job board →
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Alert builder (primary capture surface) ---------------- */}
            <section ref={alertSectionRef} id="alert-builder" className="bg-joy-surface-sunk px-5 py-16">
                <div className="mx-auto max-w-2xl">
                    <div className="text-center">
                        <h2 className="joy-display text-3xl font-extrabold text-joy-ink">Get alerts</h2>
                        <p className="mt-2 text-joy-ink-muted">
                            Tell us what you&apos;re hunting for — we&apos;ll email you the moment matching roles
                            drop.
                        </p>
                    </div>

                    <div className="mt-8 rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-[0_4px_0_rgba(43,33,24,0.05)] sm:p-8">
                        {subscribed ? (
                            <div className="flex flex-col items-center gap-3 py-4 text-center">
                                <MilestoneBadge size={64} />
                                <p className="joy-display text-lg font-bold text-joy-ink">
                                    {frequency === "weekly"
                                        ? "You're in — first digest within the week"
                                        : "You're in — first digest tomorrow morning"}
                                </p>
                                <p className="joy-mono text-sm text-joy-ink-muted">
                                    {scopeSummary(frequency, alertQuery, jobType)}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSubscribed(false)}
                                    className="mt-1 rounded text-sm font-bold text-joy-grass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                >
                                    Edit alert
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-joy-ink-muted">Frequency</p>
                                        <div className="mt-2 inline-flex rounded-lg bg-joy-ink/5 p-1">
                                            {(["daily", "weekly"] as const).map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setFrequency(f)}
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
                                                        frequency === f ? "bg-white text-joy-ink shadow-sm" : "text-joy-ink-muted"
                                                    }`}
                                                >
                                                    {f === "daily" ? "Daily" : "Weekly"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-joy-ink-muted">Job type</p>
                                        <div className="mt-2 inline-flex rounded-lg bg-joy-ink/5 p-1">
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
                                                    className={`rounded-md px-3.5 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
                                                        jobType === opt.value ? "bg-white text-joy-ink shadow-sm" : "text-joy-ink-muted"
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <p className="text-xs font-bold uppercase tracking-wide text-joy-ink-muted">Keywords</p>
                                    <input
                                        ref={keywordInputRef}
                                        value={alertQuery}
                                        onChange={(e) => setAlertQuery(e.target.value)}
                                        placeholder="react, data, Toronto — optional"
                                        className="mt-2 w-full rounded-xl border border-joy-ink/10 bg-joy-surface px-3.5 py-2.5 text-sm text-joy-ink placeholder:text-joy-ink/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                    />
                                </div>

                                <div className="mt-6">
                                    {signedIn ? (
                                        <form onSubmit={handleEmailSubmit}>
                                            <PlaygroundButton type="submit" className="w-full">
                                                {submitting ? "Signing up…" : "Get alerts"}
                                            </PlaygroundButton>
                                            <p className="mt-1.5 text-center text-xs text-joy-ink-muted">
                                                {user?.email
                                                    ? `We'll send them to ${user.email}.`
                                                    : "We'll send them to your account email."}
                                            </p>
                                        </form>
                                    ) : (
                                        <>
                                            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2 sm:flex-row">
                                                <input
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="you@school.edu"
                                                    className="min-w-0 flex-1 rounded-xl border border-joy-ink/10 bg-white px-3.5 py-2.5 text-sm text-joy-ink placeholder:text-joy-ink/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                                />
                                                <PlaygroundButton type="submit" className="shrink-0">
                                                    {submitting ? "Signing up…" : "Get alerts"}
                                                </PlaygroundButton>
                                            </form>

                                            <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-joy-ink/40">
                                                <span className="h-px flex-1 bg-joy-ink/15" />
                                                or
                                                <span className="h-px flex-1 bg-joy-ink/15" />
                                            </div>

                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={handleGoogleContinue}
                                                    className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-joy-ink/12 bg-white px-4 py-2.5 text-sm font-semibold text-joy-ink transition hover:border-joy-ink/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                                >
                                                    <FcGoogle className="h-4 w-4" aria-hidden="true" />
                                                    Continue with Google
                                                </button>
                                                <p className="mt-1.5 text-center text-xs text-joy-ink-muted">
                                                    We&apos;ll save this alert.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ---------------- Why free (human element) ---------------- */}
            <section className="px-5 py-16">
                <div className="mx-auto max-w-2xl">
                    <p className="joy-mono text-xs font-bold uppercase tracking-wide text-joy-grass">Why free?</p>
                    <h2 className="joy-display mt-1 text-2xl font-extrabold text-joy-ink">
                        Built by students, for students.
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-joy-ink-muted">
                        Tail&apos;ed Community is a non-profit run by students who were sick of job boards and gatekept
                        opportunities. Every line of it is public, and it stays free forever.
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-joy-ink-muted">
                        We believe we have the power to change how things are done — and that by building a
                        community together, we can have a seat at the table.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                        <a
                            href="https://github.com/tailed-community"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded text-sm font-bold text-joy-grass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                        >
                            <Github className="h-4 w-4" aria-hidden="true" />
                            We build in the open
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded text-sm font-bold text-joy-grass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                        >
                            <SiDiscord className="h-4 w-4" aria-hidden="true" />
                            Come say hi on Discord
                        </a>
                    </div>
                </div>
            </section>

            {/* ---------------- Beyond the board ----------------
                Stands in for the live landing's "This week on Tail'ed" (/public/explore)
                section — see Phase C report for why that section was deferred rather
                than ported here. */}
            <section className="border-t border-joy-ink/8 px-5 py-14">
                <div className="mx-auto max-w-5xl">
                    <h2 className="joy-display text-2xl font-extrabold text-joy-ink">Beyond the job board</h2>
                    <div className="mt-6 grid gap-6 sm:grid-cols-3">
                        {COMMUNITY_LINKS.map((item) => (
                            <PreloadLink
                                key={item.to}
                                to={item.to}
                                className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                            >
                                <p className="joy-display text-base font-bold text-joy-ink">
                                    {item.title}{" "}
                                    <ArrowRight
                                        className="inline-block h-4 w-4 text-joy-ink/30 transition group-hover:translate-x-0.5 group-hover:text-joy-grass"
                                        aria-hidden="true"
                                    />
                                </p>
                                <p className="mt-1 text-sm text-joy-ink-muted">{item.blurb}</p>
                            </PreloadLink>
                        ))}
                    </div>
                </div>
            </section>
        </PlaygroundShell>
    );
}
