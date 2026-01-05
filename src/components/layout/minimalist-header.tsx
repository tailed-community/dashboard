import { Button } from "@/components/ui/button";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import { Menu, Briefcase, Building2, Calendar, Users, Sparkles, ListChecks } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "firebase/auth";
import { studentAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

const navigationItems = [
    {
        title: "Jobs",
        href: "/jobs",
        icon: Briefcase,
        description: "Browse opportunities",
        items: [
            {
                title: "All Jobs",
                href: "/jobs",
                description: "Explore all available positions",
                icon: Briefcase,
                authRequired: false,
            },
            {
                title: "My Applications",
                href: "/jobs/applied",
                description: "Track your applications",
                icon: ListChecks,
                authRequired: true,
            },
        ],
    },
    {
        title: "Companies",
        href: "/companies",
        icon: Building2,
        description: "Discover companies",
    },
    {
        title: "Events",
        href: "/events",
        icon: Calendar,
        description: "Upcoming events",
    },
    {
        title: "Community",
        items: [
            {
                title: "Student Community",
                href: "/community",
                description: "Connect with fellow students",
                icon: Users,
                authRequired: false,
            },
            {
                title: "Student Spotlight",
                href: "/spotlight",
                description: "Showcase your projects",
                icon: Sparkles,
                authRequired: false,
            },
        ],
    },
];

export function MinimalistHeader() {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut(studentAuth);
        navigate("/");
    };

    const getUserInitials = () => {
        if (!user?.displayName) return "U";
        return user.displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-card">
            <div className="container flex h-16 max-w-screen-2xl items-center">
                {/* Logo */}
                <Link to="/" className="mr-8 flex items-center space-x-2">
                    <div className="w-8">
                        <AspectRatio ratio={1}>
                            <img
                                src="/tailed-logo.svg"
                                alt="Tail'ed"
                                className="h-full w-full object-contain"
                            />
                        </AspectRatio>
                    </div>
                    <span className="hidden font-semibold sm:inline-block">
                        Tail'ed
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <NavigationMenu className="hidden md:flex">
                    <NavigationMenuList>
                        {navigationItems.map((item) => (
                            <NavigationMenuItem key={item.title}>
                                {item.items ? (
                                    <>
                                        <NavigationMenuTrigger className="h-9 bg-transparent">
                                            {item.title}
                                        </NavigationMenuTrigger>
                                        <NavigationMenuContent>
                                            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2">
                                                {item.items.map((subItem) => (
                                                    <li key={subItem.title}>
                                                        <NavigationMenuLink asChild>
                                                            <Link
                                                                to={subItem.href}
                                                                className={cn(
                                                                    "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                                                    subItem.authRequired &&
                                                                        !user &&
                                                                        "opacity-60"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {subItem.icon && (
                                                                        <subItem.icon className="h-4 w-4" />
                                                                    )}
                                                                    <div className="text-sm font-medium leading-none">
                                                                        {subItem.title}
                                                                    </div>
                                                                </div>
                                                                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                                                    {subItem.description}
                                                                </p>
                                                            </Link>
                                                        </NavigationMenuLink>
                                                    </li>
                                                ))}
                                            </ul>
                                        </NavigationMenuContent>
                                    </>
                                ) : (
                                    <NavigationMenuLink asChild>
                                        <Link
                                            to={item.href}
                                            className={cn(
                                                "group inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                                                location.pathname === item.href &&
                                                    "bg-accent text-accent-foreground"
                                            )}
                                        >
                                            {item.title}
                                        </Link>
                                    </NavigationMenuLink>
                                )}
                            </NavigationMenuItem>
                        ))}
                    </NavigationMenuList>
                </NavigationMenu>

                {/* Right side - Auth */}
                <div className="ml-auto flex items-center gap-2">
                    {user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="relative h-9 w-9 rounded-full"
                                >
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage
                                            src={user.photoURL || undefined}
                                            alt={user.displayName || "User"}
                                        />
                                        <AvatarFallback>
                                            {getUserInitials()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <div className="flex items-center justify-start gap-2 p-2">
                                    <div className="flex flex-col space-y-1 leading-none">
                                        {user.displayName && (
                                            <p className="font-medium">
                                                {user.displayName}
                                            </p>
                                        )}
                                        {user.email && (
                                            <p className="w-[200px] truncate text-sm text-muted-foreground">
                                                {user.email}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to="/dashboard">Dashboard</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to="/account">Account</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleSignOut}>
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button asChild variant="ghost" size="sm" className="rounded-full">
                            <Link to="/sign-in">Sign in</Link>
                        </Button>
                    )}

                    {/* Mobile Menu */}
                    <Sheet>
                        <SheetTrigger asChild className="md:hidden">
                            <Button variant="ghost" size="icon">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                            <SheetHeader>
                                <SheetTitle>Menu</SheetTitle>
                            </SheetHeader>
                            <nav className="flex flex-col gap-4 mt-6">
                                {navigationItems.map((item) => (
                                    <div key={item.title}>
                                        {item.items ? (
                                            <div className="space-y-2">
                                                <h3 className="font-medium text-sm text-muted-foreground px-2">
                                                    {item.title}
                                                </h3>
                                                {item.items.map((subItem) => (
                                                    <Link
                                                        key={subItem.title}
                                                        to={subItem.href}
                                                        className={cn(
                                                            "block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                                            location.pathname ===
                                                                subItem.href &&
                                                                "bg-accent text-accent-foreground",
                                                            subItem.authRequired &&
                                                                !user &&
                                                                "opacity-60"
                                                        )}
                                                    >
                                                        {subItem.title}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <Link
                                                to={item.href}
                                                className={cn(
                                                    "block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                                    location.pathname === item.href &&
                                                        "bg-accent text-accent-foreground"
                                                )}
                                            >
                                                {item.title}
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
