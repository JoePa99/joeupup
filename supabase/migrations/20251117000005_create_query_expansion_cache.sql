-- Create query_expansion_cache table
-- Caches query expansions to avoid repeated LLM calls for common queries
-- Significant performance and cost optimization

CREATE TABLE IF NOT EXISTS query_expansion_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_query TEXT NOT NULL,
  query_hash TEXT NOT NULL UNIQUE,  -- MD5 hash for fast lookup
  expanded_queries TEXT[] NOT NULL,
  expansion_model TEXT DEFAULT 'gpt-3.5-turbo',

  -- Usage tracking
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_query_expansion_cache_query_hash ON query_expansion_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_expansion_cache_expires_at ON query_expansion_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_query_expansion_cache_last_used_at ON query_expansion_cache(last_used_at DESC);

-- Enable RLS (but allow all reads for performance)
ALTER TABLE query_expansion_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can read from cache (it's generic query expansions)
CREATE POLICY "Anyone can read query expansion cache"
  ON query_expansion_cache
  FOR SELECT
  USING (true);

-- System can insert new cache entries
CREATE POLICY "System can insert cache entries"
  ON query_expansion_cache
  FOR INSERT
  WITH CHECK (true);

-- System can update cache entries (for hit_count, last_used_at)
CREATE POLICY "System can update cache entries"
  ON query_expansion_cache
  FOR UPDATE
  USING (true);

-- Platform admins can delete cache entries
CREATE POLICY "Platform admins can delete cache entries"
  ON query_expansion_cache
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'platform-admin'
    )
  );

-- Function to generate query hash
CREATE OR REPLACE FUNCTION generate_query_hash(query TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Normalize query: lowercase, trim, collapse whitespace
  RETURN md5(lower(regexp_replace(trim(query), '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get or create cached query expansion
CREATE OR REPLACE FUNCTION get_cached_query_expansion(query TEXT)
RETURNS TEXT[] AS $$
DECLARE
  hash TEXT;
  cached_expansions TEXT[];
BEGIN
  hash := generate_query_hash(query);

  -- Try to get from cache
  SELECT expanded_queries INTO cached_expansions
  FROM query_expansion_cache
  WHERE query_hash = hash
    AND expires_at > NOW();

  -- Update hit count and last_used_at if found
  IF cached_expansions IS NOT NULL THEN
    UPDATE query_expansion_cache
    SET
      hit_count = hit_count + 1,
      last_used_at = NOW(),
      expires_at = NOW() + INTERVAL '30 days'  -- Extend expiration
    WHERE query_hash = hash;
  END IF;

  RETURN cached_expansions;
END;
$$ LANGUAGE plpgsql;

-- Function to cache query expansion
CREATE OR REPLACE FUNCTION cache_query_expansion(
  query TEXT,
  expansions TEXT[],
  model TEXT DEFAULT 'gpt-3.5-turbo'
)
RETURNS UUID AS $$
DECLARE
  hash TEXT;
  cache_id UUID;
BEGIN
  hash := generate_query_hash(query);

  -- Insert or update
  INSERT INTO query_expansion_cache (
    original_query,
    query_hash,
    expanded_queries,
    expansion_model,
    hit_count,
    last_used_at,
    expires_at
  )
  VALUES (
    query,
    hash,
    expansions,
    model,
    0,
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (query_hash) DO UPDATE
  SET
    expanded_queries = EXCLUDED.expanded_queries,
    expansion_model = EXCLUDED.expansion_model,
    last_used_at = NOW(),
    expires_at = NOW() + INTERVAL '30 days'
  RETURNING id INTO cache_id;

  RETURN cache_id;
END;
$$ LANGUAGE plpgsql;

-- Scheduled cleanup of expired cache entries (run daily)
-- Note: This requires pg_cron extension, or can be called manually
CREATE OR REPLACE FUNCTION cleanup_expired_query_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM query_expansion_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Also cleanup entries not used in 90 days (even if not expired)
CREATE OR REPLACE FUNCTION cleanup_stale_query_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM query_expansion_cache
  WHERE last_used_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE query_expansion_cache IS 'Caches query expansions to avoid repeated LLM API calls';
COMMENT ON COLUMN query_expansion_cache.query_hash IS 'MD5 hash of normalized query for fast lookup';
COMMENT ON COLUMN query_expansion_cache.hit_count IS 'Number of times this cache entry has been used';
COMMENT ON FUNCTION get_cached_query_expansion IS 'Retrieves cached query expansion if exists and not expired, updates hit count';
COMMENT ON FUNCTION cache_query_expansion IS 'Stores query expansion in cache with 30-day expiration';
