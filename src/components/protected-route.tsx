import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/**
 * ProtectedRoute - Prevents authenticated users from accessing auth pages
 * Redirects signed-in users to /me ("Your space" hub)
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user } = useAuth();

    if (user) {
        return <Navigate to="/me" replace />;
    }

    return <>{children}</>;
}
