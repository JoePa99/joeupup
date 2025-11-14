-- Add OpenAI file tracking columns to agent_documents table
ALTER TABLE public.agent_documents 
ADD COLUMN openai_file_id text,
ADD COLUMN vector_store_file_id text,
ADD COLUMN added_at timestamp with time zone DEFAULT now();

-- Create index for faster lookups by OpenAI file ID
CREATE INDEX IF NOT EXISTS idx_agent_documents_openai_file_id ON public.agent_documents(openai_file_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_vector_store_file_id ON public.agent_documents(vector_store_file_id);
