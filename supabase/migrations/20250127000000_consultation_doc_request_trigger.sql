-- Create function to notify about document requests
CREATE OR REPLACE FUNCTION notify_document_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for document requests
  IF NEW.is_document_request = true THEN
    -- Insert into a notification queue table that the Edge Function will process
    INSERT INTO consultation_notifications (
      message_id,
      consultation_request_id,
      created_at
    ) VALUES (
      NEW.id,
      NEW.consultation_request_id,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create notification queue table
CREATE TABLE IF NOT EXISTS consultation_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES consultation_messages(id) ON DELETE CASCADE,
  consultation_request_id UUID NOT NULL REFERENCES consultation_requests(id) ON DELETE CASCADE,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on consultation_notifications
ALTER TABLE consultation_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for consultation_notifications (only service role can access)
CREATE POLICY "Service role can manage consultation notifications" 
ON consultation_notifications 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create trigger on consultation_messages
DROP TRIGGER IF EXISTS consultation_document_request_trigger ON consultation_messages;
CREATE TRIGGER consultation_document_request_trigger
  AFTER INSERT ON consultation_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_document_request();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_consultation_notifications_processed 
ON consultation_notifications(processed, created_at);
