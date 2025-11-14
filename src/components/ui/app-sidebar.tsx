
import { useState, useEffect } from "react";
import { HashtagIcon, PlusIcon, Cog6ToothIcon, HomeIcon, ChatBubbleLeftEllipsisIcon, DocumentTextIcon, PuzzlePieceIcon, UserPlusIcon, BookOpenIcon, ChatBubbleLeftRightIcon, CpuChipIcon, ChartBarIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { CreateChannelModal } from "@/components/modals/CreateChannelModal";
import { useIsAdmin, useIsPlatformAdmin } from "@/hooks/useAdminData";
import { NotificationBadge } from "@/components/ui/notification-center";
import { UsageIndicator } from "@/components/usage/UsageIndicator";
import { useUsage } from "@/hooks/useUsage";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { FloatingMenuButton } from "@/components/ui/floating-menu-button";

interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  avatar_url: string | null;
  status: string;
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: isAdmin, isLoading: isLoadingAdmin } = useIsAdmin();
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { refetch: refetchUsage, usage } = useUsage();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [userProfile, setUserProfile] = useState<{ company_id: string | null } | null>(null);
  const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false);
  const [onboardingType, setOnboardingType] = useState<string | null>(null);
  const [userCollapsibleOpen, setUserCollapsibleOpen] = useState(false);
  const [aiAgentsOpen, setAiAgentsOpen] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const collapsed = state === "collapsed";

  // Refetch usage when collapsible opens
  useEffect(() => {
    if (userCollapsibleOpen) {
      refetchUsage();
    }
  }, [userCollapsibleOpen, refetchUsage]);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchOnboardingType();
    }
  }, [user]);

  // Fetch channels and agents when userProfile is available
  useEffect(() => {
    if (userProfile?.company_id) {
      fetchChannels();
      fetchAgents();
    }
  }, [userProfile]);

  // Real-time subscription for channel changes
  useEffect(() => {
    if (!userProfile?.company_id) return;

    const channelSubscription = supabase
      .channel(`company-channels-${userProfile.company_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `company_id=eq.${userProfile.company_id}`
        },
        (payload) => {
          console.log('Channel change detected:', payload);
          // Refresh channels list on any channel change
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSubscription);
    };
  }, [userProfile?.company_id]);

  const fetchUserProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchOnboardingType = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('onboarding_sessions')
        .select('onboarding_type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      setOnboardingType(data?.onboarding_type || null);
    } catch (error) {
      console.error('Error fetching onboarding type:', error);
    }
  };

  const fetchAgents = async () => {
    if (!userProfile?.company_id) {
      setLoadingAgents(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast({
        title: "Error",
        description: "Failed to load AI agents",
        variant: "destructive",
      });
    } finally {
      setLoadingAgents(false);
    }
  };

  const fetchChannels = async () => {
    if (!userProfile?.company_id || !user?.id) {
      setLoadingChannels(false);
      return;
    }

    setLoadingChannels(true);
    try {
      // Fetch all channels in the company (RLS allows this now)
      const { data: allChannels, error } = await supabase
        .from('channels')
        .select('id, name, description, is_private')
        .eq('company_id', userProfile.company_id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching channels:', error);
        throw error;
      }
      
      // Filter channels at application level
      const accessibleChannels: Channel[] = [];
      
      for (const channel of allChannels || []) {
        // Public channels are accessible to all company members
        if (!channel.is_private) {
          accessibleChannels.push(channel);
          continue;
        }
        
        // For private channels, check if user is a member
        const { data: membership } = await supabase
          .from('channel_members')
          .select('id')
          .eq('channel_id', channel.id)
          .eq('user_id', user.id)
          .single();
        
        if (membership) {
          accessibleChannels.push(channel);
        }
      }
      
      console.log('Fetched accessible channels:', accessibleChannels);
      setChannels(accessibleChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleAgentClick = (agentId: string) => {
    navigate(`/client-dashboard?agent=${agentId}`);
  };

  const handleChannelClick = async (channelId: string) => {
    // Check if user has access to this channel before navigating
    const { isChannelAccessible } = await import('@/lib/channel-utils');
    const hasAccess = await isChannelAccessible(channelId);
    
    if (!hasAccess) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this channel.",
        variant: "destructive",
      });
      return;
    }
    
    navigate(`/client-dashboard?channel=${channelId}`);
  };

  const handleCreateChannel = () => {
    setCreateChannelModalOpen(true);
  };

  const handleChannelCreated = (channelId: string) => {
    // Refresh channels list
    fetchChannels();
    // Navigate to the new channel
    navigate(`/client-dashboard?channel=${channelId}`);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <Sidebar className={`${collapsed ? "w-14" : "w-64"} bg-white`} collapsible="icon" variant="sidebar">
      <FloatingMenuButton />
        <SidebarHeader className="border-b border-gray-200 p-4 bg-white">
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center space-x-2">
                <img 
                  src="/upupdndnstacked.png" 
                  alt="upup dndn logo" 
                  className="h-14 object-contain"
                />
              </div>
            )}
            <NotificationBadge className={collapsed ? "mx-auto" : ""} />
          </div>
        </SidebarHeader>

      <SidebarContent className="bg-white overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {/* Home */}
        <SidebarGroup className="relative overflow-visible">
          
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/welcome" className="flex items-center">
                    <HomeIcon className="h-4 w-4" />
                    {!collapsed && <span>Home</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {user && !isLoadingAdmin && isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard" className="flex items-center">
                      <HomeIcon className="h-4 w-4" />
                      {!collapsed && <span>Dashboard</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* AI Agents */}
        <SidebarGroup>
          <SidebarGroupLabel 
            className="text-[11px] uppercase tracking-wider text-gray-400 font-thin  cursor-pointer hover:text-gray-700 flex items-center justify-between"
            onClick={() => setAiAgentsOpen(!aiAgentsOpen)}
          >
            <span>AI AGENTS</span>
            <ChevronDownIcon className={`h-3 w-3 transition-transform ${aiAgentsOpen ? 'rotate-180' : ''}`} />
          </SidebarGroupLabel>
          {aiAgentsOpen && (
          <SidebarGroupContent>
            <SidebarMenu>
              {loadingAgents ? (
                <SidebarMenuItem>
                  <div className="flex items-center space-x-2 px-3 py-2">
                    <div className="animate-pulse h-4 w-4 bg-muted rounded"></div>
                    {!collapsed && <div className="animate-pulse h-4 w-16 bg-muted rounded"></div>}
                  </div>
                </SidebarMenuItem>
              ) : agents.length === 0 ? (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {!collapsed && "No agents available"}
                  </div>
                </SidebarMenuItem>
              ) : (
                agents.map((agent) => (
                  <SidebarMenuItem key={agent.id}>
                    <SidebarMenuButton
                      onClick={() => handleAgentClick(agent.id)}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                      >
                        <span className="text-xs text-gray-400">{'{AI}'}</span>
                      {!collapsed && <span className="truncate">{agent.name}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Channels */}
        <SidebarGroup>
          <SidebarGroupLabel 
            className="text-[11px] uppercase tracking-wider text-gray-400 font-thin cursor-pointer hover:text-gray-700 flex items-center justify-between"
            onClick={() => setChannelsOpen(!channelsOpen)}
          >
            <span>CHANNELS</span>
            <ChevronDownIcon className={`h-3 w-3 transition-transform ${channelsOpen ? 'rotate-180' : ''}`} />
          </SidebarGroupLabel>
          {channelsOpen && (
          <SidebarGroupContent>
            <SidebarMenu>
              {loadingChannels ? (
                <SidebarMenuItem>
                  <div className="flex items-center space-x-2 px-3 py-2">
                    <div className="animate-pulse h-4 w-4 bg-muted rounded"></div>
                    {!collapsed && <div className="animate-pulse h-4 w-20 bg-muted rounded"></div>}
                  </div>
                </SidebarMenuItem>
              ) : channels.length === 0 ? (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {!collapsed && "No channels yet"}
                  </div>
                </SidebarMenuItem>
              ) : (
                channels.map((channel) => (
                  <SidebarMenuItem key={channel.id}>
                    <SidebarMenuButton
                      onClick={() => handleChannelClick(channel.id)}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                    >
                        <span className="text-xs text-gray-400">{'{#}'}</span>
                      {!collapsed && <span className="truncate">{channel.name}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
                
                {/* Create channel button */}
                {!collapsed && (
                  <SidebarMenuItem>
                    <Button
                      onClick={handleCreateChannel}
                      className="w-full mt-2 justify-center bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 h-8 text-[10px] font-normal shadow-[0_0_0_1px_hsl(var(--sidebar-border))] border-1 border-gray-100 rounded-[6px]"
                    >
                      <span className="text-[10px] mr-2 text-gray-400">{'(#)'}</span>
                      CREATE CHANNEL
                    </Button>
                  </SidebarMenuItem>
                )}
            </SidebarMenu>
          </SidebarGroupContent>
          )}
        </SidebarGroup>

        {/* Company Management - Only show for company admins */}
        {user && !isLoadingAdmin && isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-gray-500 font-medium">
              Company Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/company-agents" className="flex items-center space-x-2">
                      <CpuChipIcon className="h-4 w-4" />
                      {!collapsed && <span>Company Agents</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Settings Section - HIDDEN */}
        {/* Contains navigation links for configuration and management features */}
        {false && <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Playbook - Company playbook management accessible to all users */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/playbook" className="flex items-center space-x-2">
                    <BookOpenIcon className="h-4 w-4" />
                    {!collapsed && <span>Playbook</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Consultations - Only visible to company admins with consulting onboarding type */}
              {/* This feature is specific to consulting companies for managing client consultations */}
              {user && !isLoadingAdmin && isAdmin && onboardingType === 'consulting' && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/consultations" className="flex items-center space-x-2">
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      {!collapsed && <span>Consultations</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {/* Team Management - Invite and manage team members */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/invite-team" className="flex items-center space-x-2">
                    <UserPlusIcon className="h-4 w-4" />
                    {!collapsed && <span>Team Management</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Integrations - Connect external services (Google Drive, etc.) */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/integrations" className="flex items-center space-x-2">
                    <PuzzlePieceIcon className="h-4 w-4" />
                    {!collapsed && <span>Integrations</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* Usage & Billing - View usage statistics and manage subscription */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/client-dashboard/usage" className="flex items-center space-x-2">
                    <ChartBarIcon className="h-4 w-4" />
                    {!collapsed && <span>Usage & Billing</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {/* General Settings - User preferences and account settings */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/settings" className="flex items-center space-x-2">
                    <Cog6ToothIcon className="h-4 w-4" />
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>}
      </SidebarContent>

      {/* User Collapsible Footer */}
      <SidebarFooter className="bg-white rounded-[12px] border border-gray-200 shadow-none mx-2 my-2">
        <SidebarMenu>
          {/* Collapsible User Menu Content - Shows when expanded */}
          {userCollapsibleOpen && !collapsed && (
            <div className="px-2 py-2 space-y-2">
              {/* Usage Indicator - Styled exactly like image */}
              <div className="rounded-lg  bg-white">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChatBubbleLeftEllipsisIcon className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">
                        {usage ? `${usage.messages_limit - usage.messages_used} left` : 'Loading...'}
                      </span>
                    </div>
                    <span className="text-xs text-green-600">
                      {usage ? `${Math.round((usage.messages_used / usage.messages_limit) * 100)}%` : '0%'}
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-green-500 h-1.5 rounded-full" 
                      style={{ 
                        width: usage ? `${Math.min((usage.messages_used / usage.messages_limit) * 100, 100)}%` : '0%' 
                      }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{usage ? `${usage.messages_used} / ${usage.messages_limit} messages` : '0 / 0 messages'}</span>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="h-auto p-0 text-gray-600 hover:text-gray-800"
                      onClick={() => navigate('/client-dashboard/usage')}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Menu Items - Styled exactly like image */}
              <div className="space-y-1">
                <SidebarMenuButton
                  onClick={() => navigate('/settings')}
                  className="w-full justify-start hover:bg-gray-100 text-gray-700 h-8 px-2"
                >
                  <UserIcon className="h-4 w-4 mr-2" />
                  Profile & Settings
                </SidebarMenuButton>
                
                <SidebarMenuButton
                  onClick={handleSignOut}
                  className="w-full justify-start hover:bg-gray-100 text-red-600 h-8 px-2"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                  Log out
                </SidebarMenuButton>
              </div>
            </div>
          )}
          
          {/* User Profile Button - Always visible at bottom */}
          <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
              onClick={() => setUserCollapsibleOpen(!userCollapsibleOpen)}
              className="text-gray-700 hover:bg-none"
                >
                  <Avatar className="h-8 w-8 rounded-[6px]">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email} />
                <AvatarFallback className="rounded-[6px] bg-gradient-to-b from-blue-200 to-purple-300 text-white">
                      {user?.email ? getInitials(user.email) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-gray-900">
                        {user?.email}
                      </span>
                      <span className="truncate text-xs text-gray-500">
                        {usage ? `${usage.messages_limit - usage.messages_used} left` : 'Loading...'}
                      </span>
                </div>
              )}
              <ChevronUpIcon className={`ml-auto size-4 text-gray-500 transition-transform ${userCollapsibleOpen ? 'rotate-180' : ''}`} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      </Sidebar>

      <CreateChannelModal
        isOpen={createChannelModalOpen}
        onClose={() => setCreateChannelModalOpen(false)}
        onChannelCreated={handleChannelCreated}
      />
    </>
  );
}
