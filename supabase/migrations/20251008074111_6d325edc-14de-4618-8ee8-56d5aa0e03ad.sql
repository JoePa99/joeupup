-- Update all existing agents to set nickname based on name
-- Converts name to lowercase and replaces spaces with underscores
UPDATE public.agents
SET nickname = LOWER(REPLACE(name, ' ', '_'))
WHERE nickname IS NULL OR nickname = '';

-- Also update where nickname doesn't match the expected format
UPDATE public.agents
SET nickname = LOWER(REPLACE(name, ' ', '_'))
WHERE nickname != LOWER(REPLACE(name, ' ', '_'));