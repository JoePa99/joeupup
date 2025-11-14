-- Fix Company Creation Error with RPC Function
-- ==============================================
-- This migration creates an RPC function that handles company creation and profile linking
-- atomically, bypassing RLS issues during signup

CREATE OR REPLACE FUNCTION public.create_company_and_link_profile(
  p_company_name TEXT,
  p_user_id UUID
)
RETURNS TABLE(
  company_id UUID, 
  company_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Insert company
  INSERT INTO public.companies (name)
  VALUES (p_company_name)
  RETURNING id INTO v_company_id;
  
  -- Update profile immediately with company_id and admin role
  UPDATE public.profiles
  SET 
    company_id = v_company_id, 
    role = 'admin'
  WHERE id = p_user_id;
  
  -- Return company data
  RETURN QUERY SELECT v_company_id, p_company_name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_company_and_link_profile(TEXT, UUID) TO authenticated;
