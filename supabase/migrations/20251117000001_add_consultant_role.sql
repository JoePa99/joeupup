-- Add consultant role to app_role enum
-- This allows consultants to manage multiple client workspaces

DO $$ BEGIN
  -- Check if the type exists before trying to modify it
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    -- Add 'consultant' to the enum if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'app_role'::regtype
      AND enumlabel = 'consultant'
    ) THEN
      ALTER TYPE app_role ADD VALUE 'consultant' AFTER 'platform-admin';
    END IF;
  END IF;
END $$;

-- Update RLS policies to allow consultants to manage their assigned workspaces
-- This will be expanded in subsequent migrations once consultant_workspaces table exists

COMMENT ON TYPE app_role IS 'User roles: platform-admin (super admin), consultant (manages multiple client workspaces), admin (company admin), moderator, user';
