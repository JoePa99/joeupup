-- Create SQL functions for vector search and context retrieval
-- These functions are used by the context injection system

-- Function: Match agent documents by vector similarity
CREATE OR REPLACE FUNCTION match_agent_documents(
  query_embedding vector(1536),
  match_agent_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  agent_id UUID,
  content TEXT,
  title TEXT,
  source_file_name TEXT,
  similarity FLOAT,
  chunk_index INT,
  total_chunks INT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    agent_documents.id,
    agent_documents.agent_id,
    agent_documents.content,
    agent_documents.title,
    agent_documents.source_file_name,
    1 - (agent_documents.embedding <=> query_embedding) AS similarity,
    agent_documents.chunk_index,
    agent_documents.total_chunks,
    agent_documents.metadata,
    agent_documents.created_at
  FROM agent_documents
  WHERE agent_documents.agent_id = match_agent_id
    AND agent_documents.embedding IS NOT NULL
    AND 1 - (agent_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY agent_documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: Match shared documents (company-wide, not agent-specific)
CREATE OR REPLACE FUNCTION match_shared_documents(
  query_embedding vector(1536),
  match_company_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.company_id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) AS similarity,
    JSONB_BUILD_OBJECT(
      'document_archive_id', documents.document_archive_id,
      'agent_id', documents.agent_id
    ) AS metadata,
    documents.created_at
  FROM documents
  WHERE documents.company_id = match_company_id
    AND documents.agent_id IS NULL  -- Only shared docs (not agent-specific)
    AND documents.embedding IS NOT NULL
    AND 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: Search playbooks by full-text search
CREATE OR REPLACE FUNCTION search_playbooks(
  search_query TEXT,
  match_company_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  section_order INT,
  tags TEXT[],
  relevance FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    playbook_sections.id,
    playbook_sections.title,
    playbook_sections.content,
    playbook_sections.section_order,
    playbook_sections.tags,
    ts_rank(
      to_tsvector('english', COALESCE(playbook_sections.title, '') || ' ' || COALESCE(playbook_sections.content, '')),
      plainto_tsquery('english', search_query)
    ) AS relevance
  FROM playbook_sections
  WHERE playbook_sections.company_id = match_company_id
    AND playbook_sections.status = 'complete'
    AND (
      to_tsvector('english', COALESCE(playbook_sections.title, '') || ' ' || COALESCE(playbook_sections.content, ''))
      @@ plainto_tsquery('english', search_query)
    )
  ORDER BY relevance DESC
  LIMIT match_count;
END;
$$;

-- Function: Keyword search across all text sources
CREATE OR REPLACE FUNCTION keyword_search_all_sources(
  search_query TEXT,
  match_company_id UUID,
  match_agent_id UUID DEFAULT NULL,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  source TEXT,  -- 'agent_docs', 'shared_docs', 'playbooks'
  content TEXT,
  title TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Agent documents
  SELECT
    agent_documents.id,
    'agent_docs'::TEXT AS source,
    agent_documents.content,
    agent_documents.title,
    ts_rank(
      to_tsvector('english', COALESCE(agent_documents.title, '') || ' ' || COALESCE(agent_documents.content, '')),
      plainto_tsquery('english', search_query)
    ) AS relevance
  FROM agent_documents
  WHERE agent_documents.company_id = match_company_id
    AND (match_agent_id IS NULL OR agent_documents.agent_id = match_agent_id)
    AND to_tsvector('english', COALESCE(agent_documents.title, '') || ' ' || COALESCE(agent_documents.content, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  -- Shared documents
  SELECT
    documents.id,
    'shared_docs'::TEXT AS source,
    documents.content,
    COALESCE(
      (SELECT document_archives.file_name FROM document_archives WHERE document_archives.id = documents.document_archive_id),
      'Untitled'
    ) AS title,
    ts_rank(
      to_tsvector('english', documents.content),
      plainto_tsquery('english', search_query)
    ) AS relevance
  FROM documents
  WHERE documents.company_id = match_company_id
    AND documents.agent_id IS NULL
    AND to_tsvector('english', documents.content) @@ plainto_tsquery('english', search_query)

  UNION ALL

  -- Playbooks
  SELECT
    playbook_sections.id,
    'playbooks'::TEXT AS source,
    playbook_sections.content,
    playbook_sections.title,
    ts_rank(
      to_tsvector('english', COALESCE(playbook_sections.title, '') || ' ' || COALESCE(playbook_sections.content, '')),
      plainto_tsquery('english', search_query)
    ) AS relevance
  FROM playbook_sections
  WHERE playbook_sections.company_id = match_company_id
    AND playbook_sections.status = 'complete'
    AND to_tsvector('english', COALESCE(playbook_sections.title, '') || ' ' || COALESCE(playbook_sections.content, ''))
        @@ plainto_tsquery('english', search_query)

  ORDER BY relevance DESC
  LIMIT match_count;
END;
$$;

-- Function: Create client workspace (used by consultants)
CREATE OR REPLACE FUNCTION create_client_workspace(
  p_company_name TEXT,
  p_company_domain TEXT DEFAULT NULL,
  p_consultant_id UUID DEFAULT NULL,
  p_client_permissions JSONB DEFAULT NULL,
  p_primary_contact_email TEXT DEFAULT NULL,
  p_primary_contact_first_name TEXT DEFAULT NULL,
  p_primary_contact_last_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  company_id UUID,
  invitation_id UUID,
  invitation_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_company_id UUID;
  new_invitation_id UUID;
  new_invitation_token TEXT;
  default_permissions JSONB;
BEGIN
  -- Verify caller is consultant or platform admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = COALESCE(p_consultant_id, auth.uid())
    AND role IN ('consultant', 'platform-admin')
  ) THEN
    RAISE EXCEPTION 'Only consultants and platform admins can create client workspaces';
  END IF;

  -- Default permissions if not provided
  default_permissions := COALESCE(p_client_permissions, '{
    "can_create_agents": false,
    "can_edit_company_os": false,
    "can_upload_documents": false,
    "can_create_playbooks": false,
    "can_contribute_to_playbooks": true,
    "can_invite_users": false,
    "can_view_analytics": false,
    "can_edit_profile": true,
    "can_view_agents": true,
    "can_chat_with_agents": true
  }'::jsonb);

  -- Create company
  INSERT INTO companies (
    name,
    domain,
    managed_by,
    is_client_workspace,
    workspace_type,
    client_permissions,
    created_by
  )
  VALUES (
    p_company_name,
    p_company_domain,
    COALESCE(p_consultant_id, auth.uid()),
    TRUE,
    'client',
    default_permissions,
    COALESCE(p_consultant_id, auth.uid())
  )
  RETURNING id INTO new_company_id;

  -- Create consultant_workspaces mapping
  INSERT INTO consultant_workspaces (
    consultant_id,
    company_id,
    role
  )
  VALUES (
    COALESCE(p_consultant_id, auth.uid()),
    new_company_id,
    'owner'
  );

  -- Create CompanyOS placeholder
  INSERT INTO company_os (
    company_id,
    os_data,
    status,
    generated_by
  )
  VALUES (
    new_company_id,
    '{}'::jsonb,
    'draft',
    COALESCE(p_consultant_id, auth.uid())
  );

  -- If primary contact provided, create invitation
  IF p_primary_contact_email IS NOT NULL THEN
    new_invitation_token := encode(gen_random_bytes(32), 'base64');

    INSERT INTO team_invitations (
      company_id,
      email,
      first_name,
      last_name,
      role,
      invitation_token,
      status,
      invited_by,
      expires_at
    )
    VALUES (
      new_company_id,
      p_primary_contact_email,
      COALESCE(p_primary_contact_first_name, ''),
      COALESCE(p_primary_contact_last_name, ''),
      'admin',
      new_invitation_token,
      'pending',
      COALESCE(p_consultant_id, auth.uid()),
      NOW() + INTERVAL '7 days'
    )
    RETURNING id INTO new_invitation_id;
  END IF;

  RETURN QUERY SELECT new_company_id, new_invitation_id, new_invitation_token;
END;
$$;

COMMENT ON FUNCTION match_agent_documents IS 'Vector similarity search for agent-specific documents';
COMMENT ON FUNCTION match_shared_documents IS 'Vector similarity search for company-wide shared documents';
COMMENT ON FUNCTION search_playbooks IS 'Full-text search for playbook sections';
COMMENT ON FUNCTION keyword_search_all_sources IS 'Keyword search across all text sources (agent docs, shared docs, playbooks)';
COMMENT ON FUNCTION create_client_workspace IS 'Creates a new client workspace with company, consultant mapping, and optional invitation';
