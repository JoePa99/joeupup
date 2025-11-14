import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TeamMemberActivity {
  id: string;
  type: 'message' | 'document' | 'channel_join';
  description: string;
  timestamp: string;
}

interface ChannelMembership {
  id: string;
  name: string;
  role: string;
  joined_at: string;
}

interface TeamMemberDetails {
  channels: ChannelMembership[];
  messageCount: number;
  lastActivity: string | null;
  recentActivities: TeamMemberActivity[];
  isLoading: boolean;
}

export function useTeamMemberDetails(userId: string | null, companyId: string | null) {
  const [details, setDetails] = useState<TeamMemberDetails>({
    channels: [],
    messageCount: 0,
    lastActivity: null,
    recentActivities: [],
    isLoading: true,
  });

  useEffect(() => {
    if (!userId || !companyId) {
      setDetails({
        channels: [],
        messageCount: 0,
        lastActivity: null,
        recentActivities: [],
        isLoading: false,
      });
      return;
    }

    fetchMemberDetails();
  }, [userId, companyId]);

  const fetchMemberDetails = async () => {
    if (!userId || !companyId) return;

    try {
      setDetails(prev => ({ ...prev, isLoading: true }));

      // Fetch channels the user is a member of
      const { data: channelMemberships, error: channelsError } = await supabase
        .from('channel_members')
        .select(`
          id,
          role,
          joined_at,
          channel_id,
          channels:channel_id (
            id,
            name
          )
        `)
        .eq('user_id', userId);

      if (channelsError) throw channelsError;

      const channels: ChannelMembership[] = (channelMemberships || [])
        .filter(cm => cm.channels)
        .map(cm => ({
          id: (cm.channels as any).id,
          name: (cm.channels as any).name,
          role: cm.role,
          joined_at: cm.joined_at,
        }));

      // First, fetch user's conversations
      const { data: conversations, error: conversationsError } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('user_id', userId);

      if (conversationsError) {
        console.error('Error fetching conversations:', conversationsError);
      }

      const conversationIds = (conversations || []).map(c => c.id);

      let messageCount = 0;
      let recentMessages: any[] = [];

      // Only fetch messages if user has conversations
      if (conversationIds.length > 0) {
        // Fetch message count for user's messages in their conversations
        const { count, error: messagesError } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .eq('role', 'user');

        if (messagesError) {
          console.error('Error fetching message count:', messagesError);
        } else {
          messageCount = count || 0;
        }

        // Fetch recent messages
        const { data, error: recentMessagesError } = await supabase
          .from('chat_messages')
          .select('id, content, created_at, conversation_id')
          .in('conversation_id', conversationIds)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentMessagesError) {
          console.error('Error fetching recent messages:', recentMessagesError);
        } else {
          recentMessages = data || [];
        }
      }

      const recentActivities: TeamMemberActivity[] = recentMessages.map(msg => ({
        id: msg.id,
        type: 'message' as const,
        description: msg.content.length > 50 ? `${msg.content.substring(0, 50)}...` : msg.content,
        timestamp: msg.created_at,
      }));

      // Get last activity timestamp
      const lastActivity = recentActivities.length > 0 ? recentActivities[0].timestamp : null;

      setDetails({
        channels,
        messageCount,
        lastActivity,
        recentActivities,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching team member details:', error);
      setDetails({
        channels: [],
        messageCount: 0,
        lastActivity: null,
        recentActivities: [],
        isLoading: false,
      });
    }
  };

  return details;
}

