-- Remove duplicate platform admin policy on agents table
-- Keep only the policy using is_platform_admin() without parameters

DROP POLICY IF EXISTS "Platform admins can manage agents" ON public.agents;

-- The "platform admin full access agents" policy already exists and uses is_platform_admin()
-- This is the correct policy to keep as it uses the no-parameter version of the function