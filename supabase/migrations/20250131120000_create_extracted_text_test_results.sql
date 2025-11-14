-- Create table for testing extracted text results
CREATE TABLE IF NOT EXISTS public.extracted_text_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT,
    extracted_text TEXT,
    assistant_response TEXT,
    openai_file_id TEXT,
    openai_thread_id TEXT,
    openai_run_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_extracted_text_test_results_created_at 
ON public.extracted_text_test_results(created_at DESC);

-- Enable RLS
ALTER TABLE public.extracted_text_test_results ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert/select (for testing)
CREATE POLICY "Service role can manage test results"
ON public.extracted_text_test_results
FOR ALL
USING (true)
WITH CHECK (true);



