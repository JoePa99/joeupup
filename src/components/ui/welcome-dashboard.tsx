import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Plus, 
  Users, 
  FileText, 
  Bot, 
  Settings,
  Clock,
  CheckCircle,
  AlertCircle,
  Mail,
  Calendar,
  HardDrive,
  FileSpreadsheet,
  FileType,
  User,
  Building,
  DollarSign,
  Ticket,
  UserPlus
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateChannelModal } from "@/components/modals/CreateChannelModal";
import { ActivityFeed } from "@/components/home/ActivityFeed";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  last_message?: {
    content: string;
    created_at: string;
    user_name: string;
    is_agent: boolean;
  };
  unread_count?: number;
}

interface GoogleIntegration {
  id: string;
  gmail_enabled: boolean;
  calendar_enabled: boolean;
  drive_enabled: boolean;
  sheets_enabled: boolean;
  docs_enabled: boolean;
  is_active: boolean;
  updated_at: string;
}

interface HubSpotIntegration {
  id: string;
  contacts_enabled: boolean;
  companies_enabled: boolean;
  deals_enabled: boolean;
  tickets_enabled: boolean;
  is_active: boolean;
  updated_at: string;
}

interface WelcomeDashboardProps {
  onNavigateToChannel?: (channelId: string) => void;
  onNavigateToAgent?: (agentId: string) => void;
}

export function WelcomeDashboard({ 
  onNavigateToChannel, 
  onNavigateToAgent
}: WelcomeDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [recentChannels, setRecentChannels] = useState<Channel[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [googleIntegration, setGoogleIntegration] = useState<GoogleIntegration | null>(null);
  const [hubspotIntegration, setHubspotIntegration] = useState<HubSpotIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Fetch user profile to get company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Fetch recent channels with last messages
      const { data: channels } = await supabase
        .from('channels')
        .select(`
          id,
          name,
          description,
          is_private,
          channel_members!inner(user_id)
        `)
        .eq('company_id', profile.company_id)
        .eq('channel_members.user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(3);

      // Fetch last messages for each channel
      const channelsWithMessages = await Promise.all(
        (channels || []).map(async (channel) => {
          const { data: lastMessage } = await supabase
            .from('chat_messages')
            .select(`
              content,
              created_at,
              user_id,
              agent_id,
              agents(name)
            `)
            .eq('channel_id', channel.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...channel,
            last_message: lastMessage ? {
              content: lastMessage.content,
              created_at: lastMessage.created_at,
              user_name: lastMessage.agent_id 
                ? lastMessage.agents?.name || 'AI Agent'
                : 'User', // Simplified since profiles join is not available yet
              is_agent: !!lastMessage.agent_id
            } : undefined
          };
        })
      );

      setRecentChannels(channelsWithMessages);

      // Fetch recent activities (last 10 messages from all channels)
      // Note: profiles join removed due to missing foreign key - will be fixed in migration
      const { data: activities } = await supabase
        .from('chat_messages')
        .select(`
          content,
          created_at,
          user_id,
          agent_id,
          channel_id,
          channels(name),
          agents(name)
        `)
        .not('channel_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentActivities(activities || []);

      // Fetch Google integration status
      const { data: googleIntegration } = await supabase
        .from('google_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setGoogleIntegration(googleIntegration);

      // Fetch HubSpot integration status
      const { data: hubspotIntegration } = await (supabase as any)
        .from('hubspot_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setHubspotIntegration(hubspotIntegration);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const handleCreateChannel = () => {
    setIsCreateChannelModalOpen(true);
  };

  const handleChannelCreated = (channelId: string) => {
    setIsCreateChannelModalOpen(false);
    // Refresh the dashboard data to show the new channel
    fetchDashboardData();
    // Navigate to the new channel
    onNavigateToChannel?.(channelId);
  };

  const handleUploadDocuments = () => {
    navigate('/documents');
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const handleInviteTeamMembers = () => {
    navigate('/invite-team');
  };

  const handleGoToIntegrations = () => {
    navigate('/integrations');
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl space-y-8">
          {/* Hero Section Skeleton */}
          <div className="text-center space-y-4">
            <Skeleton className="h-12 w-96 mx-auto" />
            <Skeleton className="h-4 w-80 mx-auto" />
          </div>

          {/* Quick Actions Skeleton */}
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-white">
      <div className="w-full max-w-4xl space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-black">
            Welcome to your AI Workspace
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get started by creating a task and Chat can do the rest. Not sure where to start?
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200" onClick={handleCreateChannel}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <span className="text-black font-medium">Create Channel</span>
              </div>
              <Plus className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200" onClick={handleUploadDocuments}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <span className="text-black font-medium">Upload Documents</span>
              </div>
              <Plus className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200" onClick={handleInviteTeamMembers}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                  <UserPlus className="h-4 w-4 text-white" />
                </div>
                <span className="text-black font-medium">Invite Team</span>
              </div>
              <Plus className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200" onClick={handleSettings}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center">
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <span className="text-black font-medium">Settings</span>
              </div>
              <Plus className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recent Channels */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-black">Recent Channels</h2>
            <div className="space-y-2">
              {recentChannels.length > 0 ? (
                recentChannels.map((channel) => (
                  <div 
                    key={channel.id} 
                    className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => onNavigateToChannel?.(channel.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-black">#{channel.name}</span>
                      {channel.is_private && (
                        <span className="text-xs text-gray-500">Private</span>
                      )}
                    </div>
                    {channel.last_message && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600 truncate">
                          {channel.last_message.user_name}: {channel.last_message.content}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(channel.last_message.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center border border-gray-200 rounded-lg">
                  <MessageCircle className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">No channels yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-black">Recent Activities</h2>
            <ActivityFeed limit={5} />
          </div>

          {/* Integrations Status */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-black">Integrations</h2>
            <div className="space-y-3">
              {/* Google Workspace */}
              <div className="p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-black">Google Workspace</span>
                  {googleIntegration ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                {googleIntegration ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <Mail className="h-3 w-3" />
                      <span className="text-gray-600">Gmail</span>
                      {googleIntegration?.gmail_enabled ? (
                        <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300 ml-auto" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="h-3 w-3" />
                      <span className="text-gray-600">Calendar</span>
                      {googleIntegration?.calendar_enabled ? (
                        <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300 ml-auto" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <HardDrive className="h-3 w-3" />
                      <span className="text-gray-600">Drive</span>
                      {googleIntegration?.drive_enabled ? (
                        <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300 ml-auto" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <FileSpreadsheet className="h-3 w-3" />
                      <span className="text-gray-600">Sheets</span>
                      {googleIntegration?.sheets_enabled ? (
                        <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300 ml-auto" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <FileType className="h-3 w-3" />
                      <span className="text-gray-600">Docs</span>
                      {googleIntegration?.docs_enabled ? (
                        <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300 ml-auto" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">Connect Google Workspace to enable AI agents</p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleGoToIntegrations}
                      className="w-full text-xs"
                    >
                      Connect Google
                    </Button>
                  </div>
                )}
              </div>

              {/* HubSpot */}
              <div className="p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-black">HubSpot</span>
                  {hubspotIntegration ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                {hubspotIntegration ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <User className="h-3 w-3" />
                      <span className="text-gray-600">Contacts</span>
                      {hubspotIntegration?.contacts_enabled ? (
                        <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300 ml-auto" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Building className="h-3 w-3" />
                      <span className="text-gray-600">Companies</span>
                      {hubspotIntegration?.companies_enabled ? (
                        <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300 ml-auto" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <DollarSign className="h-3 w-3" />
                      <span className="text-gray-600">Deals</span>
                      {hubspotIntegration?.deals_enabled ? (
                        <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300 ml-auto" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Ticket className="h-3 w-3" />
                      <span className="text-gray-600">Tickets</span>
                      {hubspotIntegration?.tickets_enabled ? (
                        <CheckCircle className="h-3 w-3 text-green-600 ml-auto" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300 ml-auto" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600">Connect HubSpot CRM to enable AI agents</p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleGoToIntegrations}
                      className="w-full text-xs"
                    >
                      Connect HubSpot
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Create Channel Modal */}
        <CreateChannelModal
          isOpen={isCreateChannelModalOpen}
          onClose={() => setIsCreateChannelModalOpen(false)}
          onChannelCreated={handleChannelCreated}
        />
      </div>
    </div>
  );
}