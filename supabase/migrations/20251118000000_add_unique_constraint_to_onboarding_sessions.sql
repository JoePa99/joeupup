-- Add unique constraint to user_id in onboarding_sessions table
-- This allows upsert operations to work properly with onConflict: 'user_id'

-- First, remove any duplicate rows (keep the most recent one)
DELETE FROM public.onboarding_sessions a
USING public.onboarding_sessions b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- Now add the unique constraint
ALTER TABLE public.onboarding_sessions
  ADD CONSTRAINT onboarding_sessions_user_id_unique UNIQUE (user_id);
