import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface ConsultantProtectedRouteProps {
  children: ReactNode;
}

export function ConsultantProtectedRoute({ children }: ConsultantProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Only consultants and platform admins can access consultant portal
  if (profile?.role !== 'consultant' && profile?.role !== 'platform-admin') {
    return <Navigate to="/client-dashboard" replace />;
  }

  return <>{children}</>;
}
