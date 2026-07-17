import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchExternalJobs, activeExternalJobs } from "@/lib/external-jobs";
import { pickFreshestJobs } from "@/lib/featured-content";
import type { ExternalJob } from "@/types/jobs";

/** All design-lab variants; the switcher and index page render from this list. */
export const LAB_VARIANTS = [
    { slug: "zine", label: "The Zine", blurb: "Neo-brutalist, anti-corporate, loud" },
    { slug: "streak-duo", label: "Streak · Duo", blurb: "Grown-up gamification — streaks without the kiddie vibe" },
    { slug: "after-hours", label: "After Hours", blurb: "Dark-first violet/mint — the board's pulse, not your streak" },
    { slug: "poster", label: "Poster", blurb: "Warm white, ink lines, electric violet — zine energy, matured" },
    { slug: "playground", label: "Playground", blurb: "Duolingo-adjacent joy — illustrated, warm, no streak" },
] as const;

export interface LabJobsData {
    /** Freshest active jobs (deduped per company), ready to render. */
    jobs: ExternalJob[];
    /** Total count of active jobs in the feed, null while loading/failed. */
    activeCount: number | null;
    /** Unique company count among active jobs, null while loading/failed. */
    companyCount: number | null;
    loading: boolean;
}

/**
 * Live jobs data for design-lab prototypes: fetches the real external feed
 * once (module-level cache inside fetchExternalJobs) and derives the numbers
 * every variant needs. Never throws — on feed failure counts stay null and
 * jobs stays empty.
 */
export function useLabJobs(count = 8, maxPerCompany = 2): LabJobsData {
    const [data, setData] = useState<LabJobsData>({
        jobs: [],
        activeCount: null,
        companyCount: null,
        loading: true,
    });

    useEffect(() => {
        let cancelled = false;
        fetchExternalJobs()
            .then((all) => {
                if (cancelled) return;
                const active = activeExternalJobs(all);
                setData({
                    jobs: pickFreshestJobs(active, count, maxPerCompany),
                    activeCount: active.length,
                    companyCount: new Set(active.map((j) => j.company_name)).size,
                    loading: false,
                });
            })
            .catch(() => {
                if (cancelled) return;
                setData((prev) => ({ ...prev, loading: false }));
            });
        return () => {
            cancelled = true;
        };
    }, [count, maxPerCompany]);

    return data;
}

/**
 * Full active job list for client-side search in prototypes (~11k entries,
 * single shared fetch). Separate from useLabJobs so the "fresh picks" grid
 * and the search results can coexist on one page.
 */
export function useAllJobs(): { all: ExternalJob[]; loading: boolean } {
    const [state, setState] = useState<{ all: ExternalJob[]; loading: boolean }>({
        all: [],
        loading: true,
    });

    useEffect(() => {
        let cancelled = false;
        fetchExternalJobs()
            .then((jobs) => {
                if (!cancelled) setState({ all: activeExternalJobs(jobs), loading: false });
            })
            .catch(() => {
                if (!cancelled) setState({ all: [], loading: false });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}

/**
 * Client-side job search: every whitespace-separated token must match the
 * title, company, or a location (case-insensitive AND-match). Empty/blank
 * queries return []. Results keep feed order; callers re-sort as needed.
 */
export function searchJobs(all: ExternalJob[], query: string): ExternalJob[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return all.filter((job) => {
        const haystack = `${job.title} ${job.company_name} ${(job.locations ?? []).join(" ")}`.toLowerCase();
        return tokens.every((t) => haystack.includes(t));
    });
}

/** Alert settings a visitor configures before leaving an email / using Google. */
export interface AlertPrefs {
    frequency: "daily" | "weekly";
    /** Free-text keyword scope, e.g. "react intern toronto". Empty = all jobs. */
    query: string;
    jobType: "internship" | "new-grad" | null;
}

const PENDING_ALERT_PREFS_KEY = "pendingAlertPrefs";

/**
 * Continue-with-Google path: persists the configured alert so the sign-up /
 * OAuth-callback flow can create the subscription right after the account
 * exists (concept: callback reads this key, POSTs /alerts/subscribe with the
 * account email, then clears it). Returns the sign-up URL to navigate to.
 */
export function stashAlertPrefsForSignup(prefs: AlertPrefs): string {
    try {
        localStorage.setItem(PENDING_ALERT_PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // Storage unavailable (private mode) — sign-up still works, alert is just not pre-created.
    }
    return "/sign-up?intent=job-alerts";
}

/** Rounds down to the nearest 100 with a "+", e.g. 11342 -> "11,300+". */
export function roundedCountLabel(count: number | null, fallback = "Thousands of"): string {
    if (count === null) return fallback;
    const rounded = Math.floor(count / 100) * 100;
    return `${rounded.toLocaleString("en-US")}+`;
}

/**
 * Floating variant switcher shown on every design-lab page so prototypes can
 * be flipped through quickly. Deliberately neutral styling so it doesn't
 * fight any variant's art direction.
 */
export function LabSwitcher() {
    const { pathname } = useLocation();
    return (
        <div
            className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
            <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur">
                <Link
                    to="/design-lab"
                    className="rounded-full px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100"
                >
                    Lab
                </Link>
                {LAB_VARIANTS.map((v) => {
                    const active = pathname === `/design-lab/${v.slug}`;
                    return (
                        <Link
                            key={v.slug}
                            to={`/design-lab/${v.slug}`}
                            className={
                                active
                                    ? "rounded-full bg-gray-900 px-2 py-1 text-xs font-semibold text-white"
                                    : "rounded-full px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                            }
                        >
                            {v.label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
