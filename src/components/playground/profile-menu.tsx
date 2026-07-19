import type { User } from "firebase/auth";
import { Link } from "react-router-dom";
import { PreloadLink } from "@/components/preload-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlaygroundRoutes } from "@/components/playground/playground-routes";
import { useProfileSummary } from "@/hooks/use-profile-summary";
import { resolveAvatarUrl } from "@/lib/profile";
import {
    Bell,
    ChevronDown,
    ClipboardList,
    FileText,
    LayoutGrid,
    LogOut,
    Settings,
} from "lucide-react";

/**
 * Compact joy-styled completeness ring — a small inline SVG showing the
 * profile score as an arc with the percentage in the centre. Lightweight, no
 * extra deps.
 */
function CompletenessRing({ score }: { score: number }) {
    const radius = 9;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, score));
    const offset = circumference - (clamped / 100) * circumference;
    return (
        <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center">
            <svg className="h-11 w-11 -rotate-90" viewBox="0 0 24 24">
                <circle
                    cx="12"
                    cy="12"
                    r={radius}
                    fill="none"
                    strokeWidth="2.5"
                    className="stroke-joy-ink/10"
                />
                <circle
                    cx="12"
                    cy="12"
                    r={radius}
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="stroke-joy-grass transition-all duration-500"
                />
            </svg>
            <span className="absolute text-[9px] font-bold text-joy-ink">
                {clamped}%
            </span>
        </div>
    );
}

/**
 * Joy-styled avatar/dropdown for signed-in users — the ambient profile hub.
 *
 * Extracted from the inline `JoyUserMenu` that used to live in
 * `playground-header.tsx`, enriched with a completeness ring, an alert-count
 * badge, and links to the full profile surface. Still a shadcn DropdownMenu,
 * still joy-styled. Sources its own summary (score + alert count + avatar) via
 * `useProfileSummary`, so the header only needs to pass `user` and `onLogout`.
 */
export function ProfileMenu({
    user,
    onLogout,
}: {
    user: User;
    onLogout: () => void;
}) {
    const routes = usePlaygroundRoutes();
    const { score, alertCount, profile, loading } = useProfileSummary();

    const displayName = user.displayName || user.email?.split("@")[0] || "User";
    const email = user.email;
    const initials =
        displayName
            .split(" ")
            .map((part) => part.charAt(0))
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase() || displayName.charAt(0).toUpperCase();
    const photoURL = resolveAvatarUrl(profile, user);

    const itemClass =
        "cursor-pointer focus:bg-joy-grass/10 focus:text-joy-ink";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="hidden items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-sm transition hover:bg-joy-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-joy-grass/60 sm:inline-flex">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={photoURL} alt={displayName} />
                        <AvatarFallback className="bg-joy-grass text-white font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-4 w-4 text-joy-ink-muted" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-64 rounded-xl border-joy-ink/10 bg-white text-joy-ink shadow-lg"
            >
                <DropdownMenuLabel>
                    <div className="flex items-center gap-3">
                        <div className="flex min-w-0 flex-1 flex-col space-y-0.5">
                            <p className="truncate text-sm font-bold">
                                {displayName}
                            </p>
                            {email && (
                                <p className="truncate text-xs font-normal text-joy-ink-muted">
                                    {email}
                                </p>
                            )}
                            {!loading && (
                                <p className="text-[11px] font-semibold text-joy-grass">
                                    Profile {score}% complete
                                </p>
                            )}
                        </div>
                        {!loading && <CompletenessRing score={score} />}
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild className={itemClass}>
                        <Link to={routes.me}>
                            <LayoutGrid className="mr-2 h-4 w-4" />
                            <span>Your space</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={itemClass}>
                        <PreloadLink to={routes.account}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Edit profile</span>
                        </PreloadLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={itemClass}>
                        <PreloadLink to={routes.alerts}>
                            <Bell className="mr-2 h-4 w-4" />
                            <span>My alerts</span>
                            {alertCount > 0 && (
                                <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-joy-grass px-1.5 text-[11px] font-bold text-white">
                                    {alertCount}
                                </span>
                            )}
                        </PreloadLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={itemClass}>
                        <PreloadLink to={routes.applications}>
                            <FileText className="mr-2 h-4 w-4" />
                            <span>My applications</span>
                        </PreloadLink>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-joy-ink-muted">
                    Surveys
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                    <DropdownMenuItem asChild className={itemClass}>
                        <PreloadLink to={routes.surveyValues}>
                            <ClipboardList className="mr-2 h-4 w-4" />
                            <span>Workplace values</span>
                        </PreloadLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={itemClass}>
                        <PreloadLink to={routes.surveySelfId}>
                            <ClipboardList className="mr-2 h-4 w-4" />
                            <span>Self-ID</span>
                        </PreloadLink>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={onLogout}
                    className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
