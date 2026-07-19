import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { RouteFallback } from "@/components/route-fallback";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/**
 * ProtectedRoute - Prevents authenticated users from accessing auth pages
 * Redirects signed-in users to /me ("Your space" hub)
 *
 * Auth resolves asynchronously (AuthProvider no longer blocks rendering), so
 * `user` isn't definitive until `loading` is false. While loading we render
 * nothing rather than showing the sign-in form, which would otherwise flash
 * briefly for an already-signed-in user on a hard reload before bouncing
 * them to /me.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading } = useAuth();

    if (loading) {
        return <RouteFallback />;
    }

    if (user) {
        return <Navigate to="/me" replace />;
    }

    return <>{children}</>;
}
