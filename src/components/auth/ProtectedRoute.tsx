import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ children, requireOnboarding = false }: ProtectedRouteProps) {
  const { user, loading, isOnboardingComplete } = useAuth();
  const location = useLocation();

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

  // If onboarding is required but not complete, redirect to onboarding
  if (requireOnboarding && isOnboardingComplete !== true) {
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding is complete but user is trying to access onboarding, redirect to client dashboard
  if (location.pathname === "/onboarding" && isOnboardingComplete === true) {
    return <Navigate to="/client-dashboard" replace />;
  }

  return <>{children}</>;
}