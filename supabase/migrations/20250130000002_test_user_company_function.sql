-- Test and fix get_user_company_id function if needed
-- This migration ensures the function is working correctly

-- Drop and recreate the function to ensure it's working
DROP FUNCTION IF EXISTS public.get_user_company_id();

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Return the company_id for the current authenticated user
  RETURN (
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
