import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface PrivateRouteProps {
    children: React.ReactNode;
}

/**
 * PrivateRoute - Requires authentication to access.
 *
 * Redirects non-authenticated users to /sign-in, preserving the intended
 * destination as `redirectUrl` so the sign-in flow (Google + magic link) returns
 * them exactly where they were headed. This is what lets a logged-out click on a
 * protected link — e.g. an email campaign's "Manage your alerts" → /account/alerts —
 * round-trip correctly WITHOUT having to bake the redirect into a one-time
 * sign-in link at generation time.
 *
 * Safe to redirect eagerly on `!user`: AuthProvider blocks the whole app behind a
 * loader until Firebase auth resolves, so `user` is already definitive here.
 */
export function PrivateRoute({ children }: PrivateRouteProps) {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        const dest = location.pathname + location.search;
        const to =
            dest && dest !== "/"
                ? `/sign-in?redirectUrl=${encodeURIComponent(dest)}`
                : "/sign-in";
        return <Navigate to={to} replace />;
    }

    return <>{children}</>;
}
