-- Add client_message_id column to chat_messages table for deduplication
-- This allows the frontend to track optimistic messages and reconcile them with server responses

ALTER TABLE chat_messages 
ADD COLUMN client_message_id TEXT;

-- Add index for efficient lookups by client_message_id
CREATE INDEX idx_chat_messages_client_message_id ON chat_messages(client_message_id);

-- Add comment explaining the purpose
COMMENT ON COLUMN chat_messages.client_message_id IS 'Client-generated ID for optimistic UI updates and deduplication';
