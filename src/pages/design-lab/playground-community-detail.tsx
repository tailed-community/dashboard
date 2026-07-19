import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Users } from "lucide-react";
import { apiFetch } from "@/lib/fetch";
import { getFileUrl } from "@/lib/firebase-client";
import type { Community } from "@/components/community/community-card";
import { getMockCommunityById } from "@/pages/design-lab/playground-communities-mock";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LAB_ROUTES } from "@/components/playground/playground-routes";
import { formatMemberCount } from "@/components/playground/joy-primitives";

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

    const shellProps = {
        routes: LAB_ROUTES,
        showSwitcher: true,
        activeNav: null,
        cta: { label: "Get alerts", to: LAB_ROUTES.signUp },
    };

    if (isLoading) {
        return (
            <PlaygroundShell {...shellProps}>
                <section className="px-5 py-14">
                    <div className="mx-auto max-w-4xl">
                        <div className="h-8 w-40 animate-pulse rounded-full bg-joy-ink/5" />
                        <div className="mt-6 h-52 animate-pulse rounded-3xl border border-joy-ink/8 bg-white" />
                        <div className="mt-6 h-24 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                    </div>
                </section>
            </PlaygroundShell>
        );
    }

    if (notFound || !community) {
        return (
            <PlaygroundShell {...shellProps}>
                <section className="px-5 py-20">
                    <div className="mx-auto max-w-lg text-center">
                        <p className="joy-display text-2xl font-extrabold text-joy-ink">
                            We couldn&apos;t find that community.
                        </p>
                        <p className="mt-3 text-sm text-joy-ink-muted">
                            It may have been renamed, or the link might be off — either way, there&apos;s a whole
                            grid of others to explore.
                        </p>
                        <PlaygroundButton to={LAB_ROUTES.communities} className="mt-6">
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Back to communities
                        </PlaygroundButton>
                    </div>
                </section>
            </PlaygroundShell>
        );
    }

    return (
        <PlaygroundShell {...shellProps}>
            <section className="px-5 pb-16 pt-8">
                <div className="joy-swap mx-auto max-w-4xl">
                    <Link
                        to={LAB_ROUTES.communities}
                        className="inline-flex items-center gap-1.5 rounded text-sm font-bold text-joy-ink-muted hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        All communities
                    </Link>

                    {isMock && (
                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-joy-sky/30 bg-joy-sky/8 px-3.5 py-1.5 text-xs font-bold text-joy-sky-ink">
                            <span className="h-1.5 w-1.5 rounded-full bg-joy-sky" aria-hidden="true" />
                            Showing a sample community — live data unavailable
                        </div>
                    )}

                    {/* ---------------- Hero ---------------- */}
                    <div className="mt-5 overflow-hidden rounded-3xl border-2 border-joy-ink/8 bg-white shadow-sm">
                        <div className="relative h-40 w-full sm:h-52">
                            {community.bannerUrl ? (
                                <img
                                    src={community.bannerUrl}
                                    alt={community.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="h-full w-full bg-gradient-to-br from-joy-grass via-joy-grass-bright to-joy-sky" />
                            )}
                        </div>

                        <div className="relative px-5 pb-6 sm:px-8">
                            <div className="-mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-joy-surface-alt shadow-lg sm:h-24 sm:w-24">
                                {community.logoUrl ? (
                                    <img
                                        src={community.logoUrl}
                                        alt={`${community.name} logo`}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        <span className="joy-display text-3xl font-bold text-joy-grass">
                                            {community.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h1 className="joy-display text-3xl font-extrabold text-joy-ink sm:text-4xl">
                                        {community.name}
                                    </h1>
                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                        <span className="inline-flex w-fit rounded-full bg-joy-sky/12 px-2.5 py-0.5 text-[11px] font-bold text-joy-sky-ink">
                                            {community.category}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-joy-ink-muted">
                                            <Users className="h-3.5 w-3.5 text-joy-ink/30" aria-hidden="true" />
                                            <span className="joy-mono">{formatMemberCount(community.memberCount)}</span>
                                            member{community.memberCount === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                </div>

                                {joined ? (
                                    <div className="flex items-center gap-3 rounded-xl border-2 border-joy-grass/30 bg-joy-grass-bright/8 px-4 py-2.5">
                                        <span className="flex items-center gap-1.5 text-sm font-bold text-joy-grass">
                                            <Check className="h-4 w-4" aria-hidden="true" />
                                            You&apos;re in!
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setJoined(false)}
                                            className="rounded text-xs font-bold text-joy-ink-muted underline hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                                        >
                                            Leave
                                        </button>
                                    </div>
                                ) : (
                                    <PlaygroundButton onClick={() => setJoined(true)} className="shrink-0">
                                        Join community
                                    </PlaygroundButton>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ---------------- Description ---------------- */}
                    <div className="mt-8 rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm sm:p-8">
                        <p className="joy-mono text-xs font-bold uppercase tracking-wide text-joy-grass">About</p>
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-joy-ink-muted sm:text-base">
                            {community.description || community.shortDescription}
                        </p>
                    </div>
                </div>
            </section>
        </PlaygroundShell>
    );
}
