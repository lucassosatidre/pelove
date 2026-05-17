import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

interface Props {
  allowedRoles: AppRole[];
  children: ReactNode;
}

export function RoleGuard({ allowedRoles, children }: Props) {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-md bg-primary animate-pulse" />
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/mapa" replace />;
  }

  return <>{children}</>;
}
