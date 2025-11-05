import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, Menu as MenuIcon } from "lucide-react";
import * as React from "react";
import { useEffect, type JSX } from "react";
import {
    FaCalendarAlt,
    FaChartPie,
    FaCrown,
    FaEnvelope,
    FaGithub,
    FaLinkedin,
    FaTrophy,
} from "react-icons/fa";
import { FaLaptopCode } from "react-icons/fa6";
import { SiDevpost } from "react-icons/si";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

type NavItem =
    | { type: "link"; labelKey: string; href: string }
    | {
          type: "menu";
          labelKey: string;
          items: JSX.Element;
      };

const Product = ({
    variant = "desktop",
}: {
    variant?: "desktop" | "mobile";
}) => {
    const features: Array<{
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

    const hexToRgba = (hex: string, alpha: number) => {
        const clean = hex.replace("#", "");
        const bigint = parseInt(clean, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const flatFeatures = features.flatMap((group) =>
        group.items.map((item) => ({ ...item, color: group.color }))
    );

    if (variant === "mobile") {
        return (
            <div className="w-full">
                <div>
                    <div className="flex flex-col space-2">
                        {flatFeatures.map((f, idx) => {
                            const chipStyle = {
                                color: hexToRgba(f.color, 0.75),
                            };
                            return (
                                <a
                                    key={idx}
                                    href={f.href}
                                    className="block rounded-xl px-3 py-2 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
                                >
                                    <div className="flex items-start gap-2">
                                        <div
                                            className="h-7 w-7 shrink-0 grid place-items-center text-base"
                                            style={chipStyle}
                                            aria-hidden
                                        >
                                            {f.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-foreground truncate">
                                                {f.labelKey}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {f.descKey}
                                            </p>
                                        </div>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>
                <a
                    href="/catalog"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:no-underline"
                >
                    Explore all features <span aria-hidden>→</span>
                </a>
            </div>
        );
    }

    return (
        <div className="w-full grid grid-cols-3 gap-4">
            <div className="rounded-2xl p-6 col-span-1">
                <div className="text-lg font-bold uppercase tracking-[0.12em] px-3">
                    Tour the Product
                </div>
                <div className="mt-4 relative rounded-xl border overflow-hidden bg-muted/30">
                    <div
                        className="relative w-full h-0"
                        style={{ paddingBottom: "56.25%" }}
                    >
                        <iframe
                            loading="lazy"
                            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                            src="https://app.storylane.io/demo/u6bctms0ljyy?autoplay=1&muted=1"
                            name="sl-embed-mini"
                            title="interactive_product_demo"
                            referrerPolicy="no-referrer"
                        />
                    </div>
                    <a
                        href="/#product-tour"
                        aria-label="cta_open_interactive_tour"
                        className="absolute inset-0 focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
                    />
                </div>

                <a
                    href="/#product-tour"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:no-underline"
                >
                    View product tour <span aria-hidden>→</span>
                </a>
            </div>

            <div className="rounded-2xl p-6 col-span-2">
                <div className="text-lg font-bold uppercase tracking-[0.12em] px-3">
                    Features
                </div>

                <div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {flatFeatures.map((f, idx) => {
                            const chipStyle = {
                                color: hexToRgba(f.color, 0.75),
                            };

                            return (
                                <a
                                    key={idx}
                                    href={f.href}
                                    className="block rounded-xl px-4 py-3 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring ring-offset-background"
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="h-8 w-8 shrink-0 grid place-items-center text-base"
                                            style={chipStyle}
                                            aria-hidden
                                        >
                                            {f.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-foreground truncate">
                                                {f.labelKey}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {f.descKey}
                                            </p>
                                        </div>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>

                <a
                    href="/catalog"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:no-underline"
                >
                    Explore all features <span aria-hidden>→</span>
                </a>
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
    { type: "menu", labelKey: "Product", items: <Product /> },
    { type: "menu", labelKey: "Solutions", items: <Solutions /> },
    { type: "menu", labelKey: "Resources", items: <Resources /> },
];

function Logo() {
    return (
        <Link className="flex items-center justify-center" to="/">
            <div className="flex items-center h-16 w-40">
                <AspectRatio ratio={3042 / 968}>
                    <img
                        src="/tailed-logo-fixed-shadow.svg"
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

export function Header() {
    const [openMenu, setOpenMenu] = React.useState<string | null>(null);
    const [isOverNav, setIsOverNav] = React.useState(false);
    const [isOverPanel, setIsOverPanel] = React.useState(false);
    const { user } = useAuth();

    useEffect(() => {
        if (!openMenu) return;
        if (isOverNav || isOverPanel) return;
        setOpenMenu(null);
    }, [isOverNav, isOverPanel, openMenu]);

    return (
        <header className="relative z-50 w-full my-2">
            <div className=" mx-auto max-w-[1536px]">
                <nav
                    className={cn(
                        "relative flex flex-col items-center justify-between p-2 sm:p-4 z-50",
                        openMenu ? "bg-white rounded-t-4xl" : ""
                    )}
                    onMouseEnter={() => setIsOverNav(true)}
                    onMouseLeave={() => setIsOverNav(false)}
                >
                    <div className="flex w-full z-50">
                        <div className="flex flex-1 min-w-0 items-center gap-8">
                            <Logo />
                            <ul className="hidden nav:flex items-center gap-1">
                                {navItems.map((item, idx) =>
                                    item.type === "link" ? (
                                        <li key={idx}>
                                            <NavLink href={item.href}>
                                                {item.labelKey}
                                            </NavLink>
                                        </li>
                                    ) : (
                                        <li
                                            key={idx}
                                            onMouseEnter={() =>
                                                setOpenMenu(item.labelKey)
                                            }
                                        >
                                            <div
                                                data-slot="accordion-trigger"
                                                aria-expanded={
                                                    openMenu === item.labelKey
                                                }
                                                aria-haspopup="true"
                                                onFocus={() =>
                                                    setOpenMenu(item.labelKey)
                                                }
                                                className={cn(
                                                    "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 hover:[&>svg]:rotate-180",
                                                    "px-3 py-2 text-sm outline-none",
                                                    openMenu === item.labelKey
                                                        ? " bg-[#FFD37D] rounded-lg"
                                                        : ""
                                                )}
                                            >
                                                {item.labelKey}
                                                <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
                                            </div>
                                        </li>
                                    )
                                )}
                            </ul>
                        </div>

                        <div className="flex items-center gap-3">
                            <a
                                href="https://github.com/tailed-community/dashboard"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden nav:inline-flex items-center gap-2 text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
                                aria-label="GitHub repository"
                            >
                                <FaGithub className="h-4 w-4" /> GitHub
                            </a>
                            <div className="h-6 w-2 text-black hidden nav:block">
                                <Separator
                                    orientation="vertical"
                                    className="bg-gray-700"
                                />
                            </div>
                            {user ? (
                                <a
                                    href="/dashboard"
                                    className="hidden nav:inline-block text-sm rounded-lg px-4 py-3 hover:bg-[#f8d1b1]"
                                >
                                    Go To Dashboard
                                </a>
                            ) : (
                                <a
                                    href="/sign-in"
                                    className="hidden nav:inline-block text-sm rounded-lg px-4 py-3 hover:bg-[#f8d1b1]"
                                >
                                    Log in
                                </a>
                            )}

                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="nav:hidden"
                                    >
                                        <MenuIcon className="h-5 w-5" />
                                        <span className="sr-only">
                                            open_menu
                                        </span>
                                    </Button>
                                </SheetTrigger>
                                <SheetContent
                                    side="left"
                                    className="p-0 flex flex-col"
                                >
                                    <SheetHeader className="px-4 py-3 shrink-0">
                                        <SheetTitle className="sr-only">
                                            main_navigation
                                        </SheetTitle>
                                        <div className="flex items-center">
                                            <Logo />
                                        </div>
                                    </SheetHeader>
                                    <div className="px-4 pb-6 overflow-y-auto flex-1">
                                        <Accordion
                                            type="single"
                                            collapsible
                                            className="w-full"
                                        >
                                            {navItems.map((item, idx) =>
                                                item.type === "link" ? (
                                                    <a
                                                        key={idx}
                                                        href={item.href}
                                                        className="block py-3 text-base rounded-lg hover:bg-muted/60"
                                                    >
                                                        {item.labelKey}
                                                    </a>
                                                ) : (
                                                    <AccordionItem
                                                        key={idx}
                                                        value={item.labelKey}
                                                    >
                                                        <AccordionTrigger className="py-3 text-base">
                                                            {item.labelKey}
                                                        </AccordionTrigger>
                                                        <AccordionContent className="pb-4">
                                                            {item.labelKey ===
                                                            "Product" ? (
                                                                <Product variant="mobile" />
                                                            ) : (
                                                                item.items
                                                            )}
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                )
                                            )}
                                        </Accordion>
                                        <div className="mt-6 space-y-2">
                                            <a
                                                href="https://github.com/tailed-community/dashboard"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block w-full text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <FaGithub className="h-4 w-4" />{" "}
                                                    GitHub
                                                </span>
                                            </a>
                                            {user ? (
                                                <a
                                                    href="/dashboard"
                                                    className="block text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
                                                >
                                                    Go To Dashboard
                                                </a>
                                            ) : (
                                                <a
                                                    href="/sign-in"
                                                    className="block text-sm rounded-lg px-4 py-3 hover:bg-muted/60"
                                                >
                                                    Log in
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                </nav>

                <div className="absolute left-0 right-0 top-full z-40">
                    {openMenu && (
                        <div
                            className="relative mx-auto bg-white max-w-[1536px] pt-4 px-1 sm:px-2 md:px-0 rounded-b-4xl shadow-[0_50px_150px_-25px_rgba(0,0,0,0.85)]"
                            onMouseEnter={() => setIsOverPanel(true)}
                            onMouseLeave={() => setIsOverPanel(false)}
                        >
                            {openMenu &&
                                (() => {
                                    const active =
                                        navItems.find(
                                            (
                                                it
                                            ): it is Extract<
                                                NavItem,
                                                { type: "menu" }
                                            > =>
                                                it.type === "menu" &&
                                                it.labelKey === openMenu
                                        ) ?? null;
                                    if (!active) return null;
                                    return active.items;
                                })()}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
