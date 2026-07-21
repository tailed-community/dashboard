import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { RouteFallback } from "@/components/route-fallback";

interface AdminRouteProps {
    children: React.ReactNode;
}

/**
 * AdminRoute - Requires authentication AND the `platformAdmin` custom claim
 * to access. Modeled on PrivateRoute (see src/components/private-route.tsx):
 * same "don't redirect while still loading" caution applies here, plus an
 * extra beat while the claim itself resolves (see usePlatformAdmin).
 *
 * - Signed out -> redirect to /sign-in with redirectUrl, same as PrivateRoute.
 * - Signed in but not a platform admin -> redirect to "/" (no error page;
 *   this route simply doesn't exist for them).
 */
export function AdminRoute({ children }: AdminRouteProps) {
    const { user, loading: authLoading } = useAuth();
    const { isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();
    const location = useLocation();

    if (authLoading || adminLoading) {
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

    if (!isPlatformAdmin) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
