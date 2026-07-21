import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { apiFetch } from "@/lib/fetch";
import { getFileUrl } from "@/lib/firebase-client";
import { trackEvent } from "@/lib/analytics";
import { Seo } from "@/components/seo";
import type { Community } from "@/components/community/community-card";
import { getMockCommunityById } from "@/pages/design-lab/playground-communities-mock";
import { PlaygroundShell } from "@/components/playground/playground-chrome";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { LIVE_ROUTES } from "@/components/playground/playground-routes";
import { formatMemberCount } from "@/components/playground/joy-primitives";
import { RichText } from "@/components/ui/rich-text";
import { htmlToExcerpt } from "@/lib/html";

/**
 * Live `/communities/:id` detail page — joy design system.
 *
 * Adapted from `src/pages/design-lab/playground-community-detail.tsx` (the
 * joy prototype) but wired for production:
 *  - Real `/public/communities/:id` data only; the design-lab's dev-only
 *    mock sample fallback is gated behind `import.meta.env.DEV`. In
 *    production a fetch failure/miss lands on the real "not found" state.
 *  - The prototype's local-only `joined` toggle is replaced with the real
 *    join/leave flow from `src/pages/communities/[id]/page.tsx`:
 *    `POST /communities/:id/join|leave` via `apiFetch`, gated on
 *    `useAuth` (unauthenticated -> redirect to /sign-in), with a sonner
 *    toast and a live member-count update.
 */

const SITE_URL = "https://community.tailed.ca";

function isAbsoluteHttpUrl(url?: string | null): url is string {
    return !!url && /^https?:\/\//i.test(url);
}

/**
 * `GET /public/communities/:identifier` spreads the raw Firestore doc, so
 * `admins` is on the wire even though the shared `Community` card type (which
 * only models what a listing card renders) doesn't declare it. We need it to
 * decide whether to surface the "Manage community" shortcut.
 */
type CommunityDetail = Community & {
    admins?: string[];
};

export default function CommunityDetailJoyPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isPlatformAdmin } = usePlatformAdmin();
    const [community, setCommunity] = useState<CommunityDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMock, setIsMock] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [isMember, setIsMember] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);

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
                const mapped: CommunityDetail = {
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
                    admins: comm.admins || [],
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
                    setIsMember(!!(user && mapped.members?.includes(user.uid)));
                    trackEvent("community_detail_view", { communityId: mapped.id });
                }
            } catch (err) {
                console.error(`Error fetching community ${id}:`, err);
                if (!cancelled) {
                    if (import.meta.env.DEV) {
                        // PROTOTYPE BEHAVIOR: local dev has no live functions
                        // server, so this fetch always fails there — fall back
                        // to sample data that matches the listing grid's mock
                        // communities.
                        const mock = getMockCommunityById(id);
                        if (mock) {
                            setCommunity(mock);
                            setIsMock(true);
                            setIsMember(false);
                        } else {
                            setCommunity(null);
                            setNotFound(true);
                        }
                    } else {
                        // Production: real not-found/empty state, never
                        // fabricated sample data.
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Keep membership in sync if the auth state resolves/changes after the
    // community has already loaded (e.g. user signs in on this page).
    useEffect(() => {
        if (!community) return;
        setIsMember(!!(user && community.members?.includes(user.uid)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid]);

    const handleJoin = async () => {
        if (!community) return;

        if (!user) {
            toast.error("Please sign in to join this community");
            navigate("/sign-in");
            return;
        }

        // Mock/sample communities have no real backend record to join.
        if (isMock) {
            toast.error("Sample community — sign in and check back once live data loads.");
            return;
        }

        setJoinLoading(true);

        try {
            const endpoint = isMember
                ? `/communities/${community.id}/leave`
                : `/communities/${community.id}/join`;

            const response = await apiFetch(endpoint, {
                method: "POST",
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to update membership");
            }

            if (isMember) {
                setIsMember(false);
                setCommunity({ ...community, memberCount: Math.max(0, community.memberCount - 1) });
                trackEvent("community_leave", { communityId: community.id });
                toast.success("Left community", { description: `You've left ${community.name}` });
            } else {
                setIsMember(true);
                setCommunity({ ...community, memberCount: community.memberCount + 1 });
                trackEvent("community_join", { communityId: community.id });
                toast.success("Joined community!", { description: `Welcome to ${community.name}` });
            }
        } catch (error) {
            console.error("Error toggling membership:", error);
            toast.error("Failed to update membership", {
                description: error instanceof Error ? error.message : "Please try again",
            });
        } finally {
            setJoinLoading(false);
        }
    };

    const shellProps = {
        routes: LIVE_ROUTES,
        showSwitcher: false,
        activeNav: null,
        cta: { label: "Get alerts", to: LIVE_ROUTES.alertBuilder },
    };

    if (isLoading) {
        return (
            <div data-theme="light" style={{ colorScheme: "light" }}>
                <PlaygroundShell {...shellProps}>
                    <section className="px-5 py-14">
                        <div className="mx-auto max-w-4xl">
                            <div className="h-8 w-40 animate-pulse rounded-full bg-joy-ink/5" />
                            <div className="mt-6 h-52 animate-pulse rounded-3xl border border-joy-ink/8 bg-white" />
                            <div className="mt-6 h-24 animate-pulse rounded-2xl border border-joy-ink/8 bg-white" />
                        </div>
                    </section>
                </PlaygroundShell>
            </div>
        );
    }

    if (notFound || !community) {
        return (
            <div data-theme="light" style={{ colorScheme: "light" }}>
                <Seo
                    title="Community not found"
                    description="This community may have been renamed or removed."
                    noSuffix={false}
                />
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
                            <PlaygroundButton to={LIVE_ROUTES.communities} className="mt-6">
                                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                                Back to communities
                            </PlaygroundButton>
                        </div>
                    </section>
                </PlaygroundShell>
            </div>
        );
    }

    // Community admins — and platform admins, who can manage any community —
    // get a quiet shortcut into the management console alongside the join CTA.
    // Mock/sample communities have no real record behind them to manage.
    const canManageCommunity =
        !isMock && (isPlatformAdmin || !!(user && community.admins?.includes(user.uid)));

    const canonicalPath = `/communities/${id}`;
    const seoDescription = htmlToExcerpt(
        community.shortDescription || community.description || "Join this student community on Tail'ed."
    );
    const seoImage = isAbsoluteHttpUrl(community.bannerUrl)
        ? community.bannerUrl
        : isAbsoluteHttpUrl(community.logoUrl)
            ? community.logoUrl
            : undefined;

    return (
        <div data-theme="light" style={{ colorScheme: "light" }}>
            <Seo
                title={community.name}
                description={seoDescription}
                path={canonicalPath}
                image={seoImage}
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "Organization",
                    name: community.name,
                    description: seoDescription,
                    url: `${SITE_URL}${canonicalPath}`,
                    ...(isAbsoluteHttpUrl(community.logoUrl) ? { logo: community.logoUrl } : {}),
                }}
            />
            <PlaygroundShell {...shellProps}>
                <section className="px-5 pb-16 pt-8">
                    <div className="joy-swap mx-auto max-w-4xl">
                        <Link
                            to={LIVE_ROUTES.communities}
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

                                    <div className="flex flex-wrap items-center gap-3">
                                        {canManageCommunity && (
                                            <PlaygroundButton
                                                to={`/communities/${id}/admin`}
                                                variant="outline"
                                                className="shrink-0 px-3.5 py-2 text-xs"
                                            >
                                                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                                                Manage community
                                            </PlaygroundButton>
                                        )}

                                        {isMember ? (
                                            <div className="flex items-center gap-3 rounded-xl border-2 border-joy-grass/30 bg-joy-grass-bright/8 px-4 py-2.5">
                                                <span className="flex items-center gap-1.5 text-sm font-bold text-joy-grass">
                                                    <Check className="h-4 w-4" aria-hidden="true" />
                                                    You&apos;re in!
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleJoin}
                                                    disabled={joinLoading}
                                                    className="rounded text-xs font-bold text-joy-ink-muted underline hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 disabled:opacity-60"
                                                >
                                                    {joinLoading ? "Leaving…" : "Leave"}
                                                </button>
                                            </div>
                                        ) : (
                                            <PlaygroundButton onClick={handleJoin} className="shrink-0">
                                                {joinLoading ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                        Joining…
                                                    </>
                                                ) : (
                                                    "Join community"
                                                )}
                                            </PlaygroundButton>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ---------------- Description ---------------- */}
                        <div className="mt-8 rounded-2xl border border-joy-ink/8 bg-white p-6 shadow-sm sm:p-8">
                            <p className="joy-mono text-xs font-bold uppercase tracking-wide text-joy-grass">About</p>
                            <RichText
                                content={community.description || community.shortDescription}
                                className="mt-3"
                            />
                        </div>
                    </div>
                </section>
            </PlaygroundShell>
        </div>
    );
}
