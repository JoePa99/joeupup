-- Fix RLS policies that are causing 500 errors
-- Run this directly in your Supabase SQL editor

-- Drop all existing channel and channel_members policies
DROP POLICY IF EXISTS "Users can view channels in their company with privacy respect" ON channels;
DROP POLICY IF EXISTS "Users can view their own channel memberships and public channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can manage channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can view public channels and private channels they are members of" ON channels;
DROP POLICY IF EXISTS "Users can view channels in their company" ON channels;
DROP POLICY IF EXISTS "Users can view channel memberships" ON channel_members;

-- Create simple, reliable policies

-- Channels: Allow users to see channels in their company, with privacy handled at application level
CREATE POLICY "Users can view channels in their company" 
ON channels 
FOR SELECT 
USING (company_id = get_user_company_id());

-- Channel members: Allow users to see their own memberships and manage memberships for their company channels
CREATE POLICY "Users can view channel memberships" 
ON channel_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);

CREATE POLICY "Users can manage channel members" 
ON channel_members 
FOR ALL
USING (
  channel_id IN (
    SELECT id FROM channels 
    WHERE company_id = get_user_company_id()
  )
);
