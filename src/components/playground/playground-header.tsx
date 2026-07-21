import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { PlaygroundButton } from "@/components/playground/playground-button";
import { PreloadLink } from "@/components/preload-link";
import { PlaygroundMobileNav } from "@/components/playground/playground-mobile-nav";
import { ProfileMenu } from "@/components/playground/profile-menu";
import { usePlaygroundRoutes } from "@/components/playground/playground-routes";
import { useAuth } from "@/hooks/use-auth";
import { studentAuth } from "@/lib/auth";

export type PlaygroundActiveNav = "jobs" | "events" | "communities" | null;

export type PlaygroundHeaderCta =
    | { label: string; to: string; onClick?: never }
    | { label: string; onClick: () => void; to?: never };

/**
 * Sticky mint-gradient header shared by every Playground page (design-lab
 * prototypes today, live /jobs /events /communities pages in later phases).
 * Ported faithfully from the near-identical inline headers that used to live
 * in each page — see the Phase B report for the handful of markup
 * inconsistencies between pages that got reconciled into this single version.
 */
export function PlaygroundHeader({
    activeNav = null,
    variant = "full",
    cta,
}: {
    activeNav?: PlaygroundActiveNav;
    /** "full" shows the Jobs/Events/Communities/Spotlight nav (all 7 current pages use this). "wordmark" hides it, for future live-route headers that don't want the nav. */
    variant?: "full" | "wordmark";
    cta?: PlaygroundHeaderCta;
}) {
    const routes = usePlaygroundRoutes();
    const { user, loading, likelySignedIn } = useAuth();
    const navigate = useNavigate();
    // While auth is still resolving (hard reload), avoid flashing "Sign in"
    // for a visitor who was signed in last we knew — show a neutral
    // skeleton instead. Once loading is false, `user` is authoritative.
    const showSignedInShell = loading ? likelySignedIn : !!user;

    const navLinks: { key: Exclude<PlaygroundActiveNav, null>; label: string; to: string }[] = [
        { key: "jobs", label: "Jobs", to: routes.jobs },
        { key: "events", label: "Events", to: routes.events },
        { key: "communities", label: "Communities", to: routes.communities },
    ];

    // Same logout call/redirect as the old header's `Header` component.
    const handleLogout = async () => {
        try {
            await signOut(studentAuth);
            navigate(routes.home);
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    return (
        <header className="sticky top-0 z-40 bg-gradient-to-b from-joy-mint/95 via-joy-surface/92 to-joy-surface/75 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
                <Link
                    to={routes.home}
                    className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                >
                    <img
                        src="/tailed-community-logo.png"
                        alt="Tail'ed Community logo"
                        className="h-auto w-[101px] object-contain sm:w-[113px]"
                    />
                </Link>

                {variant === "full" && (
                    <nav className="hidden items-center gap-1 md:flex">
                        {navLinks.map((item) => {
                            const isActive = activeNav === item.key;
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`rounded-lg px-3.5 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 ${
                                        isActive
                                            ? "font-extrabold text-joy-grass underline decoration-2 underline-offset-4"
                                            : "font-bold text-joy-ink-muted hover:bg-joy-ink/5 hover:text-joy-ink"
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                        <PreloadLink
                            to={routes.spotlight}
                            className="rounded-lg px-3.5 py-2 text-sm font-bold text-joy-ink-muted transition hover:bg-joy-ink/5 hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60"
                        >
                            Spotlight
                        </PreloadLink>
                    </nav>
                )}

                <div className="flex items-center gap-3">
                    {user ? (
                        <ProfileMenu user={user} onLogout={handleLogout} />
                    ) : showSignedInShell ? (
                        <div
                            className="hidden h-8 w-8 animate-pulse rounded-full bg-joy-ink/10 sm:inline-block"
                            aria-hidden="true"
                        />
                    ) : (
                        <Link
                            to={routes.signIn}
                            className="hidden rounded text-sm font-bold text-joy-ink-muted hover:text-joy-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 sm:inline-block"
                        >
                            Sign in
                        </Link>
                    )}
                    {cta &&
                        (cta.to !== undefined ? (
                            <PlaygroundButton to={cta.to} className="!px-4 !py-2 !text-xs">
                                {cta.label}
                            </PlaygroundButton>
                        ) : (
                            <PlaygroundButton onClick={cta.onClick} className="!px-4 !py-2 !text-xs">
                                {cta.label}
                            </PlaygroundButton>
                        ))}
                    <PlaygroundMobileNav
                        routes={routes}
                        activeNav={activeNav}
                        variant={variant}
                        cta={cta}
                        user={user}
                        showSignedInShell={showSignedInShell}
                        onLogout={handleLogout}
                    />
                </div>
            </div>
        </header>
    );
}
