import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface PrivateRouteProps {
    children: React.ReactNode;
}

/**
 * PrivateRoute - Requires authentication to access
 * Redirects non-authenticated users to /sign-in
 */
export function PrivateRoute({ children }: PrivateRouteProps) {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/sign-in" replace />;
    }

    return <>{children}</>;
}
