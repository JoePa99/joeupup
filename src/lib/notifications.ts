// Notification types and utilities for the notification system
export type NotificationType = 
  | 'mention'           // User was mentioned in a message
  | 'channel_message'   // New message in a channel user is member of
  | 'channel_created'   // User was added to a new channel
  | 'channel_updated'   // Channel settings were updated
  | 'agent_response'    // AI agent responded to a message
  | 'document_shared'   // Document was shared in channel
  | 'playbook_updated'  // Playbook was updated
  | 'system_alert'      // System-wide alerts/announcements
  | 'member_added'      // New member joins channel
  | 'member_removed'    // Member leaves channel
  | 'integration_connected' // External service connected
  | 'integration_error'    // Integration fails
  | 'webhook_received';    // Webhook received from external service

export interface NotificationData {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  channel_id?: string;
  message_id?: string;
  agent_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  is_read?: boolean;
  read_at?: string;
}

export interface MessageMention {
  id: string;
  message_id: string;
  mentioned_user_id: string;
  mentioned_by: string;
  mention_position: number;
  created_at: string;
}

export interface UserNotificationSettings {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParsedMention {
  text: string;        // Full mention text (@username)
  username: string;    // Username without @
  position: number;    // Position in the message
  length: number;      // Length of the mention text
}

/**
 * Parse mentions from message text
 * Supports @username patterns
 */
export function parseMentions(text: string): ParsedMention[] {
  const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
  const mentions: ParsedMention[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      text: match[0],           // @username
      username: match[1],        // username
      position: match.index,     // Position in text
      length: match[0].length   // Length of mention
    });
  }

  return mentions;
}

/**
 * Extract usernames from mentions
 */
export function extractMentionedUsernames(text: string): string[] {
  const mentions = parseMentions(text);
  return mentions.map(m => m.username);
}

/**
 * Replace mentions in text with formatted display
 */
export function formatMentions(text: string): string {
  return text.replace(/@([a-zA-Z0-9._-]+)/g, '<span class="mention">@$1</span>');
}

/**
 * Check if text contains mentions
 */
export function hasMentions(text: string): boolean {
  return /@([a-zA-Z0-9._-]+)/.test(text);
}

/**
 * Get notification title based on type
 */
export function getNotificationTitle(type: NotificationType, data: Record<string, any>): string {
  switch (type) {
    case 'mention':
      return `You were mentioned by ${data.mentioned_by || 'someone'}`;
    case 'channel_message':
      return `New message in #${data.channel_name || 'channel'}`;
    case 'channel_created':
      return `Added to #${data.channel_name || 'new channel'}`;
    case 'channel_updated':
      return `#${data.channel_name || 'Channel'} was updated`;
    case 'agent_response':
      return `${data.agent_name || 'AI Agent'} responded`;
    case 'document_shared':
      return `Document shared in #${data.channel_name || 'channel'}`;
    case 'playbook_updated':
      return `Playbook "${data.playbook_name || 'Unknown'}" was updated`;
    case 'system_alert':
      return 'System Alert';
    case 'member_added':
      return `New member joined #${data.channel_name || 'channel'}`;
    case 'member_removed':
      return `Member left #${data.channel_name || 'channel'}`;
    case 'integration_connected':
      return `Integration "${data.integration_name || 'Unknown'}" connected`;
    case 'integration_error':
      return `Integration "${data.integration_name || 'Unknown'}" error`;
    case 'webhook_received':
      return `Webhook received from ${data.webhook_source || 'external service'}`;
    default:
      return 'Notification';
  }
}

/**
 * Get notification message based on type
 */
export function getNotificationMessage(type: NotificationType, data: Record<string, any>): string {
  switch (type) {
    case 'mention':
      return `"${data.message_preview || 'You were mentioned'}"`;
    case 'channel_message':
      return `"${data.message_preview || 'New message'}"`;
    case 'channel_created':
      return `You were added to #${data.channel_name || 'channel'} by ${data.added_by || 'someone'}`;
    case 'channel_updated':
      return `#${data.channel_name || 'Channel'} settings were updated by ${data.updated_by || 'someone'}`;
    case 'agent_response':
      return `"${data.message_preview || 'AI agent responded'}"`;
    case 'document_shared':
      return `"${data.document_name || 'Document'}" was shared by ${data.shared_by || 'someone'}`;
    case 'playbook_updated':
      return `"${data.playbook_name || 'Playbook'}" was updated by ${data.updated_by || 'someone'}`;
    case 'system_alert':
      return data.message || 'System notification';
    case 'member_added':
      return `${data.member_name || 'New member'} joined #${data.channel_name || 'channel'}`;
    case 'member_removed':
      return `${data.member_name || 'Member'} left #${data.channel_name || 'channel'}`;
    case 'integration_connected':
      return `Integration "${data.integration_name || 'Unknown'}" was successfully connected`;
    case 'integration_error':
      return `Error in integration "${data.integration_name || 'Unknown'}": ${data.error_message || 'Unknown error'}`;
    case 'webhook_received':
      return `Webhook received from ${data.webhook_source || 'external service'}`;
    default:
      return 'You have a new notification';
  }
}

/**
 * Get notification icon based on type
 */
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'mention':
      return 'at-sign';
    case 'channel_message':
      return 'message-square';
    case 'channel_created':
      return 'hash';
    case 'channel_updated':
      return 'settings';
    case 'agent_response':
      return 'bot';
    case 'document_shared':
      return 'file-text';
    case 'playbook_updated':
      return 'book-open';
    case 'system_alert':
      return 'alert-triangle';
    case 'member_added':
      return 'user-plus';
    case 'member_removed':
      return 'user-minus';
    case 'integration_connected':
      return 'link';
    case 'integration_error':
      return 'alert-circle';
    case 'webhook_received':
      return 'webhook';
    default:
      return 'bell';
  }
}

/**
 * Get notification color based on type
 */
export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'mention':
      return 'text-blue-600';
    case 'channel_message':
      return 'text-green-600';
    case 'channel_created':
      return 'text-purple-600';
    case 'channel_updated':
      return 'text-orange-600';
    case 'agent_response':
      return 'text-indigo-600';
    case 'document_shared':
      return 'text-gray-600';
    case 'playbook_updated':
      return 'text-teal-600';
    case 'system_alert':
      return 'text-red-600';
    case 'member_added':
      return 'text-emerald-600';
    case 'member_removed':
      return 'text-rose-600';
    case 'integration_connected':
      return 'text-cyan-600';
    case 'integration_error':
      return 'text-red-600';
    case 'webhook_received':
      return 'text-violet-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get notification priority based on type
 */
export function getNotificationPriority(type: NotificationType): 'low' | 'medium' | 'high' {
  switch (type) {
    case 'mention':
      return 'high';
    case 'system_alert':
      return 'high';
    case 'integration_error':
      return 'high';
    case 'agent_response':
      return 'medium';
    case 'channel_message':
      return 'medium';
    case 'document_shared':
      return 'medium';
    case 'playbook_updated':
      return 'medium';
    case 'channel_created':
      return 'low';
    case 'channel_updated':
      return 'low';
    case 'member_added':
      return 'low';
    case 'member_removed':
      return 'low';
    case 'integration_connected':
      return 'low';
    case 'webhook_received':
      return 'low';
    default:
      return 'medium';
  }
}

/**
 * Create notification data object
 */
export function createNotificationData(
  type: NotificationType,
  userId: string,
  data: Record<string, any>,
  options: {
    channelId?: string;
    messageId?: string;
    agentId?: string;
    createdBy?: string;
  } = {}
): Partial<NotificationData> {
  return {
    user_id: userId,
    type,
    title: getNotificationTitle(type, data),
    message: getNotificationMessage(type, data),
    data,
    channel_id: options.channelId,
    message_id: options.messageId,
    agent_id: options.agentId,
    created_by: options.createdBy,
  };
}
