import { supabase } from '@/integrations/supabase/client';

export interface UserRoleInfo {
  userId: string;
  email: string;
  role: string | null;
  profileExists: boolean;
  companyId: string | null;
}

/**
 * Diagnose current user's admin access
 */
export async function diagnoseAdminAccess(): Promise<UserRoleInfo | null> {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('No authenticated user found:', userError);
      return null;
    }

    // Check user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, company_id, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return {
        userId: user.id,
        email: user.email || 'Unknown',
        role: null,
        profileExists: false,
        companyId: null
      };
    }

    return {
      userId: user.id,
      email: profile?.email || user.email || 'Unknown',
      role: profile?.role || null,
      profileExists: true,
      companyId: profile?.company_id || null
    };
  } catch (error) {
    console.error('Error diagnosing admin access:', error);
    return null;
  }
}

/**
 * Update user role to admin
 */
export async function updateUserToAdmin(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { success: false, message: 'No authenticated user found' };
    }

    // Update user role to admin
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user.id);

    if (updateError) {
      return { success: false, message: `Failed to update role: ${updateError.message}` };
    }

    return { success: true, message: 'Successfully updated user role to admin' };
  } catch (error) {
    return { success: false, message: `Error updating role: ${error}` };
  }
}

/**
 * Create profile if it doesn't exist
 */
export async function createUserProfile(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { success: false, message: 'No authenticated user found' };
    }

    // Create profile with admin role
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email || '',
        role: 'admin'
      });

    if (insertError) {
      return { success: false, message: `Failed to create profile: ${insertError.message}` };
    }

    return { success: true, message: 'Successfully created admin profile' };
  } catch (error) {
    return { success: false, message: `Error creating profile: ${error}` };
  }
}


