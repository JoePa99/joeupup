import { supabase } from "@/integrations/supabase/client";

/**
 * Check if the current user is a member of a channel
 */
export async function isUserChannelMember(channelId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('channel_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      // If no membership found, return false
      if (error.code === 'PGRST116') return false;
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking channel membership:', error);
    return false;
  }
}

/**
 * Check if a channel is accessible to the current user
 * Returns true for public channels in user's company or private channels user is member of
 */
export async function isChannelAccessible(channelId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) return false;

    // Fetch the channel - RLS allows all company channels now
    const { data: channel, error } = await supabase
      .from('channels')
      .select('id, is_private')
      .eq('id', channelId)
      .eq('company_id', profile.company_id)
      .single();

    if (error) {
      // If channel not found, return false
      return false;
    }

    // If it's a public channel, user has access
    if (!channel.is_private) return true;

    // For private channels, check membership
    return await isUserChannelMember(channelId);
  } catch (error) {
    console.error('Error checking channel accessibility:', error);
    return false;
  }
}

/**
 * Get channel details with access control
 * Returns null if user doesn't have access
 */
export async function getChannelWithAccess(channelId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!profile?.company_id) return null;

    // Fetch the channel - RLS allows all company channels now
    const { data: channel, error } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .eq('company_id', profile.company_id)
      .single();

    if (error) {
      console.error('Error fetching channel:', error);
      return null;
    }

    // Check access for private channels
    if (channel.is_private) {
      const isMember = await isUserChannelMember(channelId);
      if (!isMember) {
        return null; // User doesn't have access to this private channel
      }
    }

    return channel;
  } catch (error) {
    console.error('Error getting channel with access:', error);
    return null;
  }
}
