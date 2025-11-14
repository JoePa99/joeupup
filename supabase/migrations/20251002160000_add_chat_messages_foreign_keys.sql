-- Add missing foreign key relationships for chat_messages table

-- Add foreign key for user_id if the column exists
DO $$ 
BEGIN
    -- Check if user_id column exists before adding foreign key
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' 
        AND column_name = 'user_id'
    ) THEN
        -- Add foreign key constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'chat_messages_user_id_fkey'
            AND table_name = 'chat_messages'
        ) THEN
            ALTER TABLE public.chat_messages
            ADD CONSTRAINT chat_messages_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id ON public.chat_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON public.chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);

