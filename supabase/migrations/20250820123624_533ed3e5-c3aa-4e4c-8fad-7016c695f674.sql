-- Add OpenAI Assistant columns to agents table
ALTER TABLE agents 
ADD COLUMN assistant_id text,
ADD COLUMN vector_store_id text;

-- Update agents table to make pinecone_index_id nullable for migration
ALTER TABLE agents 
ALTER COLUMN pinecone_index_id DROP NOT NULL;