// Test script for agent message notifications
// This script helps test the agent notification system

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAgentNotification() {
  console.log('🧪 Testing Agent Message Notification System...\n');

  try {
    // 1. Create a test user presence (simulate user being away)
    console.log('1. Creating test user presence (user away)...');
    const { data: presenceData, error: presenceError } = await supabase
      .from('user_presence')
      .insert({
        user_id: 'test-user-id', // Replace with actual user ID
        channel_id: 'test-channel-id', // Replace with actual channel ID
        is_active: false,
        last_seen: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
      });

    if (presenceError) {
      console.error('❌ Error creating user presence:', presenceError);
    } else {
      console.log('✅ User presence created (user is away)');
    }

    // 2. Create a test agent message
    console.log('\n2. Creating test agent message...');
    const { data: messageData, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: null,
        channel_id: 'test-channel-id', // Replace with actual channel ID
        role: 'assistant',
        content: 'Hello! This is a test message from the AI agent.',
        message_type: 'channel',
        agent_id: 'test-agent-id' // Replace with actual agent ID
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Error creating agent message:', messageError);
    } else {
      console.log('✅ Agent message created:', messageData.id);
    }

    // 3. Check if notification was created
    console.log('\n3. Checking for notifications...');
    const { data: notifications, error: notificationError } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'agent_response')
      .order('created_at', { ascending: false })
      .limit(5);

    if (notificationError) {
      console.error('❌ Error fetching notifications:', notificationError);
    } else {
      console.log('✅ Notifications found:', notifications.length);
      notifications.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title}`);
        console.log(`      Message: ${notification.message}`);
        console.log(`      Channel: ${notification.channel_id}`);
        console.log(`      Agent: ${notification.agent_id}`);
        console.log(`      Created: ${notification.created_at}`);
        console.log('');
      });
    }

    // 4. Test user presence update (simulate user coming back)
    console.log('4. Updating user presence (user active)...');
    const { error: updateError } = await supabase
      .from('user_presence')
      .update({
        is_active: true,
        last_seen: new Date().toISOString()
      })
      .eq('user_id', 'test-user-id')
      .eq('channel_id', 'test-channel-id');

    if (updateError) {
      console.error('❌ Error updating user presence:', updateError);
    } else {
      console.log('✅ User presence updated (user is active)');
    }

    // 5. Create another agent message (should NOT create notification since user is active)
    console.log('\n5. Creating another agent message (user is active)...');
    const { data: messageData2, error: messageError2 } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: null,
        channel_id: 'test-channel-id',
        role: 'assistant',
        content: 'This message should NOT trigger a notification since user is active.',
        message_type: 'channel',
        agent_id: 'test-agent-id'
      })
      .select()
      .single();

    if (messageError2) {
      console.error('❌ Error creating second agent message:', messageError2);
    } else {
      console.log('✅ Second agent message created:', messageData2.id);
    }

    // 6. Check notification count (should be the same as before)
    console.log('\n6. Checking notification count after second message...');
    const { data: notifications2, error: notificationError2 } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'agent_response')
      .order('created_at', { ascending: false })
      .limit(5);

    if (notificationError2) {
      console.error('❌ Error fetching notifications:', notificationError2);
    } else {
      console.log('✅ Notifications after second message:', notifications2.length);
      if (notifications2.length === notifications.length) {
        console.log('✅ SUCCESS: No new notification created when user is active');
      } else {
        console.log('❌ FAIL: New notification was created when user is active');
      }
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAgentNotification();

