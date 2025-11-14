-- Debug Platform Admin Access
-- Run these queries to check and fix platform admin access

-- 1. Check if platform_admins table exists and has your user ID
SELECT 
  'platform_admins table check' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_admins') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as table_status;

-- 2. Check if your user ID is in platform_admins
SELECT 
  'user in platform_admins' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()) 
    THEN 'YES' 
    ELSE 'NO' 
  END as is_platform_admin;

-- 3. Check your current user ID
SELECT 
  'current user id' as check_type,
  auth.uid() as user_id;

-- 4. List all platform admins (if any)
SELECT 'all platform admins' as check_type, user_id FROM public.platform_admins;

-- 5. Check if is_platform_admin function exists
SELECT 
  'is_platform_admin function' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'is_platform_admin') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as function_status;

-- 6. Test the function
SELECT 
  'function test' as check_type,
  public.is_platform_admin() as is_platform_admin_result;

-- TO FIX: If you're not a platform admin, run this (replace YOUR_USER_ID with your actual user ID):
-- INSERT INTO public.platform_admins (user_id) VALUES ('YOUR_USER_ID_HERE') ON CONFLICT DO NOTHING;
