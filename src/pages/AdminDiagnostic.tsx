import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { 
  diagnoseAdminAccess, 
  updateUserToAdmin, 
  createUserProfile,
  type UserRoleInfo 
} from '@/utils/adminDiagnostic';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminDiagnostic() {
  const [userInfo, setUserInfo] = useState<UserRoleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    setLoading(true);
    const info = await diagnoseAdminAccess();
    setUserInfo(info);
    setLoading(false);
  };

  const handleCreateProfile = async () => {
    setUpdating(true);
    const result = await createUserProfile();
    
    toast({
      title: result.success ? "Success" : "Error",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });

    if (result.success) {
      await checkUserStatus();
    }
    setUpdating(false);
  };

  const handleUpdateToAdmin = async () => {
    setUpdating(true);
    const result = await updateUserToAdmin();
    
    toast({
      title: result.success ? "Success" : "Error", 
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });

    if (result.success) {
      await checkUserStatus();
      toast({
        title: "Admin Access Granted",
        description: "You can now access the admin dashboard. Redirecting...",
        variant: "default",
      });
      
      // Redirect after a delay to allow the toast to show
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    }
    setUpdating(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Not Authenticated
          </h2>
          <p className="text-text-secondary">
            Please log in first to diagnose admin access.
          </p>
          <Button onClick={() => navigate('/login')} className="mt-4">
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Diagnosing Admin Access
          </h2>
          <p className="text-text-secondary">
            Checking your account permissions...
          </p>
        </Card>
      </div>
    );
  }

  const getRoleStatus = (role: string | null) => {
    switch (role) {
      case 'admin':
        return { icon: CheckCircle, color: 'text-green-500', variant: 'default' as const, label: 'Admin' };
      case 'moderator':
        return { icon: AlertTriangle, color: 'text-yellow-500', variant: 'secondary' as const, label: 'Moderator' };
      case 'user':
        return { icon: User, color: 'text-blue-500', variant: 'outline' as const, label: 'User' };
      default:
        return { icon: XCircle, color: 'text-red-500', variant: 'destructive' as const, label: 'No Role' };
    }
  };

  if (!userInfo) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Diagnostic Failed
          </h2>
          <p className="text-text-secondary mb-4">
            Unable to retrieve user information.
          </p>
          <Button onClick={checkUserStatus} variant="outline">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const roleStatus = getRoleStatus(userInfo.role);
  const StatusIcon = roleStatus.icon;

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Admin Access Diagnostic
          </h1>
          <p className="text-text-secondary">
            Check and fix admin dashboard access permissions
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          {/* User Information */}
          <Card className="p-6 border border-gray-200 shadow-none">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">
                  Account Information
                </h2>
                <p className="text-text-secondary">
                  Current user account details and permissions
                </p>
              </div>
              <Shield className="h-8 w-8 text-primary" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Email</p>
                  <p className="text-sm text-text-secondary">{userInfo.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                <div>
                  <p className="font-medium text-foreground">User ID</p>
                  <p className="text-sm text-text-secondary font-mono">
                    {userInfo.userId}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Profile Status</p>
                  <p className="text-sm text-text-secondary">
                    {userInfo.profileExists ? 'Profile exists' : 'No profile found'}
                  </p>
                </div>
                {userInfo.profileExists ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Current Role</p>
                  <p className="text-sm text-text-secondary">
                    {userInfo.role || 'No role assigned'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon className={`h-5 w-5 ${roleStatus.color}`} />
                  <Badge variant={roleStatus.variant}>
                    {roleStatus.label}
                  </Badge>
                </div>
              </div>

              {userInfo.companyId && (
                <div className="flex items-center justify-between p-4 bg-surface-subtle rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Company ID</p>
                    <p className="text-sm text-text-secondary font-mono">
                      {userInfo.companyId}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Action Card */}
          <Card className="p-6 border border-gray-200 shadow-none">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Actions
            </h2>

            {!userInfo.profileExists ? (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-red-900">No Profile Found</h3>
                      <p className="text-sm text-red-700 mt-1">
                        Your user account doesn't have a profile in the database. 
                        This is required for admin access.
                      </p>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={handleCreateProfile} 
                  disabled={updating}
                  className="w-full"
                >
                  {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Admin Profile
                </Button>
              </div>
            ) : userInfo.role !== 'admin' ? (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-yellow-900">
                        Insufficient Permissions
                      </h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        Your current role is "{userInfo.role || 'none'}" but admin 
                        access requires the "admin" role.
                      </p>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={handleUpdateToAdmin} 
                  disabled={updating}
                  className="w-full"
                >
                  {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Grant Admin Access
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-green-900">
                        Admin Access Confirmed
                      </h3>
                      <p className="text-sm text-green-700 mt-1">
                        You have admin permissions and should be able to access 
                        the admin dashboard.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => navigate('/dashboard')} 
                    className="flex-1"
                  >
                    Go to Admin Dashboard
                  </Button>
                  <Button 
                    onClick={checkUserStatus} 
                    variant="outline"
                    className="flex-1"
                  >
                    Refresh Status
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Debug Information */}
          <Card className="p-6 border border-gray-200 shadow-none">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Debug Information
            </h2>
            <pre className="text-xs bg-surface-subtle p-4 rounded-lg overflow-auto">
              {JSON.stringify(userInfo, null, 2)}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}


