import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useIsPlatformAdmin } from '@/hooks/useAdminData';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface PlatformAdminProtectedRouteProps {
  children: ReactNode;
  fallbackPath?: string;
}

export function PlatformAdminProtectedRoute({ 
  children, 
  fallbackPath = '/dashboard' 
}: PlatformAdminProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: isPlatformAdmin, isLoading: roleLoading, error } = useIsPlatformAdmin();

  // Show loading state while checking authentication and role
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Verifying Access
          </h2>
          <p className="text-text-secondary">
            Checking platform administrative privileges...
          </p>
        </Card>
      </div>
    );
  }

  // Redirect if user is not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Handle role check error
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Access Error
          </h2>
          <p className="text-text-secondary mb-4">
            Unable to verify your platform administrative privileges.
          </p>
          <p className="text-sm text-text-secondary">
            Please contact your system administrator if this issue persists.
          </p>
        </Card>
      </div>
    );
  }

  // Redirect non-platform-admin users
  if (!isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-orange-500" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Platform Access Restricted
          </h2>
          <p className="text-text-secondary mb-4">
            You need platform administrator privileges to access this page.
          </p>
          <p className="text-sm text-text-secondary">
            This area is reserved for platform administrators only.
          </p>
        </Card>
      </div>
    );
  }

  // User is authenticated and has platform-admin role
  return <>{children}</>;
}

