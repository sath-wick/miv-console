import { Navigate } from "react-router-dom";
import type { PropsWithChildren } from "react";
import type { Role } from "@/types/models";
import { useAuth } from "@/auth/AuthProvider";

interface RoleRouteProps extends PropsWithChildren {
  allow: Role[];
}

export function RoleRoute({ allow, children }: RoleRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="app-container text-sm text-text-secondary">Loading session...</div>;
  }

  if (!user || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(role)) {
    return <Navigate to={role === "courier" ? "/courier" : "/home"} replace />;
  }

  return <>{children}</>;
}
