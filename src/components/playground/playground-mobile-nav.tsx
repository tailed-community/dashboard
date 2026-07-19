import { Link } from "react-router-dom";
import type { User } from "firebase/auth";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { PlaygroundButton } from "@/components/playground/playground-button";
import type { PlaygroundActiveNav, PlaygroundHeaderCta } from "@/components/playground/playground-header";
import type { PlaygroundRoutes } from "@/components/playground/playground-routes";
import { Bell, Briefcase, Calendar, ClipboardList, FileText, LayoutGrid, LogOut, Menu as MenuIcon, Settings, Sparkles, Users } from "lucide-react";

/**
 * Hamburger -> Sheet mobile nav for the joy header. Below `md` (where the
 * desktop nav links + avatar/sign-in are hidden) this is the only way to
 * reach Jobs/Events/Communities, the header CTA, and auth actions, so it
 * mirrors all three rather than just linking out to the desktop menu.
 */
export function PlaygroundMobileNav({
    routes,
    activeNav,
    variant,
    cta,
    user,
    onLogout,
}: {
    routes: PlaygroundRoutes;
    activeNav: PlaygroundActiveNav;
    variant: "full" | "wordmark";
    cta?: PlaygroundHeaderCta;
    user: User | null;
    onLogout: () => void;
}) {
    const navLinks: { key: Exclude<PlaygroundActiveNav, null>; label: string; to: string; icon: typeof Briefcase }[] = [
        { key: "jobs", label: "Jobs", to: routes.jobs, icon: Briefcase },
        { key: "events", label: "Events", to: routes.events, icon: Calendar },
        { key: "communities", label: "Communities", to: routes.communities, icon: Users },
    ];

    const linkClass = (isActive: boolean) =>
        `flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${
            isActive ? "bg-joy-grass/10 text-joy-grass" : "text-joy-ink-muted hover:bg-joy-ink/5 hover:text-joy-ink"
        }`;

    return (
        <Sheet>
            <SheetTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg p-2 text-joy-ink transition hover:bg-joy-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 md:hidden"
                >
                    <MenuIcon className="h-5 w-5" />
                    <span className="sr-only">Open menu</span>
                </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-4/5 max-w-xs flex-col gap-0 bg-joy-surface p-0 text-joy-ink">
                <SheetHeader className="shrink-0 border-b border-joy-ink/8 px-4 py-3">
                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                    <Link to={routes.home} className="flex items-center">
                        <img
                            src="/Tailed_Community_logo.png"
                            alt="Tail'ed Community logo"
                            className="h-8 w-auto object-contain"
                        />
                    </Link>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-3 py-4">
                    {variant === "full" && (
                        <nav className="flex flex-col gap-1">
                            {navLinks.map((item) => (
                                <SheetClose asChild key={item.to}>
                                    <Link to={item.to} className={linkClass(activeNav === item.key)}>
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </SheetClose>
                            ))}
                            <SheetClose asChild>
                                <Link to={routes.spotlight} className={linkClass(false)}>
                                    <Sparkles className="h-4 w-4" />
                                    Spotlight
                                </Link>
                            </SheetClose>
                        </nav>
                    )}

                    {cta && (
                        <div className="mt-4 border-t border-joy-ink/8 pt-4">
                            <SheetClose asChild>
                                {cta.to !== undefined ? (
                                    <PlaygroundButton to={cta.to} className="w-full">
                                        {cta.label}
                                    </PlaygroundButton>
                                ) : (
                                    <PlaygroundButton onClick={cta.onClick} className="w-full">
                                        {cta.label}
                                    </PlaygroundButton>
                                )}
                            </SheetClose>
                        </div>
                    )}

                    <div className="mt-4 flex flex-col gap-1 border-t border-joy-ink/8 pt-4">
                        {user ? (
                            <>
                                <SheetClose asChild>
                                    <Link to={routes.me} className={linkClass(false)}>
                                        <LayoutGrid className="h-4 w-4" />
                                        Your space
                                    </Link>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Link to={routes.account} className={linkClass(false)}>
                                        <Settings className="h-4 w-4" />
                                        Edit profile
                                    </Link>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Link to={routes.alerts} className={linkClass(false)}>
                                        <Bell className="h-4 w-4" />
                                        My alerts
                                    </Link>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Link to={routes.applications} className={linkClass(false)}>
                                        <FileText className="h-4 w-4" />
                                        My applications
                                    </Link>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Link to={routes.surveyValues} className={linkClass(false)}>
                                        <ClipboardList className="h-4 w-4" />
                                        Workplace values
                                    </Link>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Link to={routes.surveySelfId} className={linkClass(false)}>
                                        <ClipboardList className="h-4 w-4" />
                                        Self-ID
                                    </Link>
                                </SheetClose>
                                <SheetClose asChild>
                                    <button
                                        type="button"
                                        onClick={onLogout}
                                        className="flex items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Log out
                                    </button>
                                </SheetClose>
                            </>
                        ) : (
                            <>
                                <SheetClose asChild>
                                    <Link to={routes.signIn} className={linkClass(false)}>
                                        Sign in
                                    </Link>
                                </SheetClose>
                                <SheetClose asChild>
                                    <Link to={routes.signUp} className={linkClass(false)}>
                                        Sign up
                                    </Link>
                                </SheetClose>
                            </>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
