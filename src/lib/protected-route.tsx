import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { studentAuth, TENANT_IDS } from "./auth"; // Import TENANT_IDS instead of orgAuth

const ProtectedRoute = () => {
  const { user } = useAuth();

  // Check if user exists and belongs to organization tenant
  const isOrgUser = user && user.tenantId === TENANT_IDS.STUDENTS;

  return isOrgUser ? <Outlet /> : <Navigate to="/sign-in" replace />;
};

export default ProtectedRoute;
