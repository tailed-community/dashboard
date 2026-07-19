import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { RouteFallback } from "@/components/route-fallback";

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
 * AuthProvider no longer blocks the whole app behind a loader — it renders
 * immediately and resolves Firebase auth in the background. So `user` is
 * NOT definitive until `loading` is false: while `loading` is true we
 * render nothing (rather than redirecting) to avoid bouncing a signed-in
 * user to /sign-in on every hard reload before Firebase has had a chance to
 * report back. Once `loading` is false, `user` is authoritative and the
 * redirect below is safe.
 */
export function PrivateRoute({ children }: PrivateRouteProps) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <RouteFallback />;
    }

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
