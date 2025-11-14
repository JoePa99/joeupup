// Test script for consultation document request emailer
// This script can be run to test the Edge Function manually

const testNotification = {
  message_id: "test-message-id",
  consultation_request_id: "test-request-id",
  processed: false,
  created_at: new Date().toISOString()
};

console.log('Test notification data:', JSON.stringify(testNotification, null, 2));

// To test this:
// 1. Insert a test notification into consultation_notifications table
// 2. Call the consultation-doc-request-emailer Edge Function
// 3. Check that emails are sent to company admins

console.log(`
To test the consultation document request emailer:

1. Insert test data into consultation_notifications table:
   INSERT INTO consultation_notifications (message_id, consultation_request_id, processed)
   VALUES ('test-message-id', 'test-request-id', false);

2. Call the Edge Function:
   curl -X POST 'https://your-project.supabase.co/functions/v1/consultation-doc-request-emailer' \\
     -H 'Authorization: Bearer YOUR_ANON_KEY' \\
     -H 'Content-Type: application/json'

3. Check the logs and verify emails are sent to company admins.

Note: Make sure you have:
- A consultation_requests record with the test-request-id
- A consultation_messages record with the test-message-id and is_document_request=true
- Company admins in the profiles table with role='admin'
- RESEND_API_KEY environment variable set in the Edge Function
`);
