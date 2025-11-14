-- Comprehensive fix for channel members visibility issues
-- This migration addresses potential RLS policy issues and ensures proper data access

-- 1. First, let's ensure the get_user_company_id function is working correctly
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Return the company_id for the current authenticated user
  -- Add error handling to prevent issues
  RETURN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return null if there's any error
    RETURN NULL;
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- 2. Drop all existing channel-related policies to start fresh
DROP POLICY IF EXISTS "Users can view channels in their company" ON channels;
DROP POLICY IF EXISTS "Users can view channel memberships" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can view channel members for accessible channels" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members for their company channels" ON channel_members;

-- 3. Create simple, reliable policies for channels
CREATE POLICY "Users can view channels in their company" 
ON channels 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND
  company_id = get_user_company_id()
);

CREATE POLICY "Users can create channels in their company" 
ON channels 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' AND
  company_id = get_user_company_id() AND 
  created_by = auth.uid()
);

CREATE POLICY "Users can update channels in their company" 
ON channels 
FOR UPDATE 
USING (
  auth.role() = 'authenticated' AND
  company_id = get_user_company_id()
);

-- 4. Create comprehensive policies for channel_members
CREATE POLICY "Users can view all channel members for their company channels" 
ON channel_members 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);

CREATE POLICY "Users can manage channel members for their company channels" 
ON channel_members 
FOR ALL
USING (
  auth.role() = 'authenticated' AND
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);

-- 5. Ensure profiles are accessible for company members
-- (This should already exist, but let's make sure)
DROP POLICY IF EXISTS "Users can view profiles in their company" ON profiles;
CREATE POLICY "Users can view profiles in their company" 
ON profiles 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND
  (company_id = get_user_company_id() OR id = auth.uid())
);
