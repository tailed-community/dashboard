import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { Github } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { LabSwitcher } from "@/pages/design-lab/lab-shared";
import { apiFetch } from "@/lib/fetch";
import { getFileUrl } from "@/lib/firebase-client";
import type { Community } from "@/components/community/community-card";
import { MOCK_COMMUNITIES } from "@/pages/design-lab/playground-communities-mock";

/** Chunky, joyful button: rounded, green primary with a pressed bottom-shadow edge. (Ported from playground.tsx.) */
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

/** Cycled community-card accents (border only — the card itself stays white/cream). Ported from playground.tsx's FRESH_ACCENTS. */
const FRESH_ACCENTS = [
    "border-[#2E7D02]/30 hover:border-[#2E7D02]/55",
    "border-[#1CB0F6]/35 hover:border-[#1CB0F6]/60",
    "border-[#FFC800]/70 hover:border-[#FFC800]/95",
];

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

function formatMemberCount(count: number): string {
    if (count >= 1000) {
        const value = (count / 1000).toFixed(1).replace(/\.0$/, "");
        return `${value}k`;
    }
    return count.toString();
}

/** One community tile in the joyful grid — logo, name, blurb, category chip, member count. */
function CommunityTile({ community, accent }: { community: Community; accent: string }) {
    return (
        <Link
            to={`/design-lab/playground/communities/${community.slug || community.id}`}
            className={`flex flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 ${accent}`}
        >
            <div className="flex items-start gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 border-[#2B2118]/10 bg-[#FFF3DC]">
                    {community.logoUrl ? (
                        <img
                            src={community.logoUrl}
                            alt={`${community.name} logo`}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <span className="joy-display text-lg font-bold text-[#2E7D02]">
                                {community.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="joy-display truncate text-base font-bold text-[#2B2118]">{community.name}</p>
                    <span className="mt-1 inline-flex w-fit rounded-full bg-[#1CB0F6]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#0A6FA8]">
                        {community.category}
                    </span>
                </div>
            </div>

            <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-[#6B5D4F]">
                {community.shortDescription || community.description}
            </p>

            <div className="mt-4 flex items-center gap-1.5 border-t border-[#2B2118]/8 pt-3 text-xs font-semibold text-[#6B5D4F]">
                <Users className="h-3.5 w-3.5 text-[#2B2118]/30" aria-hidden="true" />
                <span className="joy-mono">{formatMemberCount(community.memberCount)}</span>
                <span>member{community.memberCount === 1 ? "" : "s"}</span>
            </div>
        </Link>
    );
}

export default function PlaygroundCommunitiesPage() {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [usingMockData, setUsingMockData] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");

    useEffect(() => {
        let cancelled = false;

        async function fetchCommunities() {
            try {
                setIsLoading(true);

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

                // No live communities yet (or the collection is empty) — fall
                // back to sample data so this prototype can still be previewed.
                if (fetched.length === 0) {
                    if (!cancelled) {
                        setCommunities(MOCK_COMMUNITIES);
                        setUsingMockData(true);
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
                // PROTOTYPE BEHAVIOR: local dev has no live functions server,
                // so this fetch always fails there — fall back to sample data
                // instead of showing an error/empty state.
                console.error("Error fetching communities, showing sample data instead:", err);
                if (!cancelled) {
                    setCommunities(MOCK_COMMUNITIES);
                    setUsingMockData(true);
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
                        <div className="flex items-center h-8 sm:h-9">
                            <AspectRatio ratio={3042 / 968} className="h-full w-auto">
                                <img
                                    src="/Tailed_Community_logo.png"
                                    alt="Tail'ed Community logo"
                                    className="object-contain h-full w-full"
                                />
                            </AspectRatio>
                        </div>
                    </Link>
                    <nav className="hidden items-center gap-1 md:flex">
                        {NAV_LINKS.map((item) => {
                            const isActive = item.to === "/design-lab/playground/communities";
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`rounded-lg px-3.5 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 ${
                                        isActive
                                            ? "text-[#2E7D02] underline decoration-2 underline-offset-4"
                                            : "text-[#6B5D4F] hover:bg-[#2B2118]/5 hover:text-[#2B2118]"
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="flex items-center gap-3">
                        <Link
                            to="/sign-in"
                            className="hidden rounded text-sm font-bold text-[#6B5D4F] hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 sm:inline-block"
                        >
                            Sign in
                        </Link>
                        <Button to="/sign-up" className="!px-4 !py-2 !text-xs">
                            Get alerts
                        </Button>
                    </div>
                </div>
            </header>

            {/* ---------------- Hero ---------------- */}
            <section className="relative overflow-hidden px-5 pb-10 pt-12 md:pt-16">
                <div className="relative mx-auto max-w-6xl">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center rounded-full bg-white px-3.5 py-1 shadow-sm">
                            <span className="text-xs font-bold text-[#6B5D4F]">
                                Clubs · hackathon teams · student orgs
                            </span>
                        </div>
                        <h1 className="joy-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-[#2B2118] sm:text-5xl md:text-6xl">
                            Find your people.
                            <br />
                            <span className="text-[#2E7D02]">Build something together.</span>
                        </h1>
                        <p className="mt-5 max-w-xl text-lg text-[#6B5D4F]">
                            Campus clubs, hackathon crews, and student-run orgs across Canada — join one, meet
                            people who get it, and stop building your resume alone.
                        </p>
                    </div>
                </div>
            </section>

            {/* ---------------- Search + filters + grid ---------------- */}
            <section className="px-5 pb-16">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full max-w-md">
                            <Search
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2B2118]/30"
                                aria-hidden="true"
                            />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search communities…"
                                aria-label="Search communities"
                                className="w-full rounded-xl border border-[#2B2118]/10 bg-white py-3 pl-10 pr-3.5 text-sm text-[#2B2118] shadow-sm placeholder:text-[#2B2118]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                            />
                        </div>
                        {!isLoading && (
                            <p className="joy-mono text-xs font-semibold text-[#6B5D4F]">
                                {filtered.length.toLocaleString("en-US")} communit{filtered.length === 1 ? "y" : "ies"}
                            </p>
                        )}
                    </div>

                    {usingMockData && !isLoading && (
                        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#1CB0F6]/30 bg-[#1CB0F6]/8 px-3.5 py-1.5 text-xs font-bold text-[#0A6FA8]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#1CB0F6]" aria-hidden="true" />
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
                                    className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60 ${
                                        active
                                            ? "border-[#2E7D02]/40 bg-[#2E7D02]/10 text-[#2E7D02]"
                                            : "border-[#2B2118]/10 bg-white text-[#6B5D4F] hover:border-[#2B2118]/25"
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
                                    <div key={i} className="h-40 animate-pulse rounded-2xl border border-[#2B2118]/8 bg-white" />
                                ))}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="rounded-2xl border border-[#2B2118]/8 bg-white p-8 text-center shadow-sm">
                                <p className="text-sm text-[#6B5D4F]">
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
            <section className="border-t border-[#2B2118]/8 px-5 py-16">
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
