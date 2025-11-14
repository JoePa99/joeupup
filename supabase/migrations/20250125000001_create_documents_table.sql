-- Create Documents table for storing document content and embeddings
CREATE TABLE public.documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-ada-002 produces 1536-dimensional vectors
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    document_archive_id UUID REFERENCES public.document_archives(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_documents_company_id ON public.documents(company_id);
CREATE INDEX idx_documents_agent_id ON public.documents(agent_id);
CREATE INDEX idx_documents_document_archive_id ON public.documents(document_archive_id);
CREATE INDEX idx_documents_embedding ON public.documents USING ivfflat (embedding vector_cosine_ops);

-- RLS Policies
-- Users can view documents from their company
CREATE POLICY "Users can view documents from their company" 
ON public.documents FOR SELECT 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can insert documents for their company
CREATE POLICY "Users can insert documents for their company" 
ON public.documents FOR INSERT 
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can update documents from their company
CREATE POLICY "Users can update documents from their company" 
ON public.documents FOR UPDATE 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can delete documents from their company
CREATE POLICY "Users can delete documents from their company" 
ON public.documents FOR DELETE 
USING (
    company_id IN (
        SELECT company_id FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE public.documents IS 'Stores document content and OpenAI embeddings for AI agent access';
COMMENT ON COLUMN public.documents.embedding IS 'OpenAI text-embedding-ada-002 vector (1536 dimensions)';
COMMENT ON COLUMN public.documents.agent_id IS 'If NULL, document is accessible by all agents in the company';




