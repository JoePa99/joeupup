-- Standardize agent configuration schema
-- Migrate existing configurations to include new required fields

-- Update agents with existing configuration
UPDATE agents 
SET configuration = jsonb_build_object(
  'ai_provider', COALESCE(configuration->>'ai_provider', 'openai'),
  'ai_model', COALESCE(configuration->>'ai_model', configuration->>'model', 'gpt-4o-mini'),
  'temperature', COALESCE((configuration->>'temperature')::numeric, 0.7),
  'max_tokens', COALESCE((configuration->>'max_tokens')::integer, 2000),
  'web_access', COALESCE((configuration->>'web_access')::boolean, false)
)
WHERE configuration IS NOT NULL AND configuration != '{}';

-- Handle agents with empty or null configuration
UPDATE agents 
SET configuration = jsonb_build_object(
  'ai_provider', 'openai',
  'ai_model', 'gpt-4o-mini',
  'temperature', 0.7,
  'max_tokens', 2000,
  'web_access', false
)
WHERE configuration IS NULL OR configuration = '{}';