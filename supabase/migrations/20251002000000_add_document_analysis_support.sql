-- Add support for document_analysis content type
-- This migration ensures the chat_messages table can properly store document analysis data

-- Update the content_type column to include document_analysis if it's constrained
-- Note: If content_type is already unconstrained text, this is just for documentation

-- Add index for faster queries on document analysis messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_document_analysis 
ON chat_messages(content_type) 
WHERE content_type = 'document_analysis';

-- Add index on content_metadata for AI provider queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_metadata_provider
ON chat_messages USING GIN (content_metadata)
WHERE content_metadata ? 'aiProvider';

-- Add comment to document the new content type
COMMENT ON COLUMN chat_messages.content_type IS 
'Type of content in the message. Valid values: text, image_generation, web_research, document_analysis, mixed';

-- Add comment to document the rich_content structure for document analysis
COMMENT ON COLUMN chat_messages.rich_content IS 
'Rich content object containing structured data. For document_analysis type, includes: 
{
  "title": "Analysis title",
  "content": "Formatted markdown content",
  "outline": ["Heading 1", "Heading 2"],
  "documentSource": "original_filename.pdf",
  "structuredAnalysis": {
    "executiveSummary": "...",
    "keyFindings": [],
    "mainThemes": [],
    "importantDataPoints": [],
    "recommendations": [],
    "detailedAnalysis": "...",
    "documentType": "...",
    "confidenceScore": 0.85
  },
  "aiProvider": "openai|google|anthropic",
  "aiModel": "model-name",
  "generatedAt": "ISO timestamp",
  "wordCount": 1234
}';

-- Add comment to document content_metadata for document analysis
COMMENT ON COLUMN chat_messages.content_metadata IS 
'Metadata about the message content. For document_analysis type, includes:
{
  "status": "completed|generating|error",
  "documentName": "filename.pdf",
  "generatedAt": "ISO timestamp",
  "wordCount": 1234,
  "aiProvider": "openai|google|anthropic",
  "aiModel": "model-name",
  "confidenceScore": 0.85
}';

