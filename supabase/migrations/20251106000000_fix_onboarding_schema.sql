-- Ensure onboarding schema consistency for onboarding workspace creation

-- Create onboarding_status enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'onboarding_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.onboarding_status AS ENUM ('not_started', 'in_progress', 'completed');
  END IF;
END $$;

-- Make sure profile name columns exist for workspace onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Create onboarding_sessions table if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'onboarding_sessions'
  ) THEN
    CREATE TABLE public.onboarding_sessions (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      current_step INTEGER DEFAULT 1,
      status onboarding_status NOT NULL DEFAULT 'not_started',
      progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
      completed_steps INTEGER[] DEFAULT '{}',
      session_data JSONB DEFAULT '{}',
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Align onboarding_sessions columns if the table already existed without the latest schema
ALTER TABLE public.onboarding_sessions
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status onboarding_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  ADD COLUMN IF NOT EXISTS completed_steps INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Ensure updated_at stays in sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_onboarding_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_onboarding_sessions_updated_at
      BEFORE UPDATE ON public.onboarding_sessions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Make sure RLS and policies exist
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Users can view their onboarding session' AND tablename = 'onboarding_sessions'
  ) THEN
    CREATE POLICY "Users can view their onboarding session" ON public.onboarding_sessions
      FOR SELECT USING (user_id = auth.uid() OR company_id = public.get_user_company_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Users can update their onboarding session' AND tablename = 'onboarding_sessions'
  ) THEN
    CREATE POLICY "Users can update their onboarding session" ON public.onboarding_sessions
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- Helpful indexes for session lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_company_id ON public.onboarding_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user_id ON public.onboarding_sessions(user_id);
