-- Add consultation messages table for admin-user communication
CREATE TABLE public.consultation_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_request_id UUID NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'user')),
    sender_id UUID NULL,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_document_request BOOLEAN DEFAULT false,
    is_note BOOLEAN DEFAULT false,
    is_private_note BOOLEAN DEFAULT false,
    documents_requested TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add consultation documents table
CREATE TABLE public.consultation_documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_request_id UUID NOT NULL,
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    uploaded_by UUID NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add status column to consultation_requests if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consultation_requests' AND column_name='status') THEN
        ALTER TABLE public.consultation_requests ADD COLUMN status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'in_progress', 'completed', 'on_hold'));
    END IF;
END $$;

-- Add consultation progress tracking
CREATE TABLE public.consultation_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    consultation_request_id UUID NOT NULL,
    current_step INTEGER DEFAULT 1,
    step_name TEXT NOT NULL,
    step_description TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(consultation_request_id, current_step)
);

-- Create indexes for performance
CREATE INDEX idx_consultation_messages_consultation_id ON public.consultation_messages(consultation_request_id);
CREATE INDEX idx_consultation_messages_created_at ON public.consultation_messages(created_at);
CREATE INDEX idx_consultation_documents_consultation_id ON public.consultation_documents(consultation_request_id);
CREATE INDEX idx_consultation_progress_consultation_id ON public.consultation_progress(consultation_request_id);

-- Add foreign key constraints
ALTER TABLE public.consultation_messages 
ADD CONSTRAINT fk_consultation_messages_request 
FOREIGN KEY (consultation_request_id) REFERENCES public.consultation_requests(id) ON DELETE CASCADE;

ALTER TABLE public.consultation_documents 
ADD CONSTRAINT fk_consultation_documents_request 
FOREIGN KEY (consultation_request_id) REFERENCES public.consultation_requests(id) ON DELETE CASCADE;

ALTER TABLE public.consultation_progress 
ADD CONSTRAINT fk_consultation_progress_request 
FOREIGN KEY (consultation_request_id) REFERENCES public.consultation_requests(id) ON DELETE CASCADE;

-- Add RLS policies for consultation messages
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;

-- Users can read all messages for their consultation requests (excluding private admin notes)
CREATE POLICY "Users can read their consultation messages" 
ON public.consultation_messages FOR SELECT 
USING (
    consultation_request_id IN (
        SELECT id FROM public.consultation_requests WHERE user_id = auth.uid()
    ) 
    AND (is_private_note = false OR sender_type = 'user')
);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own messages" 
ON public.consultation_messages FOR INSERT 
WITH CHECK (
    consultation_request_id IN (
        SELECT id FROM public.consultation_requests WHERE user_id = auth.uid()
    )
    AND sender_type = 'user'
);

-- Admins can read and insert all consultation messages
CREATE POLICY "Admins can manage all consultation messages" 
ON public.consultation_messages FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Add RLS policies for consultation documents
ALTER TABLE public.consultation_documents ENABLE ROW LEVEL SECURITY;

-- Users can read and insert documents for their consultation requests
CREATE POLICY "Users can manage their consultation documents" 
ON public.consultation_documents FOR ALL 
USING (
    consultation_request_id IN (
        SELECT id FROM public.consultation_requests WHERE user_id = auth.uid()
    )
);

-- Admins can read and manage all consultation documents
CREATE POLICY "Admins can manage all consultation documents" 
ON public.consultation_documents FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Add RLS policies for consultation progress
ALTER TABLE public.consultation_progress ENABLE ROW LEVEL SECURITY;

-- Users can read progress for their consultation requests
CREATE POLICY "Users can read their consultation progress" 
ON public.consultation_progress FOR SELECT 
USING (
    consultation_request_id IN (
        SELECT id FROM public.consultation_requests WHERE user_id = auth.uid()
    )
);

-- Admins can manage all consultation progress
CREATE POLICY "Admins can manage all consultation progress" 
ON public.consultation_progress FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Create storage bucket for consultation documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('consultation-documents', 'consultation-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Add storage policies for consultation documents bucket
CREATE POLICY "Users can upload consultation documents" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'consultation-documents' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can read consultation documents" 
ON storage.objects FOR SELECT 
USING (
    bucket_id = 'consultation-documents' 
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Admins can manage all consultation documents" 
ON storage.objects FOR ALL 
USING (
    bucket_id = 'consultation-documents' 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

