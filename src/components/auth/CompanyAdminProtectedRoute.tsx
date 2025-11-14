import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";

interface CompanyAdminProtectedRouteProps {
  children: ReactNode;
  requireOnboarding?: boolean;
}

export function CompanyAdminProtectedRoute({ 
  children, 
  requireOnboarding = false 
}: CompanyAdminProtectedRouteProps) {
  const { user, loading, isOnboardingComplete } = useAuth();
  const { data: platformAdminData, isLoading: isCheckingAdmin } = usePlatformAdmin();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (user?.id) {
      // Fetch user's role from their profile
      const fetchUserRole = async () => {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching user role:', error);
            setUserRole(null);
          } else {
            setUserRole(profile?.role || null);
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole(null);
        } finally {
          setRoleLoading(false);
        }
      };

      fetchUserRole();
    } else {
      setRoleLoading(false);
    }
  }, [user?.id]);

  // Show loading while checking authentication, role, and platform admin status
  if (loading || roleLoading || isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has admin role OR is a platform admin
  const isCompanyAdmin = userRole === 'admin';
  const isPlatformAdmin = platformAdminData?.success && platformAdminData?.isAdmin;
  
  // Debug logging
  console.log('CompanyAdminProtectedRoute Debug:', {
    userRole,
    isCompanyAdmin,
    platformAdminData,
    isPlatformAdmin,
    finalAccess: isCompanyAdmin || isPlatformAdmin
  });
  
  if (!isCompanyAdmin && !isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-text-secondary mb-6">
            You need administrator privileges to access this section.
          </p>
          <p className="text-sm text-text-secondary mb-4">
            Debug: Role={userRole}, Platform Admin={JSON.stringify(platformAdminData)}
          </p>
          <Navigate to="/client-dashboard" replace />
        </div>
      </div>
    );
  }

  // If onboarding is required but not complete, redirect to onboarding
  if (requireOnboarding && isOnboardingComplete === false) {
    return <Navigate to="/onboarding" replace />;
  }

  // If onboarding is complete but user is trying to access onboarding, redirect to client dashboard
  if (location.pathname === "/onboarding" && isOnboardingComplete === true) {
    return <Navigate to="/client-dashboard" replace />;
  }

  return <>{children}</>;
}
