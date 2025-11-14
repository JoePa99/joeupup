import { useParams, useNavigate } from 'react-router-dom';
import { PlatformAdminProtectedRoute } from '@/components/auth/PlatformAdminProtectedRoute';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/ui/admin-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserDetails } from '@/hooks/useUserDetails';
import { formatFileSize } from '@/hooks/useDocumentManagement';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Building2,
  Calendar,
  Clock,
  MessageSquare,
  FileText,
  Hash,
  TrendingUp,
  Activity,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
  UserPlus,
  LogIn,
  Shield
} from 'lucide-react';

function AdminUserDetailContent() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: user, isLoading, error } = useUserDetails(userId || '');
  const [currentSection, setCurrentSection] = useState('overview');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      setCurrentSection(hash || 'overview');
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Invalid User ID</h2>
          <p className="text-muted-foreground mb-4">Please provide a valid user ID.</p>
          <Button onClick={() => navigate('/dashboard/users')}>Back to Users</Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Loading User Details</h2>
          <p className="text-muted-foreground">Fetching comprehensive user information...</p>
        </Card>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-foreground mb-2">User Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Unable to load user details'}
          </p>
          <Button onClick={() => navigate('/dashboard/users')}>Back to Users</Button>
        </Card>
      </div>
    );
  }

  const getUserDisplayName = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'moderator': return 'secondary';
      default: return 'outline';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'message': return MessageSquare;
      case 'document': return FileText;
      case 'channel_join': return UserPlus;
      case 'channel_create': return Hash;
      case 'login': return LogIn;
      default: return Activity;
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* User Profile Card */}
      <Card className="border border-gray-200 shadow-none">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.avatar_url || ''} />
              <AvatarFallback className="text-2xl">
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-foreground">{getUserDisplayName()}</h2>
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role}
                </Badge>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
                {user.company && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{user.company.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{user.member_since}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{user.last_seen_display}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{user.total_messages}</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{user.total_messages}</p>
            <p className="text-sm text-muted-foreground">Messages Sent</p>
            <p className="text-xs text-muted-foreground mt-1">
              {user.avg_messages_per_day} per day avg
            </p>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <FileText className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{user.total_documents}</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{user.total_documents}</p>
            <p className="text-sm text-muted-foreground">Documents Uploaded</p>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <Hash className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{user.channels_joined_count}</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{user.channels_joined_count}</p>
            <p className="text-sm text-muted-foreground">Channels Joined</p>
          </div>
        </Card>

        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <UserPlus className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{user.channels_created_count}</Badge>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground mb-1">{user.channels_created_count}</p>
            <p className="text-sm text-muted-foreground">Channels Created</p>
          </div>
        </Card>
      </div>

      {/* Engagement Metrics */}
      {user.most_active_channel && (
        <Card className="border border-gray-200 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Engagement Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-surface-subtle rounded-lg">
                <span className="text-sm font-medium">Most Active Channel</span>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{user.most_active_channel.name}</span>
                  <Badge variant="outline">{user.most_active_channel.message_count} messages</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="border border-gray-200 shadow-none">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest user interactions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          {user.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {user.recent_activity.slice(0, 10).map((activity) => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-subtle">
                    <Icon className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderDocuments = () => (
    <Card className="border border-gray-200 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents ({user.documents.length})
        </CardTitle>
        <CardDescription>All documents uploaded by this user</CardDescription>
      </CardHeader>
      <CardContent>
        {user.documents.length > 0 ? (
          <div className="space-y-3">
            {user.documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-surface-subtle transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{document.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="truncate">{document.file_name}</span>
                      <span>•</span>
                      <span>{formatFileSize(document.file_size)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <Badge variant="outline">{document.doc_type}</Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(document.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Documents</h3>
            <p className="text-muted-foreground">This user hasn't uploaded any documents yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderChannels = () => (
    <div className="space-y-6">
      {/* Channels Created */}
      <Card className="border border-gray-200 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Channels Created ({user.channels_created.length})
          </CardTitle>
          <CardDescription>Channels this user has created</CardDescription>
        </CardHeader>
        <CardContent>
          {user.channels_created.length > 0 ? (
            <div className="space-y-3">
              {user.channels_created.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-surface-subtle transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Hash className="h-6 w-6 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{channel.name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {channel.description || 'No description'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {channel.is_private && <Badge variant="secondary">Private</Badge>}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(channel.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Hash className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No channels created</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channels Joined */}
      <Card className="border border-gray-200 shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Channels Joined ({user.channels_joined.length})
          </CardTitle>
          <CardDescription>Channels this user is a member of</CardDescription>
        </CardHeader>
        <CardContent>
          {user.channels_joined.length > 0 ? (
            <div className="space-y-3">
              {user.channels_joined.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-surface-subtle transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Hash className="h-6 w-6 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{channel.name}</span>
                        <Badge variant={channel.role === 'admin' ? 'default' : 'secondary'}>
                          {channel.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3">
                        <span>{channel.member_count} members</span>
                        <span>•</span>
                        <span>{channel.message_count} messages</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                    Joined {new Date(channel.joined_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Not a member of any channels</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderActivity = () => (
    <Card className="border border-gray-200 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Timeline
        </CardTitle>
        <CardDescription>Complete activity history for this user</CardDescription>
      </CardHeader>
      <CardContent>
        {user.recent_activity.length > 0 ? (
          <div className="space-y-4">
            {user.recent_activity.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              return (
                <div key={activity.id} className="flex gap-4 relative">
                  <div className="flex flex-col items-center">
                    <div className="rounded-full p-2 bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="w-px h-full bg-border mt-2" />
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-sm">{activity.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {new Date(activity.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Activity</h3>
            <p className="text-muted-foreground">This user has no recorded activity yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderSection = () => {
    switch (currentSection) {
      case 'documents':
        return renderDocuments();
      case 'channels':
        return renderChannels();
      case 'activity':
        return renderActivity();
      case 'overview':
      default:
        return renderOverview();
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-white">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/users')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>
      </div>

      {/* Section Content */}
      {renderSection()}
    </div>
  );
}

export default function AdminUserDetail() {
  return (
    <PlatformAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <AdminSidebar />
          <SidebarInset className="flex-1 bg-white">
            <header className="flex h-16 items-center gap-4 border-b border-gray-200 px-6 bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">User Details</h2>
            </header>
            <AdminUserDetailContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}

