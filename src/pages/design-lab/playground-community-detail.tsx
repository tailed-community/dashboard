import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Github, Users } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { LabSwitcher } from "@/pages/design-lab/lab-shared";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { apiFetch } from "@/lib/fetch";
import { getFileUrl } from "@/lib/firebase-client";
import type { Community } from "@/components/community/community-card";
import { getMockCommunityById } from "@/pages/design-lab/playground-communities-mock";

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

function formatMemberCount(count: number): string {
    if (count >= 1000) {
        const value = (count / 1000).toFixed(1).replace(/\.0$/, "");
        return `${value}k`;
    }
    return count.toString();
}

/** Shared chrome (header/footer/LabSwitcher) so loading, not-found, and loaded states all look like the same page. */
function PageShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="min-h-screen w-full overflow-x-hidden bg-[#FFFBF0] text-[#2B2118]"
            style={{ fontFamily: "'Nunito', ui-sans-serif, system-ui, sans-serif" }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');
                .joy-display { font-family: 'Baloo 2', ui-rounded, system-ui, sans-serif; }
                .joy-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }

                @keyframes joySwapIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .joy-swap { animation: joySwapIn 0.32s ease both; }

                @media (prefers-reduced-motion: reduce) {
                    .joy-swap { animation: none; }
                }
            `}</style>

            {/* ---------------- Header (wordmark-only, no nav item marked active) ---------------- */}
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
                        {NAV_LINKS.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="rounded-lg px-3.5 py-2 text-sm font-bold text-[#6B5D4F] transition hover:bg-[#2B2118]/5 hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                            >
                                {item.label}
                            </Link>
                        ))}
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

            {children}

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
                            className="inline-flex items-center gap-2 rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <Github className="h-4 w-4" aria-hidden="true" />
                            GitHub
                        </a>
                        <a
                            href="https://discord.gg/gpbtFXTgNQ"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                        >
                            <SiDiscord className="h-4 w-4" aria-hidden="true" />
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

export default function PlaygroundCommunityDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [community, setCommunity] = useState<Community | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMock, setIsMock] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [joined, setJoined] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function fetchCommunity() {
            if (!id) {
                setIsLoading(false);
                setNotFound(true);
                return;
            }

            try {
                setIsLoading(true);
                setNotFound(false);

                const response = await apiFetch(`/public/communities/${id}`);
                const data = await response.json();

                if (!response.ok || !data.community) {
                    throw new Error(data.error || "Community not found");
                }

                const comm = data.community;
                const mapped: Community = {
                    id: comm.id ?? id,
                    name: comm.name,
                    description: comm.description,
                    shortDescription: comm.shortDescription,
                    slug: comm.slug,
                    category: comm.category,
                    memberCount: comm.memberCount || 0,
                    logoUrl: comm.logo,
                    bannerUrl: comm.banner,
                    members: comm.members || [],
                };

                if (mapped.logoUrl) {
                    try {
                        mapped.logoUrl = await getFileUrl(mapped.logoUrl);
                    } catch (err) {
                        console.error(`Failed to load logo for ${mapped.id}:`, err);
                        mapped.logoUrl = undefined;
                    }
                }
                if (mapped.bannerUrl) {
                    try {
                        mapped.bannerUrl = await getFileUrl(mapped.bannerUrl);
                    } catch (err) {
                        console.error(`Failed to load banner for ${mapped.id}:`, err);
                        mapped.bannerUrl = undefined;
                    }
                }

                if (!cancelled) {
                    setCommunity(mapped);
                    setIsMock(false);
                }
            } catch (err) {
                // PROTOTYPE BEHAVIOR: local dev has no live functions server,
                // so this fetch always fails there — fall back to sample data
                // that matches the listing grid's mock communities.
                console.error(`Error fetching community ${id}, trying sample data instead:`, err);
                const mock = getMockCommunityById(id);
                if (!cancelled) {
                    if (mock) {
                        setCommunity(mock);
                        setIsMock(true);
                    } else {
                        setCommunity(null);
                        setNotFound(true);
                    }
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        fetchCommunity();
        return () => {
            cancelled = true;
        };
    }, [id]);

    if (isLoading) {
        return (
            <PageShell>
                <section className="px-5 py-14">
                    <div className="mx-auto max-w-4xl">
                        <div className="h-8 w-40 animate-pulse rounded-full bg-[#2B2118]/5" />
                        <div className="mt-6 h-52 animate-pulse rounded-3xl border border-[#2B2118]/8 bg-white" />
                        <div className="mt-6 h-24 animate-pulse rounded-2xl border border-[#2B2118]/8 bg-white" />
                    </div>
                </section>
            </PageShell>
        );
    }

    if (notFound || !community) {
        return (
            <PageShell>
                <section className="px-5 py-20">
                    <div className="mx-auto max-w-lg text-center">
                        <p className="joy-display text-2xl font-extrabold text-[#2B2118]">
                            We couldn&apos;t find that community.
                        </p>
                        <p className="mt-3 text-sm text-[#6B5D4F]">
                            It may have been renamed, or the link might be off — either way, there&apos;s a whole
                            grid of others to explore.
                        </p>
                        <Button to="/design-lab/playground/communities" className="mt-6">
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Back to communities
                        </Button>
                    </div>
                </section>
            </PageShell>
        );
    }

    return (
        <PageShell>
            <section className="px-5 pb-16 pt-8">
                <div className="joy-swap mx-auto max-w-4xl">
                    <Link
                        to="/design-lab/playground/communities"
                        className="inline-flex items-center gap-1.5 rounded text-sm font-bold text-[#6B5D4F] hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        All communities
                    </Link>

                    {isMock && (
                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#1CB0F6]/30 bg-[#1CB0F6]/8 px-3.5 py-1.5 text-xs font-bold text-[#0A6FA8]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#1CB0F6]" aria-hidden="true" />
                            Showing a sample community — live data unavailable
                        </div>
                    )}

                    {/* ---------------- Hero ---------------- */}
                    <div className="mt-5 overflow-hidden rounded-3xl border-2 border-[#2B2118]/8 bg-white shadow-sm">
                        <div className="relative h-40 w-full sm:h-52">
                            {community.bannerUrl ? (
                                <img
                                    src={community.bannerUrl}
                                    alt={community.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full bg-gradient-to-br from-[#2E7D02] via-[#58CC02] to-[#1CB0F6]" />
                            )}
                        </div>

                        <div className="relative px-5 pb-6 sm:px-8">
                            <div className="-mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-[#FFF3DC] shadow-lg sm:h-24 sm:w-24">
                                {community.logoUrl ? (
                                    <img
                                        src={community.logoUrl}
                                        alt={`${community.name} logo`}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        <span className="joy-display text-3xl font-bold text-[#2E7D02]">
                                            {community.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h1 className="joy-display text-3xl font-extrabold text-[#2B2118] sm:text-4xl">
                                        {community.name}
                                    </h1>
                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                        <span className="inline-flex w-fit rounded-full bg-[#1CB0F6]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#0A6FA8]">
                                            {community.category}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6B5D4F]">
                                            <Users className="h-3.5 w-3.5 text-[#2B2118]/30" aria-hidden="true" />
                                            <span className="joy-mono">{formatMemberCount(community.memberCount)}</span>
                                            member{community.memberCount === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                </div>

                                {joined ? (
                                    <div className="flex items-center gap-3 rounded-xl border-2 border-[#2E7D02]/30 bg-[#58CC02]/8 px-4 py-2.5">
                                        <span className="flex items-center gap-1.5 text-sm font-bold text-[#2E7D02]">
                                            <Check className="h-4 w-4" aria-hidden="true" />
                                            You&apos;re in!
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setJoined(false)}
                                            className="rounded text-xs font-bold text-[#6B5D4F] underline hover:text-[#2B2118] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D02]/60"
                                        >
                                            Leave
                                        </button>
                                    </div>
                                ) : (
                                    <Button onClick={() => setJoined(true)} className="shrink-0">
                                        Join community
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ---------------- Description ---------------- */}
                    <div className="mt-8 rounded-2xl border border-[#2B2118]/8 bg-white p-6 shadow-sm sm:p-8">
                        <p className="joy-mono text-xs font-bold uppercase tracking-wide text-[#2E7D02]">About</p>
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#6B5D4F] sm:text-base">
                            {community.description || community.shortDescription}
                        </p>
                    </div>
                </div>
            </section>
        </PageShell>
    );
}
