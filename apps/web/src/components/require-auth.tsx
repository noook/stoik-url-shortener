import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";

/** Redirects to /login when there's no valid stored auth token. */
export function RequireAuth() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;
  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
}
