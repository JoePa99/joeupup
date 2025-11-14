# Notification System Database Schema

## Overview
This document outlines the database schema for implementing a comprehensive notification system with member tagging capabilities, similar to Slack.

## Database Tables

### 1. notifications
Stores all notification records for users.

```sql
CREATE TABLE notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}', -- Additional context data
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 2. notification_types (Enum)
Defines the types of notifications available.

```sql
CREATE TYPE notification_type AS ENUM (
  'mention',           -- User was mentioned in a message
  'channel_message',   -- New message in a channel user is member of
  'channel_created',   -- User was added to a new channel
  'channel_updated',   -- Channel settings were updated
  'agent_response',    -- AI agent responded to a message
  'document_shared',   -- Document was shared in channel
  'playbook_updated',  -- Playbook was updated
  'system_alert'       -- System-wide alerts/announcements
);
```

### 3. message_mentions
Tracks which users were mentioned in which messages.

```sql
CREATE TABLE message_mentions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentioned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mention_position integer NOT NULL, -- Position in message where mention occurs
  created_at timestamptz DEFAULT now()
);
```

### 4. user_notification_settings
User preferences for different notification types.

```sql
CREATE TABLE user_notification_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  enabled boolean DEFAULT true,
  email_enabled boolean DEFAULT false,
  push_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, notification_type)
);
```

### 5. notification_reads
Tracks which notifications have been read by users.

```sql
CREATE TABLE notification_reads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notification_id, user_id)
);
```

## Indexes for Performance

```sql
-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_channel_id ON notifications(channel_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC) 
  WHERE id NOT IN (SELECT notification_id FROM notification_reads WHERE user_id = notifications.user_id);

-- Message mentions indexes
CREATE INDEX idx_message_mentions_message_id ON message_mentions(message_id);
CREATE INDEX idx_message_mentions_mentioned_user_id ON message_mentions(mentioned_user_id);

-- Notification reads indexes
CREATE INDEX idx_notification_reads_notification_id ON notification_reads(notification_id);
CREATE INDEX idx_notification_reads_user_id ON notification_reads(user_id);
```

## Row Level Security (RLS) Policies

### notifications
```sql
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" 
ON notifications FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" 
ON notifications FOR UPDATE 
USING (user_id = auth.uid());
```

### message_mentions
```sql
ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mentions in their company channels" 
ON message_mentions FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM chat_messages cm
  JOIN channels c ON c.id = cm.channel_id
  WHERE cm.id = message_mentions.message_id
  AND c.company_id = get_user_company_id()
));
```

### user_notification_settings
```sql
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification settings" 
ON user_notification_settings FOR ALL 
USING (user_id = auth.uid());
```

### notification_reads
```sql
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification reads" 
ON notification_reads FOR ALL 
USING (user_id = auth.uid());
```

## Helper Functions

### Get unread notification count
```sql
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM notifications n
    WHERE n.user_id = user_uuid
    AND n.id NOT IN (
      SELECT notification_id 
      FROM notification_reads 
      WHERE user_id = user_uuid
    )
  );
END;
$$;
```

### Mark notification as read
```sql
CREATE OR REPLACE FUNCTION mark_notification_read(notification_uuid uuid, user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notification_reads (notification_id, user_id)
  VALUES (notification_uuid, user_uuid)
  ON CONFLICT (notification_id, user_id) DO NOTHING;
END;
$$;
```

## Additional Useful Notification Types

### 1. Channel Activity Notifications
- **channel_created**: When user is added to a new channel
- **channel_updated**: When channel name/description changes
- **channel_archived**: When channel is archived
- **member_added**: When new member joins channel
- **member_removed**: When member leaves channel

### 2. Agent Activity Notifications
- **agent_response**: When AI agent responds to a message
- **agent_status_changed**: When agent status changes (active/inactive)
- **agent_tool_executed**: When agent executes a tool/action

### 3. Document & Content Notifications
- **document_shared**: When document is shared in channel
- **document_updated**: When shared document is updated
- **playbook_updated**: When playbook is modified
- **playbook_assigned**: When playbook is assigned to user

### 4. System Notifications
- **system_alert**: System-wide announcements
- **maintenance_notice**: Scheduled maintenance notifications
- **feature_announcement**: New feature releases
- **security_alert**: Security-related notifications

### 5. Integration Notifications
- **integration_connected**: When external service is connected
- **integration_error**: When integration fails
- **webhook_received**: When webhook is received from external service

## Real-time Subscriptions

The system will use Supabase real-time subscriptions to:
1. Listen for new notifications for the current user
2. Update notification counts in real-time
3. Show live notification toasts
4. Update notification center without page refresh

## Notification Data Structure

Each notification will include:
- **Basic Info**: type, title, message, timestamp
- **Context Data**: channel, message, agent, user references
- **Rich Data**: Additional context in JSONB format
- **Action Data**: URLs, navigation paths, action buttons

Example notification data:
```json
{
  "type": "mention",
  "title": "You were mentioned",
  "message": "John Doe mentioned you in #general",
  "data": {
    "channel_name": "general",
    "message_preview": "Hey @jane, can you review this?",
    "mentioned_by": "John Doe",
    "jump_url": "/channels/general?message=123"
  }
}
```
