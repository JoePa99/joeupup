import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { Button } from "@/components/ui/button";

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
  const navigate = useNavigate();

  // Check if user has admin role OR is a platform admin
  const isCompanyAdmin = userRole === 'admin';
  const isPlatformAdmin = platformAdminData?.success && platformAdminData?.isAdmin;
  const shouldBlockAccess = !loading && !roleLoading && !isCheckingAdmin && !!user && !isCompanyAdmin && !isPlatformAdmin;

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

  useEffect(() => {
    if (shouldBlockAccess) {
      const timeout = setTimeout(() => navigate('/welcome', { replace: true }), 2500);
      return () => clearTimeout(timeout);
    }
  }, [navigate, shouldBlockAccess]);

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

  if (shouldBlockAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md w-full space-y-6 rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Admins only</p>
            <h1 className="text-2xl font-semibold text-foreground">You need admin access</h1>
            <p className="text-muted-foreground">
              This area is reserved for company administrators. If you think you should have access, reach out to your
              workspace admin.
            </p>
            <p className="text-xs text-muted-foreground">We’ll redirect you to your home view in a moment.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go back
            </Button>
            <Button onClick={() => navigate('/welcome')}>
              Go to home
            </Button>
          </div>
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
