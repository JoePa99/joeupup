-- Clean up channel-related tables by dropping unused scheduling and onboarding fields
-- These columns are no longer used by the simplified collaboration experience

ALTER TABLE IF EXISTS public.channels
  DROP COLUMN IF EXISTS onboarding_status,
  DROP COLUMN IF EXISTS provisioning_status,
  DROP COLUMN IF EXISTS consultation_status,
  DROP COLUMN IF EXISTS meeting_scheduled_at,
  DROP COLUMN IF EXISTS appointment_status,
  DROP COLUMN IF EXISTS provisioning_completed_at;

ALTER TABLE IF EXISTS public.channel_members
  DROP COLUMN IF EXISTS onboarding_status,
  DROP COLUMN IF EXISTS onboarding_step,
  DROP COLUMN IF EXISTS meeting_scheduled_at,
  DROP COLUMN IF EXISTS invitation_status,
  DROP COLUMN IF EXISTS appointment_notes;

ALTER TABLE IF EXISTS public.assistant_membership
  DROP COLUMN IF EXISTS onboarding_status,
  DROP COLUMN IF EXISTS scheduling_status,
  DROP COLUMN IF EXISTS provisioning_status,
  DROP COLUMN IF EXISTS onboarding_step;
