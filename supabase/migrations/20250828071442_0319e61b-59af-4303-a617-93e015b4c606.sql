-- Update function with proper security settings
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_company_id uuid,
  p_agent_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  similarity float,
  document_archive_id uuid,
  file_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    1 - (d.embedding <=> query_embedding) AS similarity,
    d.document_archive_id,
    da.file_name
  FROM documents d
  LEFT JOIN document_archives da ON d.document_archive_id = da.id
  WHERE d.company_id = p_company_id
    AND d.embedding IS NOT NULL
    AND (d.agent_id IS NULL OR d.agent_id = p_agent_id)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;