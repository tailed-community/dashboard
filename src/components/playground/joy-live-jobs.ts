import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";
import {
    fetchExternalJobs,
    activeExternalJobs,
    toMillis,
    formatPostedLabel,
} from "@/lib/external-jobs";
import type { ExternalJob } from "@/types/jobs";

/**
 * Featured/internal job as returned by `GET /public/jobs` (Firestore-backed,
 * companies API). Shape mirrors the (unexported) `FeaturedJob` type in
 * `src/components/unified-job-board.tsx` — the current live board this data
 * source replicates.
 */
export interface FeaturedJobRaw {
    id: string;
    title: string;
    type: string;
    location: string;
    postingDate: string;
    endPostingDate: string;
    status: string;
    organization: {
        id: string;
        name: string;
        logo: string | null;
    };
}

/**
 * Normalized shape consumed by the joy jobs list/detail: one type for both
 * featured (internal, Firestore-backed) and external (feed-backed) jobs, so
 * a single row/card component can render + link either without a big
 * conditional at every call site.
 *
 * Featured jobs link to `/jobs/:id` (PublicJobPage); external jobs link to
 * `/jobs/e/:id` (ExternalJobPage). This split is load-bearing — do not
 * collapse it into a single route helper the way `LIVE_ROUTES.jobDetail`
 * does, since that helper only knows the internal-slug shape.
 */
export interface JoyJob {
    id: string;
    title: string;
    company: string;
    /** Company logo URL — only ever set for featured jobs today. */
    logo: string | null;
    locations: string[];
    type: "internship" | "new-grad";
    featured: boolean;
    category: string | null;
    postedLabel: string;
    /** Millis since epoch, for sorting; 0 when unknown. */
    postedMillis: number;
    /** Route to the job's detail page — already resolved to `/jobs/:id` or `/jobs/e/:id`. */
    href: string;
    /** Present only for external jobs — anything beyond the normalized fields (terms, degrees, url, season, ...) lives here. */
    external?: ExternalJob;
}

function normalizeFeaturedType(raw: string): "internship" | "new-grad" {
    return raw === "internship" ? "internship" : "new-grad";
}

function featuredToJoyJob(job: FeaturedJobRaw): JoyJob {
    const postedMillis = job.postingDate ? Date.parse(job.postingDate) : NaN;
    const hasPostedMillis = Number.isFinite(postedMillis);
    return {
        id: job.id,
        title: job.title,
        company: job.organization?.name ?? "",
        logo: job.organization?.logo ?? null,
        locations: job.location ? [job.location] : [],
        type: normalizeFeaturedType(job.type),
        featured: true,
        category: null,
        postedLabel: hasPostedMillis
            ? new Date(postedMillis).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "Featured",
        postedMillis: hasPostedMillis ? postedMillis : 0,
        href: `/jobs/${job.id}`,
    };
}

function externalToJoyJob(job: ExternalJob): JoyJob {
    return {
        id: job.id,
        title: job.title,
        company: job.company_name,
        logo: null,
        locations: job.locations ?? [],
        type: job.type,
        featured: false,
        category: job.category ?? null,
        postedLabel: formatPostedLabel(job),
        postedMillis: toMillis(job.date_posted),
        href: `/jobs/e/${encodeURIComponent(job.id)}`,
        external: job,
    };
}

export interface LiveJobsState {
    all: JoyJob[];
    loading: boolean;
    /** True if the featured-jobs call failed/threw — external jobs still render, matching UnifiedJobBoard's resilience. */
    featuredFailed: boolean;
}

/**
 * Live jobs data for the production joy jobs list: fetches featured/internal
 * jobs (Firestore, via `/public/jobs`) + the external feed (~11k jobs), then
 * merges + orders them exactly like `UnifiedJobBoard` — featured jobs first
 * (API order), then external jobs newest-first. This is THE production data
 * source for the joy `/jobs` page; losing either half here means dropping
 * real jobs from the live board.
 */
export function useLiveJobs(): LiveJobsState {
    const [state, setState] = useState<LiveJobsState>({ all: [], loading: true, featuredFailed: false });

    useEffect(() => {
        let cancelled = false;

        async function load() {
            const results = await Promise.allSettled([
                apiFetch("/public/jobs", {}, true),
                fetchExternalJobs(),
            ]);
            const [featuredResult, externalResult] = results;

            let featured: JoyJob[] = [];
            let featuredFailed = false;
            if (featuredResult.status === "fulfilled" && featuredResult.value.ok) {
                try {
                    const data = await featuredResult.value.json();
                    featured = ((data.jobs || []) as FeaturedJobRaw[]).map(featuredToJoyJob);
                } catch (error) {
                    featuredFailed = true;
                    console.error("Failed to parse featured jobs:", error);
                }
            } else {
                featuredFailed = true;
                if (featuredResult.status === "rejected") {
                    console.error("Failed to fetch featured jobs:", featuredResult.reason);
                }
            }

            let external: JoyJob[] = [];
            if (externalResult.status === "fulfilled") {
                external = activeExternalJobs(externalResult.value)
                    .map(externalToJoyJob)
                    .sort((a, b) => b.postedMillis - a.postedMillis);
            } else {
                console.error("Failed to fetch external jobs:", externalResult.reason);
            }

            if (!cancelled) setState({ all: [...featured, ...external], loading: false, featuredFailed });
        }

        load().catch((error) => {
            console.error("Unexpected error loading live jobs:", error);
            if (!cancelled) setState({ all: [], loading: false, featuredFailed: true });
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}

/**
 * Client-side search over the merged dataset: every whitespace-separated
 * token must match title, company, or a location (case-insensitive
 * AND-match). Blank queries return the input unfiltered, preserving the
 * featured-first / newest-first order `useLiveJobs` already produced.
 */
export function searchJoyJobs(all: JoyJob[], query: string): JoyJob[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return all;
    return all.filter((job) => {
        const haystack = `${job.title} ${job.company} ${job.locations.join(" ")}`.toLowerCase();
        return tokens.every((t) => haystack.includes(t));
    });
}

export type JoyJobTypeFilter = "all" | "internship" | "new-grad" | "featured";

/**
 * Mirrors UnifiedJobBoard's type-facet semantics exactly: once a job is
 * featured it's filed under the "featured" facet value, not its underlying
 * internship/new-grad type — so selecting "Internship" won't also surface
 * featured internships. Keeps the joy list's filter behavior identical to
 * the board it replaces.
 */
export function matchesJoyTypeFilter(job: JoyJob, filter: JoyJobTypeFilter): boolean {
    if (filter === "all") return true;
    if (filter === "featured") return job.featured;
    return !job.featured && job.type === filter;
}

const DAY_MS = 86_400_000;

export interface JoyFeedPulse {
    addedToday: number;
    addedThisWeek: number;
    lastDropLabel: string;
    dayCounts: number[];
}

/**
 * Same shape/semantics as `computeFeedPulse` in joy-primitives.tsx, but over
 * the merged featured+external dataset (via `postedMillis`) instead of the
 * external feed alone — duplicated rather than reusing that helper since it's
 * typed to `ExternalJob[]` and joy-primitives.tsx is off-limits to edit here.
 */
export function computeJoyFeedPulse(all: JoyJob[]): JoyFeedPulse | null {
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
        const t = job.postedMillis;
        if (t <= 0 || t > now + DAY_MS) continue;
        if (t > latest) latest = t;
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
