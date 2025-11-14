# Agent Message Notifications

## Overview

This system automatically creates notifications when AI agents send messages to users who are not currently active in the chat or channel. This ensures users don't miss important agent responses when they're away from the conversation.

## How It Works

### 1. User Presence Tracking

The system tracks user presence in real-time using the `user_presence` table:

- **Active**: User is currently viewing the chat/channel
- **Away**: User is not actively viewing the chat/channel
- **Timeout**: Users are automatically marked as away after 5 minutes of inactivity

### 2. Agent Message Detection

When an agent sends a message (saved with `role: 'assistant'` in `chat_messages`), a database trigger automatically:

1. Checks if the target user(s) are currently active in the chat/channel
2. Creates notifications only for users who are **not** active
3. Includes relevant context (agent name, message preview, navigation URL)

### 3. Notification Creation

Notifications are created with:
- **Type**: `agent_response`
- **Title**: "{Agent Name} responded in #{Channel Name}" or "{Agent Name} responded"
- **Message**: Preview of the agent's message (first 100 characters)
- **Data**: JSON containing agent name, channel name, message preview, and jump URL
- **Navigation**: Direct link to the chat/channel where the message was sent

## Database Schema

### Tables Added

#### `user_presence`
Tracks user activity in chats and channels:
```sql
CREATE TABLE user_presence (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  channel_id uuid REFERENCES channels(id),
  conversation_id uuid REFERENCES chat_conversations(id),
  is_active boolean DEFAULT true,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id, conversation_id)
);
```

#### `notifications` (if not exists)
Stores notification records:
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  channel_id uuid REFERENCES channels(id),
  message_id uuid REFERENCES chat_messages(id),
  agent_id uuid REFERENCES agents(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `notification_reads` (if not exists)
Tracks read status:
```sql
CREATE TABLE notification_reads (
  id uuid PRIMARY KEY,
  notification_id uuid REFERENCES notifications(id),
  user_id uuid REFERENCES profiles(id),
  read_at timestamptz DEFAULT now(),
  UNIQUE(notification_id, user_id)
);
```

### Functions

#### `create_agent_message_notification()`
Database trigger function that:
- Detects new agent messages (`role: 'assistant'`)
- Checks user presence for target users
- Creates notifications only for inactive users
- Handles both channel and direct conversation messages

#### `update_user_presence()`
Updates user presence to active:
```sql
SELECT update_user_presence(
  p_user_id := 'user-uuid',
  p_channel_id := 'channel-uuid', -- optional
  p_conversation_id := 'conversation-uuid' -- optional
);
```

#### `mark_user_away()`
Marks user as away:
```sql
SELECT mark_user_away(
  p_user_id := 'user-uuid',
  p_channel_id := 'channel-uuid', -- optional
  p_conversation_id := 'conversation-uuid' -- optional
);
```

## Frontend Integration

### React Hook: `useUserPresence`

```typescript
import { useUserPresence } from '@/hooks/useUserPresence';

function ChatComponent({ channelId, conversationId, agentId }) {
  const { startPresenceTracking, stopPresenceTracking } = useUserPresence({
    channelId,
    conversationId,
    agentId
  });

  useEffect(() => {
    // Start tracking when user enters chat
    startPresenceTracking();
    
    return () => {
      // Stop tracking when user leaves chat
      stopPresenceTracking();
    };
  }, [startPresenceTracking, stopPresenceTracking]);

  // ... rest of component
}
```

### Features

- **Automatic tracking**: Starts/stops based on chat context
- **Page visibility**: Handles browser tab focus/blur
- **Interval updates**: Keeps presence active every 2 minutes
- **Cleanup**: Automatically marks user as away on page unload

## Notification Center Integration

The notification center automatically displays agent response notifications with:

- **Agent icon**: Bot icon with indigo color
- **Message preview**: First 100 characters of agent response
- **Navigation**: Click to jump to the chat/channel
- **Channel context**: Shows channel name for channel messages
- **Real-time updates**: New notifications appear instantly

## Testing

### Manual Testing

1. **User Away Test**:
   - Open a chat/channel
   - Navigate away or close the tab
   - Have an agent send a message
   - Verify notification appears in notification center

2. **User Active Test**:
   - Stay active in a chat/channel
   - Have an agent send a message
   - Verify NO notification is created

3. **Navigation Test**:
   - Click on an agent response notification
   - Verify it navigates to the correct chat/channel

### Automated Testing

Use the test script:
```bash
node scripts/test-agent-notifications.js
```

Make sure to update the script with real user, channel, and agent IDs.

## Configuration

### Presence Timeout
Users are considered "away" after 5 minutes of inactivity. This can be adjusted in the trigger function:

```sql
-- In create_agent_message_notification() function
AND up.last_seen > now() - interval '5 minutes'
```

### Message Preview Length
Message previews are truncated to 100 characters. This can be adjusted:

```sql
-- In create_agent_message_notification() function
'message_preview', LEFT(NEW.content, 100)
```

### Presence Update Interval
Frontend updates presence every 2 minutes. This can be adjusted in `useUserPresence.ts`:

```typescript
// In useUserPresence hook
}, 2 * 60 * 1000); // 2 minutes
```

## Performance Considerations

### Database Indexes
The system includes optimized indexes for:
- User presence lookups
- Notification queries
- Message filtering

### Real-time Updates
- Uses Supabase real-time subscriptions
- Efficient presence tracking
- Minimal database queries

### Scalability
- Batch notification creation
- Efficient presence checks
- Optimized database triggers

## Security

### Row Level Security (RLS)
All tables have proper RLS policies:
- Users can only see their own notifications
- Users can only manage their own presence
- Company-scoped access control

### Data Privacy
- No sensitive data in notifications
- Message previews are truncated
- User presence is company-scoped

## Troubleshooting

### Common Issues

1. **Notifications not appearing**:
   - Check if user presence is being tracked
   - Verify database trigger is active
   - Check notification center subscription

2. **Too many notifications**:
   - Verify presence timeout settings
   - Check if users are being marked as away
   - Review presence update intervals

3. **Performance issues**:
   - Check database indexes
   - Monitor presence update frequency
   - Review notification query patterns

### Debug Queries

```sql
-- Check user presence
SELECT * FROM user_presence WHERE user_id = 'user-uuid';

-- Check recent notifications
SELECT * FROM notifications 
WHERE type = 'agent_response' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check trigger function
SELECT * FROM pg_trigger WHERE tgname = 'trigger_agent_message_notification';
```

## Future Enhancements

### Planned Features
1. **Notification preferences**: User settings for agent notifications
2. **Smart notifications**: AI-powered notification prioritization
3. **Mobile push**: Real push notifications for mobile apps
4. **Notification digest**: Daily/weekly summaries
5. **Custom rules**: User-defined notification triggers

### Integration Opportunities
1. **Email notifications**: Send agent responses via email
2. **Slack integration**: Forward to Slack channels
3. **Calendar integration**: Meeting reminders and updates
4. **Webhook support**: External notification services

