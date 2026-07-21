import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
    ChevronDownIcon,
    Menu as MenuIcon,
    Briefcase,
    BookOpen,
    Users,
    Sparkles,
    LogOut,
    Settings,
    FileText,
    Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FaCalendarAlt, FaGithub } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "firebase/auth";
import { studentAuth } from "@/lib/auth";

/** Primary nav links shown in the sticky header, both logged in and out. */
const NAV_LINKS: Array<{ label: string; href: string }> = [
    { label: "Jobs", href: "/jobs" },
    { label: "Events", href: "/events" },
    { label: "Communities", href: "/communities" },
    { label: "Spotlight", href: "/spotlight" },
];

function Logo() {
    return (
        <Link className="flex items-center justify-center" to="/">
            <div className="flex items-center h-16 w-40">
                <AspectRatio ratio={3042 / 968}>
                    <img
                        src="/tailed-community-logo.png"
                        alt="Tail'ed Community logo"
                        className="object-contain h-full w-full"
                    />
                </AspectRatio>
            </div>
        </Link>
    );
}

function DesktopNav() {
    return (
        <nav className="hidden nav:flex items-center gap-6 ml-4">
            {NAV_LINKS.map((item) => (
                <Link
                    key={item.href}
                    to={item.href}
                    className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 rounded-sm"
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}

function UserAvatarMenu({ user, onLogout }: { user: any; onLogout: () => void }) {
    // Extract user info with fallbacks
    const displayName = user.displayName || user.email?.split("@")[0] || "User";
    const firstName = user.firstName || displayName.split(" ")[0] || "";
    const lastName = user.lastName || displayName.split(" ")[1] || "";
    const initials =
        user.initials ||
        (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() ||
        displayName.charAt(0).toUpperCase();
    const photoURL = user.photoURL || user.avatar || "";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="hidden nav:inline-flex items-center gap-2 text-sm rounded-lg px-2 py-2 hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={photoURL} alt={displayName} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{displayName}</p>
                        <p className="text-xs text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                        <a href="/account" className="cursor-pointer">
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Profile</span>
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a href="/jobs/applied" className="cursor-pointer">
                            <FileText className="mr-2 h-4 w-4" />
                            <span>My Applications</span>
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a href="/account/alerts" className="cursor-pointer">
                            <Bell className="mr-2 h-4 w-4" />
                            <span>My alerts</span>
                        </a>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={onLogout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Shared mobile-sheet nav links, rendered for both auth states. */
function MobileNavLinks() {
    return (
        <>
            <Link
                to="/jobs"
                className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
            >
                <span className="inline-flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Jobs
                </span>
            </Link>
            <Link
                to="/companies"
                className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
            >
                <span className="inline-flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Companies
                </span>
            </Link>
            <Link
                to="/events"
                className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
            >
                <span className="inline-flex items-center gap-2">
                    <FaCalendarAlt className="h-4 w-4" />
                    Events
                </span>
            </Link>
            <Link
                to="/communities"
                className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
            >
                <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Student communities
                </span>
            </Link>
            <Link
                to="/spotlight"
                className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
            >
                <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Student Spotlights
                </span>
            </Link>
        </>
    );
}

export function Header() {
    const { user, loading, likelySignedIn } = useAuth();
    const navigate = useNavigate();
    // While auth is still resolving (hard reload), avoid flashing the
    // signed-out "Sign in / Join free" buttons for a visitor who was signed
    // in last we knew. Once loading is false, `user` is authoritative.
    const showSignedInShell = loading ? likelySignedIn : !!user;
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(studentAuth);
            navigate("/");
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    return (
        <header
            className={cn(
                "sticky top-0 z-50 w-full bg-brand-cream/95 dark:bg-brand-cream-950/95 backdrop-blur-md px-4 lg:px-6 py-4 flex items-center justify-between transition-all duration-200 border-b",
                scrolled
                    ? "border-brand-cream-200/70 dark:border-brand-cream-800/70 shadow-sm"
                    : "border-transparent",
            )}
        >
            <div className="flex items-center gap-6">
                <Link className="flex items-center gap-2 group" to="/">
                    <div className="flex items-center h-16 w-40">
                        <AspectRatio ratio={3042 / 968}>
                            <img
                                src="/tailed-community-logo.png"
                                alt="Tail'ed Community logo"
                                className="object-contain h-full w-full"
                            />
                        </AspectRatio>
                    </div>
                </Link>
                <DesktopNav />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
                {!user && showSignedInShell ? (
                    <div
                        className="hidden nav:inline-flex h-8 w-8 animate-pulse rounded-full bg-brand-cream-200/70 dark:bg-brand-cream-800/70"
                        aria-hidden="true"
                    />
                ) : user ? (
                    <>
                        <UserAvatarMenu user={user} onLogout={handleLogout} />
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="nav:hidden"
                                >
                                    <MenuIcon className="h-5 w-5" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="p-0 flex flex-col"
                            >
                                <SheetHeader className="px-4 py-3 shrink-0">
                                    <SheetTitle className="sr-only">
                                        Navigation
                                    </SheetTitle>
                                    <div className="flex items-center">
                                        <Logo />
                                    </div>
                                </SheetHeader>
                                <div className="px-4 pb-6 overflow-y-auto flex-1">
                                    <div className="space-y-2">
                                        <MobileNavLinks />
                                        <Link
                                            to="/jobs/applied"
                                            className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <FileText className="h-4 w-4" />
                                                My Applications
                                            </span>
                                        </Link>
                                        <Link
                                            to="/account/alerts"
                                            className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <Bell className="h-4 w-4" />
                                                My alerts
                                            </span>
                                        </Link>
                                        <Link
                                            to="/account"
                                            className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <Settings className="h-4 w-4" />
                                                Account Settings
                                            </span>
                                        </Link>
                                        <button
                                            onClick={handleLogout}
                                            className="block w-full text-sm rounded-lg px-4 py-3 bg-destructive text-destructive-foreground font-medium text-center hover:bg-destructive/90"
                                        >
                                            <span className="inline-flex items-center gap-2 justify-center">
                                                <LogOut className="h-4 w-4" />
                                                Log Out
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </>
                ) : (
                    <>
                        <Link
                            to="/sign-in"
                            className="hidden sm:inline-flex px-4 py-2.5 rounded-full text-brand-cream-700 dark:text-brand-cream-300 text-sm font-medium hover:text-brand-cream-950 dark:hover:text-brand-cream-50 hover:bg-brand-cream-100/70 dark:hover:bg-brand-cream-900/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
                        >
                            Sign in
                        </Link>
                        <Link
                            to="/sign-up"
                            className="px-5 py-2.5 rounded-full bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange/90 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-2"
                        >
                            Join free
                        </Link>
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="nav:hidden"
                                >
                                    <MenuIcon className="h-5 w-5" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent
                                side="left"
                                className="p-0 flex flex-col"
                            >
                                <SheetHeader className="px-4 py-3 shrink-0">
                                    <SheetTitle className="sr-only">
                                        Navigation
                                    </SheetTitle>
                                    <div className="flex items-center">
                                        <Logo />
                                    </div>
                                </SheetHeader>
                                <div className="px-4 pb-6 overflow-y-auto flex-1">
                                    <div className="space-y-2">
                                        <Link
                                            to="/sign-up"
                                            className="block text-sm rounded-lg px-4 py-3 bg-brand-orange text-white font-semibold text-center hover:bg-brand-orange/90 transition-all"
                                        >
                                            Join free
                                        </Link>
                                        <Link
                                            to="/sign-in"
                                            className="block w-full text-sm rounded-lg px-4 py-3 text-center border border-brand-cream-200 dark:border-brand-cream-800 hover:bg-muted/60"
                                        >
                                            Sign in
                                        </Link>
                                        <MobileNavLinks />
                                        <a
                                            href="https://github.com/tailed-community/dashboard"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <FaGithub className="h-4 w-4" />
                                                GitHub
                                            </span>
                                        </a>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </>
                )}
            </div>
        </header>
    );
}
