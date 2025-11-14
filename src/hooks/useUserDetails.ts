import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Company {
  id: string;
  name: string;
  domain: string | null;
  plan: string;
  logo_url: string | null;
  settings: any;
  created_at: string;
  updated_at: string;
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  created_by: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChannelWithRole {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  created_by: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  role: string;
  joined_at: string;
  member_count?: number;
  message_count?: number;
}

export interface DocumentWithDetails {
  id: string;
  name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  doc_type: string;
  created_at: string;
  company_id: string;
  company?: {
    name: string;
  };
}

export interface ActivityItem {
  id: string;
  type: 'message' | 'document' | 'channel_join' | 'channel_create' | 'login';
  title: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

export interface UserDetails {
  // Profile fields
  id: string;
  company_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  settings: any;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  
  company?: Company;
  
  // Metrics
  total_messages: number;
  total_documents: number;
  channels_joined_count: number;
  channels_created_count: number;
  
  // Detailed data
  channels_joined: ChannelWithRole[];
  channels_created: Channel[];
  documents: DocumentWithDetails[];
  
  // Engagement
  recent_activity: ActivityItem[];
  is_online: boolean;
  last_seen_display: string;
  member_since: string;
  
  // Activity metrics
  avg_messages_per_day: number;
  most_active_channel?: {
    id: string;
    name: string;
    message_count: number;
  };
}

export function useUserDetails(userId: string) {
  return useQuery({
    queryKey: ['user-details', userId],
    queryFn: async (): Promise<UserDetails> => {
      // Fetch user profile with company info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (!profile) throw new Error('User not found');

      // Fetch all related data in parallel
      const [
        { data: messageCounts, error: messageError },
        { data: documents, error: documentsError },
        { data: channelsJoined, error: channelsJoinedError },
        { data: channelsCreated, error: channelsCreatedError },
        { data: conversations, error: conversationsError }
      ] = await Promise.all([
        // Count messages from conversations user is part of
        supabase
          .from('chat_messages')
          .select('id, created_at, conversation_id, channel_id', { count: 'exact', head: false })
          .or(`conversation_id.in.(${await getUserConversationIds(userId)}),channel_id.in.(${await getUserChannelIds(userId)})`)
          .order('created_at', { ascending: false })
          .limit(100),
        
        // Get documents uploaded by user
        supabase
          .from('document_archives')
          .select(`
            id,
            name,
            file_name,
            file_type,
            file_size,
            doc_type,
            created_at,
            company_id,
            company:companies(name)
          `)
          .eq('uploaded_by', userId)
          .order('created_at', { ascending: false }),
        
        // Get channels user is a member of
        supabase
          .from('channel_members')
          .select(`
            role,
            joined_at,
            channel:channels(*)
          `)
          .eq('user_id', userId),
        
        // Get channels user created
        supabase
          .from('channels')
          .select('*')
          .eq('created_by', userId)
          .order('created_at', { ascending: false }),
        
        // Get user's conversations
        supabase
          .from('chat_conversations')
          .select('id, created_at, agent_id, title')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ]);

      if (messageError) console.error('Error fetching messages:', messageError);
      if (documentsError) throw documentsError;
      if (channelsJoinedError) throw channelsJoinedError;
      if (channelsCreatedError) throw channelsCreatedError;
      if (conversationsError) console.error('Error fetching conversations:', conversationsError);

      // Process channels joined with additional details
      const channelsJoinedWithDetails: ChannelWithRole[] = await Promise.all(
        (channelsJoined || []).map(async (cm: any) => {
          const channel = cm.channel;
          
          // Get member count for this channel
          const { count: memberCount } = await supabase
            .from('channel_members')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', channel.id);
          
          // Get message count for this channel
          const { count: messageCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', channel.id);

          return {
            ...channel,
            role: cm.role,
            joined_at: cm.joined_at,
            member_count: memberCount || 0,
            message_count: messageCount || 0
          };
        })
      );

      // Calculate metrics
      const totalMessages = messageCounts?.length || 0;
      const totalDocuments = documents?.length || 0;
      const channelsJoinedCount = channelsJoined?.length || 0;
      const channelsCreatedCount = channelsCreated?.length || 0;

      // Calculate average messages per day
      const accountAge = Math.max(1, Math.floor(
        (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
      ));
      const avgMessagesPerDay = Math.round((totalMessages / accountAge) * 10) / 10;

      // Find most active channel
      const mostActiveChannel = channelsJoinedWithDetails.length > 0
        ? channelsJoinedWithDetails.reduce((prev, current) => 
            (current.message_count || 0) > (prev.message_count || 0) ? current : prev
          )
        : undefined;

      // Build activity timeline
      const activities: ActivityItem[] = [];

      // Add message activities (sample from recent)
      if (messageCounts && messageCounts.length > 0) {
        const recentMessages = messageCounts.slice(0, 10);
        recentMessages.forEach((msg: any) => {
          activities.push({
            id: `msg-${msg.id}`,
            type: 'message',
            title: 'Sent a message',
            description: msg.channel_id ? 'In a channel' : 'In a conversation',
            timestamp: msg.created_at,
            metadata: { message_id: msg.id }
          });
        });
      }

      // Add document upload activities
      documents?.forEach((doc) => {
        activities.push({
          id: `doc-${doc.id}`,
          type: 'document',
          title: `Uploaded ${doc.name}`,
          description: `${doc.doc_type} document`,
          timestamp: doc.created_at,
          metadata: { document_id: doc.id }
        });
      });

      // Add channel creation activities
      channelsCreated?.forEach((channel) => {
        activities.push({
          id: `create-${channel.id}`,
          type: 'channel_create',
          title: `Created channel #${channel.name}`,
          description: channel.description || 'No description',
          timestamp: channel.created_at,
          metadata: { channel_id: channel.id }
        });
      });

      // Add channel join activities
      channelsJoined?.forEach((cm: any) => {
        activities.push({
          id: `join-${cm.channel.id}`,
          type: 'channel_join',
          title: `Joined channel #${cm.channel.name}`,
          description: `As ${cm.role}`,
          timestamp: cm.joined_at,
          metadata: { channel_id: cm.channel.id }
        });
      });

      // Add login activity
      if (profile.last_login_at) {
        activities.push({
          id: `login-${profile.last_login_at}`,
          type: 'login',
          title: 'Logged in',
          description: 'User activity',
          timestamp: profile.last_login_at,
          metadata: {}
        });
      }

      // Sort activities by timestamp (most recent first)
      activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Calculate online status
      const lastLoginDate = profile.last_login_at ? new Date(profile.last_login_at) : null;
      const now = new Date();
      const isOnline = lastLoginDate 
        ? (now.getTime() - lastLoginDate.getTime()) < 5 * 60 * 1000 // 5 minutes
        : false;
      
      const lastSeenDisplay = getLastSeenDisplay(lastLoginDate);
      const memberSince = formatMemberSince(new Date(profile.created_at));

      return {
        ...profile,
        company: (profile as any).company,
        total_messages: totalMessages,
        total_documents: totalDocuments,
        channels_joined_count: channelsJoinedCount,
        channels_created_count: channelsCreatedCount,
        channels_joined: channelsJoinedWithDetails,
        channels_created: channelsCreated || [],
        documents: documents as DocumentWithDetails[] || [],
        recent_activity: activities.slice(0, 50), // Limit to 50 most recent
        is_online: isOnline,
        last_seen_display: lastSeenDisplay,
        member_since: memberSince,
        avg_messages_per_day: avgMessagesPerDay,
        most_active_channel: mostActiveChannel ? {
          id: mostActiveChannel.id,
          name: mostActiveChannel.name,
          message_count: mostActiveChannel.message_count || 0
        } : undefined
      };
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Helper function to get conversation IDs for a user
async function getUserConversationIds(userId: string): Promise<string> {
  const { data } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('user_id', userId);
  
  return data && data.length > 0 
    ? data.map(c => c.id).join(',')
    : 'null'; // Return 'null' string to avoid SQL error
}

// Helper function to get channel IDs for a user
async function getUserChannelIds(userId: string): Promise<string> {
  const { data } = await supabase
    .from('channel_members')
    .select('channel_id')
    .eq('user_id', userId);
  
  return data && data.length > 0
    ? data.map(c => c.channel_id).join(',')
    : 'null'; // Return 'null' string to avoid SQL error
}

// Helper function to format last seen display
function getLastSeenDisplay(lastLoginDate: Date | null): string {
  if (!lastLoginDate) return 'Never logged in';
  
  const now = new Date();
  const diffMs = now.getTime() - lastLoginDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 5) return 'Online now';
  if (diffMinutes < 60) return 'Recently active';
  if (diffHours < 1) return 'Active less than an hour ago';
  if (diffHours < 24) return `Active ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `Active ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return `Last seen ${lastLoginDate.toLocaleDateString()}`;
}

// Helper function to format member since
function formatMemberSince(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffDays < 1) return 'Member since today';
  if (diffDays < 30) return `Member for ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  if (diffMonths < 12) return `Member for ${diffMonths} month${diffMonths > 1 ? 's' : ''}`;
  return `Member for ${diffYears} year${diffYears > 1 ? 's' : ''}`;
}

