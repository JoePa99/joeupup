-- Create consultation_messages table for admin-client communication
CREATE TABLE public.consultation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_request_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'user')),
  sender_id UUID,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_document_request BOOLEAN NOT NULL DEFAULT false,
  is_note BOOLEAN NOT NULL DEFAULT false,
  is_private_note BOOLEAN NOT NULL DEFAULT false,
  documents_requested TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (consultation_request_id) REFERENCES public.consultation_requests(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for consultation messages
CREATE POLICY "Admins can manage all consultation messages" 
ON public.consultation_messages 
FOR ALL 
USING (get_user_role() = 'admin'::app_role);

CREATE POLICY "Users can view messages for their consultation requests" 
ON public.consultation_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.consultation_requests cr 
    WHERE cr.id = consultation_request_id 
    AND cr.user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages for their consultation requests" 
ON public.consultation_messages 
FOR INSERT 
WITH CHECK (
  sender_type = 'user' AND
  EXISTS (
    SELECT 1 FROM public.consultation_requests cr 
    WHERE cr.id = consultation_request_id 
    AND cr.user_id = auth.uid()
  )
);

-- Update consultation_requests status to use proper enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consultation_status') THEN
        CREATE TYPE consultation_status AS ENUM ('requested', 'in_progress', 'completed', 'on_hold');
    END IF;
END $$;

-- Update the consultation_requests table to use the enum
ALTER TABLE public.consultation_requests 
ALTER COLUMN status TYPE consultation_status USING status::consultation_status;