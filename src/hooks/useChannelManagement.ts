import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
  company_id: string;
}

interface ChannelMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    avatar_url: string | null;
    role: string;
  };
}

interface ChannelAgent {
  id: string;
  agent_id: string;
  added_at: string;
  agents: {
    name: string;
    nickname: string | null;
    role: string;
    avatar_url: string | null;
    status: string;
  };
}

interface CompanyMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string;
  is_in_channel: boolean;
}

export function useChannelManagement(channelId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Data states
  const [channel, setChannel] = useState<Channel | null>(null);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [agents, setAgents] = useState<ChannelAgent[]>([]);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [userRole, setUserRole] = useState<string>('');

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (channelId && user) {
      fetchChannelData();
    }
  }, [channelId, user]);

  const fetchChannelData = async () => {
    if (!channelId || !user) return;

    setIsLoading(true);
    try {
      // Fetch channel info
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (channelError) throw channelError;
      setChannel(channelData);

      // Fetch channel members
      const { data: membersData, error: membersError } = await supabase
        .from('channel_members')
        .select('*')
        .eq('channel_id', channelId);

      if (membersError) throw membersError;

      // Fetch profiles for members
      const userIds = membersData?.map(m => m.user_id) || [];
      let membersWithProfiles: ChannelMember[] = [];
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, role')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        membersWithProfiles = membersData?.map(member => ({
          ...member,
          profiles: profilesData?.find(p => p.id === member.user_id) || {
            first_name: null,
            last_name: null,
            email: 'Unknown',
            avatar_url: null,
            role: 'user',
          }
        })) || [];
      }

      setMembers(membersWithProfiles);

      // Set current user role
      const currentUserMember = membersData?.find(m => m.user_id === user.id);
      setUserRole(currentUserMember?.role || '');

      // Fetch channel agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('channel_agents')
        .select('*')
        .eq('channel_id', channelId);

      if (agentsError) throw agentsError;

      // Fetch agent info for channel agents
      const agentIds = agentsData?.map(ca => ca.agent_id) || [];
      let channelAgentsWithData: ChannelAgent[] = [];
      
      if (agentIds.length > 0) {
        const { data: agentsInfoData, error: agentsInfoError } = await supabase
          .from('agents')
          .select('id, name, nickname, role, avatar_url, status')
          .in('id', agentIds);

        if (agentsInfoError) throw agentsInfoError;

        channelAgentsWithData = agentsData?.map(channelAgent => ({
          ...channelAgent,
          agents: agentsInfoData?.find(a => a.id === channelAgent.agent_id) || {
            name: 'Unknown Agent',
            nickname: null,
            role: 'Unknown',
            avatar_url: null,
            status: 'inactive',
          }
        })) || [];
      }

      setAgents(channelAgentsWithData);

      // Fetch user's company_id
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch available agents from user's company only
      const { data: availableAgentsData, error: availableAgentsError } = await supabase
        .from('agents')
        .select('id, name, nickname, role, avatar_url, status')
        .eq('status', 'active')
        .eq('company_id', userProfile.company_id);

      if (availableAgentsError) throw availableAgentsError;
      setAvailableAgents(availableAgentsData || []);

      // Fetch company members
      await fetchCompanyMembers(membersWithProfiles);

    } catch (error) {
      console.error('Error fetching channel data:', error);
      toast({
        title: "Error",
        description: "Failed to load channel information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanyMembers = async (currentMembers: ChannelMember[] = members) => {
    if (!user || !channelId) return;

    try {
      // Get current user's company
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (profileError || !userProfile?.company_id) return;

      // Get all company members
      const { data: companyMembersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, role')
        .eq('company_id', userProfile.company_id);

      if (membersError) throw membersError;

      // Mark which members are already in the channel
      const channelMemberIds = currentMembers.map(m => m.user_id);
      const membersWithChannelStatus: CompanyMember[] = (companyMembersData || []).map(member => ({
        ...member,
        is_in_channel: channelMemberIds.includes(member.id)
      }));

      setCompanyMembers(membersWithChannelStatus);
    } catch (error) {
      console.error('Error fetching company members:', error);
    }
  };

  const updateChannel = async (updates: Partial<Channel>) => {
    if (!channel || userRole !== 'admin') return false;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('channels')
        .update(updates)
        .eq('id', channel.id);

      if (error) throw error;

      setChannel(prev => prev ? { ...prev, ...updates } : null);
      
      toast({
        title: "Success",
        description: "Channel updated successfully",
      });

      return true;
    } catch (error) {
      console.error('Error updating channel:', error);
      toast({
        title: "Error",
        description: "Failed to update channel",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const addMember = async (userId: string) => {
    if (!channel || userRole !== 'admin') return false;

    setIsUpdating(true);
    try {
      // Check if already a member
      const isAlreadyMember = members.some(m => m.user_id === userId);
      if (isAlreadyMember) {
        toast({
          title: "Error",
          description: "User is already a member of this channel",
          variant: "destructive",
        });
        return false;
      }

      // Fetch user profile first for optimistic update
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, role')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Add as member
      const { data: memberData, error } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channel.id,
          user_id: userId,
          role: 'member',
        })
        .select('id, user_id, role, joined_at')
        .single();

      if (error) throw error;

      // Optimistically update members state
      if (memberData && profileData) {
        const newMember: ChannelMember = {
          ...memberData,
          profiles: {
            first_name: profileData.first_name,
            last_name: profileData.last_name,
            email: profileData.email,
            avatar_url: profileData.avatar_url,
            role: profileData.role,
          }
        };
        setMembers(prev => [...prev, newMember]);
        
        // Update company members status
        await fetchCompanyMembers([...members, newMember]);
      }
      
      toast({
        title: "Success",
        description: "Member added successfully",
      });

      return true;
    } catch (error) {
      console.error('Error adding member:', error);
      toast({
        title: "Error",
        description: "Failed to add member",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (userRole !== 'admin') return false;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      // Optimistically update members state
      const updatedMembers = members.filter(m => m.id !== memberId);
      setMembers(updatedMembers);
      
      // Refresh company members status
      await fetchCompanyMembers(updatedMembers);
      
      toast({
        title: "Success",
        description: "Member removed from channel",
      });

      return true;
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleAgent = async (agentId: string) => {
    if (!channel || userRole !== 'admin') return false;

    const isCurrentlyAdded = agents.some(ca => ca.agent_id === agentId);
    
    // Optimistically update state
    let previousAgents = [...agents];
    
    if (isCurrentlyAdded) {
      // Optimistically remove agent from state
      setAgents(prev => prev.filter(ca => ca.agent_id !== agentId));
    } else {
      // Find agent info from availableAgents
      const agentInfo = availableAgents.find(a => a.id === agentId);
      if (agentInfo) {
        // Optimistically add agent to state
        const newChannelAgent: ChannelAgent = {
          id: '', // Will be set when fetched
          agent_id: agentId,
          added_at: new Date().toISOString(),
          agents: {
            name: agentInfo.name,
            nickname: agentInfo.nickname,
            role: agentInfo.role,
            avatar_url: agentInfo.avatar_url,
            status: agentInfo.status,
          }
        };
        setAgents(prev => [...prev, newChannelAgent]);
      }
    }

    setIsUpdating(true);
    try {
      if (isCurrentlyAdded) {
        // Remove agent
        const { error } = await supabase
          .from('channel_agents')
          .delete()
          .eq('channel_id', channel.id)
          .eq('agent_id', agentId);

        if (error) throw error;
      } else {
        // Add agent
        const { data, error } = await supabase
          .from('channel_agents')
          .insert({
            channel_id: channel.id,
            agent_id: agentId,
            added_by: user?.id,
          })
          .select('id, added_at')
          .single();

        if (error) throw error;

        // Update the optimistically added agent with real ID
        if (data && !isCurrentlyAdded) {
          const agentInfo = availableAgents.find(a => a.id === agentId);
          if (agentInfo) {
            setAgents(prev => prev.map(ca => 
              ca.agent_id === agentId && !ca.id
                ? { ...ca, id: data.id, added_at: data.added_at }
                : ca
            ));
          }
        }
      }
      
      toast({
        title: "Success",
        description: isCurrentlyAdded ? "Agent removed from channel" : "Agent added to channel",
      });

      return true;
    } catch (error) {
      // Rollback on error
      setAgents(previousAgents);
      console.error('Error toggling agent:', error);
      toast({
        title: "Error",
        description: "Failed to update agent assignment",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteChannel = async () => {
    if (!channel || userRole !== 'admin') return false;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', channel.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Channel deleted successfully",
      });

      return true;
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast({
        title: "Error",
        description: "Failed to delete channel",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const isAdmin = userRole === 'admin';
  const canManage = isAdmin;

  return {
    // Data
    channel,
    members,
    agents,
    availableAgents,
    companyMembers,
    userRole,
    
    // States
    isLoading,
    isUpdating,
    
    // Permissions
    isAdmin,
    canManage,
    
    // Actions
    updateChannel,
    addMember,
    removeMember,
    toggleAgent,
    deleteChannel,
    refetchData: fetchChannelData,
  };
}