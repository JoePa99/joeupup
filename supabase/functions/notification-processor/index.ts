import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'message_sent' | 'channel_created' | 'channel_updated' | 'member_added' | 'member_removed';
  data: {
    message_id?: string;
    channel_id?: string;
    user_id?: string;
    content?: string;
    [key: string]: any;
  };
}

interface ParsedMention {
  text: string;
  username: string;
  position: number;
  length: number;
}

// Parse mentions from message text
function parseMentions(text: string): ParsedMention[] {
  const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
  const mentions: ParsedMention[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      text: match[0],
      username: match[1],
      position: match.index,
      length: match[0].length
    });
  }

  return mentions;
}

// Get user by email or username
async function getUserByIdentifier(supabaseClient: any, identifier: string, companyId: string) {
  // First try email
  const { data: userByEmail } = await supabaseClient
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('email', identifier)
    .eq('company_id', companyId)
    .single();

  if (userByEmail) return userByEmail;

  // Then try first_name + last_name combination
  const nameParts = identifier.split('.');
  if (nameParts.length === 2) {
    const { data: userByName } = await supabaseClient
      .from('profiles')
      .select('id, email, first_name, last_name')
      .ilike('first_name', nameParts[0])
      .ilike('last_name', nameParts[1])
      .eq('company_id', companyId)
      .single();

    if (userByName) return userByName;
  }

  // Finally try email prefix (username part before @)
  const { data: usersByEmailPrefix } = await supabaseClient
    .from('profiles')
    .select('id, email, first_name, last_name')
    .like('email', `${identifier}@%`)
    .eq('company_id', companyId);

  return usersByEmailPrefix?.[0] || null;
}

// Send email notification
async function sendEmailNotification(
  supabaseClient: any,
  userId: string,
  notificationType: string,
  emailData: {
    recipientName: string;
    senderName: string;
    channelName: string;
    messagePreview: string;
    jumpUrl: string;
  }
) {
  try {
    // Check if user has email notifications enabled for this type
    const { data: settings } = await supabaseClient
      .from('user_notification_settings')
      .select('email_enabled')
      .eq('user_id', userId)
      .eq('notification_type', notificationType)
      .eq('enabled', true)
      .single();

    if (!settings?.email_enabled) {
      console.log(`Email notifications disabled for user ${userId} and type ${notificationType}`);
      return;
    }

    // Get user email
    const { data: user } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!user?.email) {
      console.log(`No email found for user ${userId}`);
      return;
    }

    // Call the send-email Edge Function
    const { error } = await supabaseClient.functions.invoke('send-email', {
      body: {
        type: 'notification',
        data: {
          notificationType,
          recipientEmail: user.email,
          recipientName: emailData.recipientName,
          senderName: emailData.senderName,
          channelName: emailData.channelName,
          messagePreview: emailData.messagePreview,
          jumpUrl: emailData.jumpUrl
        }
      }
    });

    if (error) {
      console.error('Error sending email notification:', error);
    } else {
      console.log(`Email notification sent to ${user.email} for ${notificationType}`);
    }
  } catch (error) {
    console.error('Error in sendEmailNotification:', error);
  }
}

// Create notification
async function createNotification(
  supabaseClient: any,
  userId: string,
  type: string,
  title: string,
  message: string,
  data: Record<string, any>,
  options: {
    channelId?: string;
    messageId?: string;
    agentId?: string;
    createdBy?: string;
  } = {}
) {
  const { error } = await supabaseClient
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      data,
      channel_id: options.channelId,
      message_id: options.messageId,
      agent_id: options.agentId,
      created_by: options.createdBy,
    });

  if (error) {
    console.error('Error creating notification:', error);
    throw error;
  }

  // Send email notification for all types
  await sendEmailNotification(supabaseClient, userId, type, {
    recipientName: data.recipient_name || 'User',
    senderName: data.sender_name || data.mentioned_by || data.updated_by || data.shared_by || data.added_by || 'Someone',
    channelName: data.channel_name || 'Unknown Channel',
    messagePreview: data.message_preview || message,
    jumpUrl: data.jump_url || '#',
    documentName: data.document_name,
    playbook_name: data.playbook_name,
    alertTitle: data.alert_title,
    memberName: data.member_name,
    integrationName: data.integration_name,
    errorMessage: data.error_message,
    webhookSource: data.webhook_source
  });
}

// Process mention notifications
async function processMentionNotifications(
  supabaseClient: any,
  messageId: string,
  channelId: string,
  content: string,
  mentionedBy: string,
  companyId: string
) {
  const mentions = parseMentions(content);
  if (mentions.length === 0) return;

  // Get channel info
  const { data: channel } = await supabaseClient
    .from('channels')
    .select('name')
    .eq('id', channelId)
    .single();

  // Get mentioner info
  const { data: mentioner } = await supabaseClient
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', mentionedBy)
    .single();

  const mentionerName = `${mentioner?.first_name || ''} ${mentioner?.last_name || ''}`.trim() || mentioner?.email || 'Someone';

  for (const mention of mentions) {
    // Find the mentioned user
    const mentionedUser = await getUserByIdentifier(supabaseClient, mention.username, companyId);
    
    if (!mentionedUser || mentionedUser.id === mentionedBy) {
      continue; // Skip if user not found or self-mention
    }

    // Check if user is a member of the channel
    const { data: membership } = await supabaseClient
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', mentionedUser.id)
      .single();

    if (!membership) {
      continue; // Skip if not a channel member
    }

    // Create mention record
    await supabaseClient
      .from('message_mentions')
      .insert({
        message_id: messageId,
        mentioned_user_id: mentionedUser.id,
        mentioned_by: mentionedBy,
        mention_position: mention.position,
      });

    // Create notification
    const messagePreview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    
    await createNotification(
      supabaseClient,
      mentionedUser.id,
      'mention',
      `You were mentioned by ${mentionerName}`,
      `"${messagePreview}"`,
      {
        channel_name: channel?.name || 'Unknown Channel',
        message_preview: messagePreview,
        mentioned_by: mentionerName,
        jump_url: `/channels/${channelId}?message=${messageId}`,
        recipient_name: `${mentionedUser.first_name || ''} ${mentionedUser.last_name || ''}`.trim() || mentionedUser.email || 'User',
        sender_name: mentionerName
      },
      {
        channelId,
        messageId,
        createdBy: mentionedBy
      }
    );
  }
}

// Process channel message notifications
async function processChannelMessageNotifications(
  supabaseClient: any,
  messageId: string,
  channelId: string,
  content: string,
  senderId: string,
  companyId: string,
  isFromAgent = false
) {
  // Get channel info and members
  const { data: channel } = await supabaseClient
    .from('channels')
    .select('name')
    .eq('id', channelId)
    .single();

  const { data: members } = await supabaseClient
    .from('channel_members')
    .select('user_id')
    .eq('channel_id', channelId)
    .neq('user_id', senderId); // Don't notify the sender

  if (!members || members.length === 0) return;

  // Get sender info
  const { data: sender } = await supabaseClient
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', senderId)
    .single();

  const senderName = `${sender?.first_name || ''} ${sender?.last_name || ''}`.trim() || sender?.email || 'Someone';
  const messagePreview = content.length > 100 ? content.substring(0, 100) + '...' : content;

  // Create notifications for all channel members
  for (const member of members) {
    const notificationType = isFromAgent ? 'agent_response' : 'channel_message';
    const title = isFromAgent 
      ? `AI Agent responded in #${channel?.name || 'channel'}`
      : `New message in #${channel?.name || 'channel'}`;

    // Get member info for email
    const { data: memberProfile } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', member.user_id)
      .single();

    const memberName = `${memberProfile?.first_name || ''} ${memberProfile?.last_name || ''}`.trim() || memberProfile?.email || 'User';

    // For agent responses, try to get the agent_id from the message
    let agentId = null;
    let jumpUrl = `/channels/${channelId}?message=${messageId}`;
    
    if (isFromAgent) {
      // Get the agent_id from the message if available
      const { data: messageData } = await supabaseClient
        .from('chat_messages')
        .select('agent_id')
        .eq('id', messageId)
        .single();
      
      if (messageData?.agent_id) {
        agentId = messageData.agent_id;
        jumpUrl = `/client-dashboard?agent=${agentId}`;
      }
    }

    await createNotification(
      supabaseClient,
      member.user_id,
      notificationType,
      title,
      `"${messagePreview}"`,
      {
        channel_name: channel?.name || 'Unknown Channel',
        message_preview: messagePreview,
        sender_name: senderName,
        jump_url: jumpUrl,
        recipient_name: memberName
      },
      {
        channelId,
        messageId,
        agentId: agentId || undefined,
        createdBy: senderId
      }
    );
  }
}

// Process channel created notifications
async function processChannelCreatedNotifications(
  supabaseClient: any,
  channelId: string,
  createdBy: string,
  companyId: string
) {
  // Get channel info
  const { data: channel } = await supabaseClient
    .from('channels')
    .select('name')
    .eq('id', channelId)
    .single();

  // Get channel members (excluding creator)
  const { data: members } = await supabaseClient
    .from('channel_members')
    .select('user_id')
    .eq('channel_id', channelId)
    .neq('user_id', createdBy);

  if (!members || members.length === 0) return;

  // Get creator info
  const { data: creator } = await supabaseClient
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', createdBy)
    .single();

  const creatorName = `${creator?.first_name || ''} ${creator?.last_name || ''}`.trim() || creator?.email || 'Someone';

  // Create notifications for all new members
  for (const member of members) {
    // Get member info for email
    const { data: memberProfile } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', member.user_id)
      .single();

    const memberName = `${memberProfile?.first_name || ''} ${memberProfile?.last_name || ''}`.trim() || memberProfile?.email || 'User';

    await createNotification(
      supabaseClient,
      member.user_id,
      'channel_created',
      `Added to #${channel?.name || 'new channel'}`,
      `You were added to #${channel?.name || 'channel'} by ${creatorName}`,
      {
        channel_name: channel?.name || 'Unknown Channel',
        added_by: creatorName,
        jump_url: `/channels/${channelId}`,
        recipient_name: memberName,
        sender_name: creatorName
      },
      {
        channelId,
        createdBy
      }
    );
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's company
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) {
      throw new Error('User profile not found');
    }

    const { type, data }: NotificationRequest = await req.json();

    switch (type) {
      case 'message_sent':
        if (!data.message_id || !data.channel_id || !data.content) {
          throw new Error('Missing required data for message_sent');
        }

        // Process mentions first
        await processMentionNotifications(
          supabaseClient,
          data.message_id,
          data.channel_id,
          data.content,
          data.user_id || user.id,
          profile.company_id
        );

        // Process general channel notifications (only if no mentions to avoid spam)
        const mentions = parseMentions(data.content);
        if (mentions.length === 0) {
          await processChannelMessageNotifications(
            supabaseClient,
            data.message_id,
            data.channel_id,
            data.content,
            data.user_id || user.id,
            profile.company_id,
            data.is_from_agent || false
          );
        }
        break;

      case 'channel_created':
        if (!data.channel_id) {
          throw new Error('Missing required data for channel_created');
        }

        await processChannelCreatedNotifications(
          supabaseClient,
          data.channel_id,
          data.user_id || user.id,
          profile.company_id
        );
        break;

      default:
        throw new Error(`Unsupported notification type: ${type}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Notification processing error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
