import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Separator } from "@/components/ui/separator";
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
    Code2,
    Rocket,
    BookOpen,
    Users,
    Sparkles,
    LayoutDashboard,
    LogOut,
    Settings,
    FileText
} from "lucide-react";
import * as React from "react";
import { useEffect, type JSX } from "react";
import { FaCalendarAlt, FaChartPie, FaCrown, FaEnvelope, FaGithub, FaLaptopCode, FaLinkedin, FaTrophy } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { signOut } from "firebase/auth";
import { studentAuth } from "@/lib/auth";
import { SiDevpost } from "react-icons/si";

type NavItem =
    | { type: "link"; labelKey: string; href: string }
    | {
          type: "menu";
          labelKey: string;
          items: JSX.Element;
      };

const Community = ({
    variant = "desktop",
}: {
    variant?: "desktop" | "mobile";
}) => {
    const items = [
        {
            icon: <Briefcase className="h-6 w-6" />,
            labelKey: "Browse Jobs",
            descKey: "Discover internships and new grad positions from top companies",
            href: "/jobs",
        },
        {
            icon: <Code2 className="h-6 w-6" />,
            labelKey: "Student Community",
            descKey: "Connect with fellow students and join the community",
            href: "/community",
        },
        {
            icon: <Sparkles className="h-6 w-6" />,
            labelKey: "Student Spotlight",
            descKey: "Showcase your projects and get recognized for your work",
            href: "/spotlight",
        },
        {
            icon: <Users className="h-6 w-6" />,
            labelKey: "GitHub Community",
            descKey: "Explore open source projects and contribute",
            href: "https://github.com/tailed-community",
        },
    ];

    const _features: Array<{
        color: string;
        items: Array<{
            icon: JSX.Element;
            labelKey: string;
            descKey: string;
            href: string;
        }>;
    }> = [
        {
            color: "FFD37D",
            items: [
                {
                    icon: <FaCrown className="h-6 w-6" />,
                    labelKey: "Automatic Ranking",
                    descKey: "Fast, AI-Powered Candidate Ranking System",
                    href: "/catalog",
                },
                {
                    icon: <FaTrophy className="h-6 w-6" />,
                    labelKey: "Hackathon Achievements",
                    descKey: "Identify people who can thrive in the real world",
                    href: "/catalog",
                },
                {
                    icon: <FaEnvelope className="h-6 w-6" />,
                    labelKey: "Cover Letter",
                    descKey: "Assess seriousness via the required cover letter",
                    href: "/catalog",
                },
            ],
        },
        {
            color: "A2BFE4",
            items: [
                {
                    icon: <FaGithub className="h-6 w-6" />,
                    labelKey: "Contribution Tracking",
                    descKey: "Track GitHub Activity with Ease",
                    href: "/catalog",
                },
                {
                    icon: <FaCalendarAlt className="h-6 w-6" />,
                    labelKey: "Activity days",
                    descKey: "Assess the candidate’s persistence",
                    href: "/catalog",
                },
                {
                    icon: <FaLinkedin className="h-6 w-6" />,
                    labelKey: "LinkedIn",
                    descKey: "Check personality via LinkedIn post",
                    href: "/catalog",
                },
            ],
        },
        {
            color: "EA7A26",
            items: [
                {
                    icon: <FaChartPie className="h-6 w-6" />,
                    labelKey: "Analyze",
                    descKey: "Candidate information at a glance",
                    href: "/catalog",
                },
                {
                    icon: <SiDevpost className="h-6 w-6" />,
                    labelKey: "Devpost",
                    descKey: "One click reveals what the candidate can create",
                    href: "/catalog",
                },
                {
                    icon: <FaLaptopCode className="h-6 w-6" />,
                    labelKey: "Languages",
                    descKey:
                        "Visualization of candidates' language proficiencies",
                    href: "/catalog",
                },
            ],
        },
    ];

    if (variant === "mobile") {
        return (
            <div className="w-full space-y-2">
                {items.map((item, idx) => (
                    <a
                        key={idx}
                        href={item.href}
                        className="block rounded-xl px-3 py-2 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
                    >
                        <div className="flex items-start gap-2">
                            <div className="h-7 w-7 shrink-0 grid place-items-center text-primary">
                                {item.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground">
                                    {item.labelKey}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {item.descKey}
                                </p>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        );
    }

    return (
        <div className="w-full p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((item, idx) => (
                    <a
                        key={idx}
                        href={item.href}
                        className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
                    >
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 shrink-0 grid place-items-center text-primary">
                                {item.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground">
                                    {item.labelKey}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {item.descKey}
                                </p>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

const Opportunities = ({
    variant = "desktop",
}: {
    variant?: "desktop" | "mobile";
}) => {
    const items = [
        {
            icon: <Briefcase className="h-6 w-6" />,
            labelKey: "All Jobs",
            descKey: "Browse all available internships and full-time positions",
            href: "/jobs",
        },
        {
            icon: <BookOpen className="h-6 w-6" />,
            labelKey: "Companies",
            descKey: "Discover companies and learn about their culture",
            href: "/companies",
        },
        {
            icon: <FaCalendarAlt className="h-6 w-6" />,
            labelKey: "Events",
            descKey: "Stay updated with hackathons, career fairs, and workshops",
            href: "/events",
        },
        {
            icon: <Rocket className="h-6 w-6" />,
            labelKey: "Featured Opportunities",
            descKey: "Curated positions from top employers",
            href: "/",
        },
    ];

    if (variant === "mobile") {
        return (
            <div className="w-full space-y-2">
                {items.map((item, idx) => (
                    <a
                        key={idx}
                        href={item.href}
                        className="block rounded-xl px-3 py-2 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
                    >
                        <div className="flex items-start gap-2">
                            <div className="h-7 w-7 shrink-0 grid place-items-center text-primary">
                                {item.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground">
                                    {item.labelKey}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {item.descKey}
                                </p>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        );
    }

    return (
        <div className="w-full p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((item, idx) => (
                    <a
                        key={idx}
                        href={item.href}
                        className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
                    >
                        <div className="flex items-start gap-3">
                            <div className="h-8 w-8 shrink-0 grid place-items-center text-primary">
                                {item.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground">
                                    {item.labelKey}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {item.descKey}
                                </p>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

const Solutions = () => {
    return (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl p-6">
                <div className="text-lg font-bold uppercase tracking-[0.12em] px-3">
                    Industries
                </div>
                <div className="space-y-2">
                    <a
                        href="/pricing"
                        className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <div className="text-sm font-medium text-foreground">
                            For Startups
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Achieving efficient hiring with a lean team
                        </p>
                    </a>
                    <a
                        href="/pricing"
                        className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <div className="text-sm font-medium text-foreground">
                            For medium-sized companies
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Share and manage on one platform
                        </p>
                    </a>
                    <a
                        href="/pricing"
                        className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <div className="text-sm font-medium text-foreground">
                            For large companies
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Efficiently screen large volumes of resumes
                        </p>
                    </a>
                </div>
            </div>

            <div className="rounded-2xl p-6">
                <div className="text-lg font-bold uppercase tracking-[0.12em] px-3">
                    Customer Testimonials
                </div>
                <div className="space-y-2">
                    <a
                        href="/blog/lovable-case-study"
                        className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                            <img
                                src="/clients/lovable-logo.svg"
                                alt="Lovable"
                                className="h-6 w-auto"
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Cut through the noise with Tail'ed
                        </p>
                    </a>
                </div>
                <a
                    href="/blog"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:no-underline"
                >
                    Explore all testimonials <span aria-hidden>→</span>
                </a>
            </div>

            <div className="rounded-2xl p-6">
                <AspectRatio ratio={16 / 9}>
                    <iframe
                        className="h-full w-full rounded-2xl"
                        src="https://www.youtube.com/embed/PotkKWGF8FE"
                        title="customer_case_study_video"
                        frameBorder={0}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                </AspectRatio>
            </div>
        </div>
    );
};

const Resources = () => {
    return (
        <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl p-6 lg:col-span-2">
                <div className="text-lg font-bold uppercase tracking-[0.12em] px-3">
                    Our company
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-2">
                        <a
                            href="/origin"
                            className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <div className="text-sm font-medium text-foreground">
                                Origin
                            </div>
                            <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                Where Franck's vision met purpose — Tail'ed was
                                born to redefine hiring.
                            </p>
                        </a>
                        <a
                            href="/mission-value"
                            className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <div className="text-sm font-medium text-foreground">
                                Mission, vision, values
                            </div>
                            <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                Learn about our mission, vision and values
                            </p>
                        </a>
                        <a
                            href="/team"
                            className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <div className="text-sm font-medium text-foreground">
                                Our Team
                            </div>
                            <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                Meet our team
                            </p>
                        </a>
                    </div>

                    <div className="space-y-2">
                        <a
                            href="/careers"
                            className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <div className="text-sm font-medium text-foreground">
                                Careers
                            </div>
                            <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                Click here for available positions
                            </p>
                        </a>
                        <a
                            href="/sustainability"
                            className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <div className="text-sm font-medium text-foreground">
                                Sustainability
                            </div>
                            <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                Introducing Tail'ed's sustainability initiatives
                            </p>
                        </a>
                        <a
                            href="/contact"
                            className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <div className="text-sm font-medium text-foreground">
                                Contact
                            </div>
                            <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                                Contact us
                            </p>
                        </a>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl p-6">
                <div className="text-lg font-bold uppercase tracking-[0.12em] px-3">
                    Download
                </div>
                <a
                    href="/catalog"
                    className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <div className="text-sm font-medium text-foreground">
                        Product Catalog
                    </div>
                    <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                        Our product description catalogue
                    </p>
                </a>
                <a
                    href="/metric-benchmark"
                    className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <div className="text-sm font-medium text-foreground">
                        Metrics Benchmark
                    </div>
                    <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                        Criteria to help you recruit candidates
                    </p>
                </a>

                <div className="text-lg font-bold uppercase tracking-[0.12em] mt-6 px-3">
                    MEDIA ROOM
                </div>
                <a
                    href="/blog"
                    className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <img
                        src="/fox-news-logo.svg"
                        alt="Fox News"
                        className="h-12 w-auto"
                    />
                    <p className="text-sm text-muted-foreground">
                        Providing the latest information for the HR industry,
                        tech industry, and tech students
                    </p>
                </a>
                <a
                    href="/press-release"
                    className="block rounded-xl px-3 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <div className="text-sm font-medium text-foreground">
                        Press Release
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Published articles for the media
                    </p>
                </a>
            </div>

            <div className="rounded-2xl p-6">
                <div className="text-lg font-bold uppercase tracking-[0.12em] px-3">
                    FOX ROOM
                </div>
                <a
                    href="/fox-profile"
                    className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <div className="text-sm font-medium text-foreground">
                        Profile
                    </div>
                    <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                        Learn about our mascot
                    </p>
                </a>
                <a
                    href="/fox-comics"
                    className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <div className="text-sm font-medium text-foreground">
                        Comics
                    </div>
                    <p className="text-sm leading-5 text-muted-foreground min-h-[2.5rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                        Read Fox Comics
                    </p>
                </a>
                <a
                    href="/fox-shop"
                    className="block rounded-xl px-4 pt-3 overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <div className="text-sm font-medium text-foreground">
                        Fox Shop
                    </div>
                    <img
                        src="/fox-shop.png"
                        alt="Fox Shop"
                        className="object-cover w-full h-32 rounded-lg "
                    />
                </a>
                <span className="px-4 text-xs text-muted-foreground">
                    Tail'ed original merchandise now available
                </span>
            </div>
        </div>
    );
};

const navItems: NavItem[] = [
    { type: "link", labelKey: "Discover Jobs", href: "/jobs" },
    { type: "link", labelKey: "Discover Companies", href: "/companies" },
    { type: "link", labelKey: "Events", href: "/events" },
    { type: "link", labelKey: "Student communities", href: "/community" },
    { type: "link", labelKey: "Student Spotlights", href: "/spotlight" },
];

function Logo() {
    return (
        <Link className="flex items-center justify-center" to="/">
            <div className="flex items-center h-16 w-40">
                <AspectRatio ratio={3042 / 968}>
                    <img
                        src="/Tailed_Community_logo.png"
                        alt="Logo"
                        className="object-contain h-full w-full"
                    />
                </AspectRatio>
            </div>
        </Link>
    );
}

function NavLink({
    href,
    children,
}: React.PropsWithChildren<{ href: string }>) {
    return (
        <a
            href={href}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
            {children}
        </a>
    );
}

function UserAvatarMenu({ user }: { user: any }) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(studentAuth);
            navigate("/");
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    // Extract user info with fallbacks
    const displayName = user.displayName || user.email?.split('@')[0] || 'User';
    const firstName = user.firstName || displayName.split(' ')[0] || '';
    const lastName = user.lastName || displayName.split(' ')[1] || '';
    const initials = user.initials || 
        (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 
        displayName.charAt(0).toUpperCase();
    const photoURL = user.photoURL || user.avatar || '';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="hidden nav:inline-flex items-center gap-2 text-sm rounded-lg px-2 py-2 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary">
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
                        <p className="text-xs text-muted-foreground">{user.email}</p>
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
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function Header() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(studentAuth);
            navigate("/");
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    return (
        <header className="w-full bg-brand-cream/80 dark:bg-brand-cream-950/80 backdrop-blur-md dark:border-brand-cream-800 px-4 lg:px-6 pt-4 flex items-center justify-between transition-all">
            <div className="flex items-center gap-6">
                <Link className="flex items-center gap-2 group" to="/">
                    <div className="flex items-center h-16 w-40">
                        <AspectRatio ratio={3042 / 968}>
                            <img
                                src="/Tailed_Community_logo.png"
                                alt="Logo"
                                className="object-contain h-full w-full"
                            />
                        </AspectRatio>
                    </div>
                </Link>
                <nav className="hidden md:flex items-center gap-6 ml-4">
                    <Link to="/explore" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">Explore</Link>
                    { user ?
                        <>
                            <Link to="/jobs" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">Jobs</Link>
                            <Link to="/events" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">Events</Link>
                            <Link to="/communities" className="text-sm font-medium text-brand-cream-600 hover:text-brand-cream-900 dark:text-brand-cream-400 dark:hover:text-brand-cream-50 transition-colors">Communities</Link>
                        </> : <></>
                    }
                </nav>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
                {user ? (
                    <>
                        <UserAvatarMenu user={user} />
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden"
                                >
                                    <MenuIcon className="h-5 w-5" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 flex flex-col">
                                <SheetHeader className="px-4 py-3 shrink-0">
                                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                                    <div className="flex items-center">
                                        <Logo />
                                    </div>
                                </SheetHeader>
                                <div className="px-4 pb-6 overflow-y-auto flex-1">
                                    <div className="space-y-2">
                                        <Link to="/jobs" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <Briefcase className="h-4 w-4" />
                                                Jobs
                                            </span>
                                        </Link>
                                        <Link to="/companies" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <BookOpen className="h-4 w-4" />
                                                Companies
                                            </span>
                                        </Link>
                                        <Link to="/events" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <FaCalendarAlt className="h-4 w-4" />
                                                Events
                                            </span>
                                        </Link>
                                        <Link to="/community" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <Users className="h-4 w-4" />
                                                Student communities
                                            </span>
                                        </Link>
                                        <Link to="/spotlight" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <Sparkles className="h-4 w-4" />
                                                Student Spotlights
                                            </span>
                                        </Link>
                                        <Link to="/jobs/applied" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <FileText className="h-4 w-4" />
                                                My Applications
                                            </span>
                                        </Link>
                                        <Link to="/account" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
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
                        <Link className="px-5 py-2.5 rounded-full bg-brand-cream-100 text-brand-cream-900 text-sm font-semibold hover:bg-brand-cream-200 dark:bg-brand-cream-800 dark:text-brand-cream-50 dark:hover:bg-brand-cream-700 transition-all" to="/sign-in">Sign in</Link>
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden"
                                >
                                    <MenuIcon className="h-5 w-5" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="p-0 flex flex-col">
                                <SheetHeader className="px-4 py-3 shrink-0">
                                    <SheetTitle className="sr-only">Navigation</SheetTitle>
                                    <div className="flex items-center">
                                        <Logo />
                                    </div>
                                </SheetHeader>
                                <div className="px-4 pb-6 overflow-y-auto flex-1">
                                    <div className="space-y-2">
                                        <Link to="/jobs" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <Briefcase className="h-4 w-4" />
                                                Jobs
                                            </span>
                                        </Link>
                                        <Link to="/companies" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <BookOpen className="h-4 w-4" />
                                                Companies
                                            </span>
                                        </Link>
                                        <Link to="/events" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <FaCalendarAlt className="h-4 w-4" />
                                                Events
                                            </span>
                                        </Link>
                                        <Link to="/community" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <Users className="h-4 w-4" />
                                                Student communities
                                            </span>
                                        </Link>
                                        <Link to="/spotlight" className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60">
                                            <span className="inline-flex items-center gap-2">
                                                <Sparkles className="h-4 w-4" />
                                                Student Spotlights
                                            </span>
                                        </Link>
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
                                        <Link to="/sign-in" className="block text-sm rounded-lg px-4 py-3 bg-primary text-primary-foreground font-medium text-center">
                                            Get Started
                                        </Link>
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
