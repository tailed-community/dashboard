import { useEffect, useMemo, useState } from "react";
import { Github, Search, Users } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/fetch";
import { getFileUrl } from "@/lib/firebase-client";
import { trackEvent } from "@/lib/analytics";
import { Seo } from "@/components/seo";
import type { Community } from "@/components/community/community-card";
import { MOCK_COMMUNITIES } from "@/pages/design-lab/playground-communities-mock";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { FRESH_ACCENTS, formatMemberCount } from "@/components/playground/joy-primitives";
import { htmlToText } from "@/lib/html";

/**
 * Live `/communities` list page — joy design system.
 *
 * Adapted from `src/pages/design-lab/playground-communities.tsx` (the joy
 * prototype) but wired for production: real `/public/communities` data only,
 * the design-lab's dev-only mock sample data is now gated behind
 * `import.meta.env.DEV` so production always shows a real empty/error state
 * instead of fabricated sample communities.
 */

const CATEGORIES = [
    "All",
    "Academic",
    "Technology",
    "Arts & Culture",
    "Sports",
    "Business",
    "Health & Wellness",
    "Social",
    "Professional",
];

/** One community tile in the joyful grid — logo, name, blurb, category chip, member count. */
function CommunityTile({ community, accent }: { community: Community; accent: string }) {
    return (
        <Link
            to={LIVE_ROUTES.communityDetail(community.slug || community.id)}
            className={`flex flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${accent}`}
        >
            <div className="flex items-start gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-joy-ink/10 bg-joy-surface-alt">
                    {community.logoUrl ? (
                        <img
                            src={community.logoUrl}
                            alt={`${community.name} logo`}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <span className="joy-display text-lg font-bold text-joy-grass">
                                {community.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="joy-display truncate text-base font-bold text-joy-ink">{community.name}</p>
                    <span className="mt-1 inline-flex w-fit rounded-full bg-joy-sky/12 px-2.5 py-0.5 text-[11px] font-bold text-joy-sky-ink">
                        {community.category}
                    </span>
                </div>
            </div>

            <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-joy-ink-muted">
                {htmlToText(community.shortDescription || community.description)}
            </p>

            <div className="mt-4 flex items-center gap-1.5 border-t border-joy-ink/8 pt-3 text-xs font-semibold text-joy-ink-muted">
                <Users className="h-3.5 w-3.5 text-joy-ink/30" aria-hidden="true" />
                <span className="joy-mono">{formatMemberCount(community.memberCount)}</span>
                <span>member{community.memberCount === 1 ? "" : "s"}</span>
            </div>
        </Link>
    );
}

export default function CommunitiesJoyPage() {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [usingMockData, setUsingMockData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");

    useEffect(() => {
        let cancelled = false;

        async function fetchCommunities() {
            try {
                setIsLoading(true);
                setError(null);

                const response = await apiFetch("/public/communities");
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to fetch communities");
                }

                const fetched: Community[] = (data.communities ?? []).map((comm: any) => ({
                    id: comm.id,
                    name: comm.name,
                    description: comm.description,
                    shortDescription: comm.shortDescription,
                    slug: comm.slug,
                    category: comm.category,
                    memberCount: comm.memberCount || 0,
                    logoUrl: comm.logo,
                    bannerUrl: comm.banner,
                    members: comm.members || [],
                }));

                // No live communities yet (or the collection is empty). In dev
                // (no functions server running locally) fall back to sample
                // data so the page can still be previewed; in production show
                // the real empty state instead of fabricated communities.
                if (fetched.length === 0) {
                    if (!cancelled) {
                        if (import.meta.env.DEV) {
                            setCommunities(MOCK_COMMUNITIES);
                            setUsingMockData(true);
                        } else {
                            setCommunities([]);
                            setUsingMockData(false);
                        }
                    }
                    return;
                }

                // Resolve logo/banner storage paths to real URLs — tolerate
                // per-community failures so one bad path doesn't blank the grid.
                const withUrls = await Promise.all(
                    fetched.map(async (community) => {
                        if (community.logoUrl) {
                            try {
                                community.logoUrl = await getFileUrl(community.logoUrl);
                            } catch (err) {
                                console.error(`Failed to load logo for ${community.id}:`, err);
                                community.logoUrl = undefined;
                            }
                        }
                        if (community.bannerUrl) {
                            try {
                                community.bannerUrl = await getFileUrl(community.bannerUrl);
                            } catch (err) {
                                console.error(`Failed to load banner for ${community.id}:`, err);
                                community.bannerUrl = undefined;
                            }
                        }
                        return community;
                    })
                );

                if (!cancelled) {
                    setCommunities(withUrls);
                    setUsingMockData(false);
                }
            } catch (err) {
                console.error("Error fetching communities:", err);
                if (!cancelled) {
                    if (import.meta.env.DEV) {
                        // PROTOTYPE BEHAVIOR: local dev has no live functions
                        // server, so this fetch always fails there — fall back
                        // to sample data instead of showing an error state.
                        setCommunities(MOCK_COMMUNITIES);
                        setUsingMockData(true);
                    } else {
                        setCommunities([]);
                        setUsingMockData(false);
                        setError("Failed to load communities. Please try again.");
                    }
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        fetchCommunities();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        trackEvent("communities_view");
    }, []);

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return communities.filter((community) => {
            const matchesSearch =
                q === "" ||
                community.name.toLowerCase().includes(q) ||
                community.description.toLowerCase().includes(q);
            const matchesCategory = selectedCategory === "All" || community.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [communities, searchQuery, selectedCategory]);

    return (
        // FORCE LIGHT: the joy design system defines its --joy-* tokens only in
        // :root (never overridden under .dark), so joy-* utility classes always
        // render light regardless of a `.dark` ancestor. data-theme/color-scheme
        // are set explicitly here too so native form controls & any future
        // dark: utilities never flip this page dark by accident.
        <div data-theme="light" style={{ colorScheme: "light" }}>
            <Seo
                title="Student Tech Communities"
                description="Discover and join student tech clubs and communities across Canada — hackathon teams, campus clubs, and more."
                path="/communities"
            />
            <PlaygroundShell
                routes={LIVE_ROUTES}
                showSwitcher={false}
                activeNav="communities"
                cta={{ label: "Get alerts", to: LIVE_ROUTES.alertBuilder }}
            >
                {/* ---------------- Hero ---------------- */}
                <section className="relative overflow-hidden px-5 pb-10 pt-12 md:pt-16">
                    <div className="relative mx-auto max-w-6xl">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center rounded-full bg-white px-3.5 py-1 shadow-sm">
                                <span className="text-xs font-bold text-joy-ink-muted">
                                    Clubs · hackathon teams · student orgs
                                </span>
                            </div>
                            <h1 className="joy-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-joy-ink sm:text-5xl md:text-6xl">
                                Find your people.
                                <br />
                                <span className="text-joy-grass">Build something together.</span>
                            </h1>
                            <p className="mt-5 max-w-xl text-lg text-joy-ink-muted">
                                Campus clubs, hackathon crews, and student-run orgs across Canada — join one, meet
                                people who get it, and stop building your resume alone.
                            </p>
                            <div className="mt-7 flex flex-wrap items-center gap-3">
                                <PlaygroundButton to={LIVE_ROUTES.communityCreate}>Start a community</PlaygroundButton>
                                <p className="text-sm text-joy-ink-muted">
                                    Run a club or student group? Get it in front of thousands of students.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------------- Search + filters + grid ---------------- */}
                <section className="px-5 pb-16">
                    <div className="mx-auto max-w-6xl">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="relative w-full max-w-md">
                                <Search
                                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-joy-ink/30"
                                    aria-hidden="true"
                                />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search communities…"
                                    aria-label="Search communities"
                                    className="w-full rounded-xl border border-joy-ink/10 bg-white py-3 pl-10 pr-3.5 text-sm text-joy-ink shadow-sm placeholder:text-joy-ink/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                />
                            </div>
                            {!isLoading && !error && (
                                <p className="joy-mono text-xs font-semibold text-joy-ink-muted">
                                    {filtered.length.toLocaleString("en-US")} communit{filtered.length === 1 ? "y" : "ies"}
                                </p>
                            )}
                        </div>

                        {usingMockData && !isLoading && (
                            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-joy-sky/30 bg-joy-sky/8 px-3.5 py-1.5 text-xs font-bold text-joy-sky-ink">
                                <span className="h-1.5 w-1.5 rounded-full bg-joy-sky" aria-hidden="true" />
                                Showing sample communities — live data unavailable
                            </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-2">
                            {CATEGORIES.map((category) => {
                                const active = selectedCategory === category;
                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => setSelectedCategory(category)}
                                        className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
                                            active
                                                ? "border-joy-grass/40 bg-joy-grass/10 text-joy-grass"
                                                : "border-joy-ink/10 bg-white text-joy-ink-muted hover:border-joy-ink/25"
                                        }`}
                                    >
                                        {category}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="joy-swap mt-8">
                            {isLoading ? (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-40 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                                    ))}
                                </div>
                            ) : error ? (
                                <div className="rounded-2xl border border-joy-ink/8 bg-white p-8 text-center shadow-sm">
                                    <p className="text-sm text-joy-ink-muted">{error}</p>
                                    <button
                                        type="button"
                                        onClick={() => window.location.reload()}
                                        className="mt-4 inline-flex items-center justify-center rounded-xl border-2 border-joy-ink/12 bg-white px-5 py-2.5 text-sm font-bold text-joy-ink transition hover:border-joy-grass/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                    >
                                        Try again
                                    </button>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="rounded-2xl border border-joy-ink/8 bg-white p-8 text-center shadow-sm">
                                    <p className="text-sm text-joy-ink-muted">
                                        {communities.length === 0
                                            ? "No communities yet — check back soon."
                                            : "Nothing matches that search or category yet. Try widening it up."}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {filtered.map((community, i) => (
                                        <CommunityTile
                                            key={community.id}
                                            community={community}
                                            accent={FRESH_ACCENTS[i % FRESH_ACCENTS.length]}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ---------------- Why free (human element) ---------------- */}
                <section className="border-t border-joy-ink/8 px-5 py-16">
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
            </PlaygroundShell>
        </div>
    );
}
