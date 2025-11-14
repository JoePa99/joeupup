import { supabase } from "@/integrations/supabase/client";

/**
 * Default Agent utilities for platform administrators
 * These functions manage template agents stored in the agents table with:
 * - is_default = TRUE
 * - company_id IS NULL
 * 
 * Template agents are cloned to new companies when they are created.
 */

export interface DefaultAgentConfig {
  id: string;
  agent_type_id: string;
  name: string;
  role: string;
  description: string | null;
  configuration: {
    instructions?: string;
    [key: string]: any;
  };
  status: 'active' | 'training' | 'inactive' | 'paused';
  company_id: null;  // Template agents always have NULL company_id
  created_by: string;
  is_default: true;  // Template agents always have is_default = true
}

/**
 * Get all default agents (platform admin only)
 * Template agents have is_default = TRUE and company_id IS NULL
 */
export async function getDefaultAgents() {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        *,
        agent_types(name, description)
      `)
      .eq('is_default', true)
      .is('company_id', null)  // Only template agents with NULL company_id
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching default agents:', error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Create a new default agent (template agent)
 * Template agents have company_id = NULL and is_default = TRUE
 */
export async function createDefaultAgent(agentData: Omit<DefaultAgentConfig, 'id' | 'is_default' | 'company_id'>) {
  try {
    // Fetch the agent type name to use as role
    const { data: agentType } = await supabase
      .from('agent_types')
      .select('name')
      .eq('id', agentData.agent_type_id)
      .single();

    const role = agentType?.name || agentData.role || 'Custom Agent';

    const { data, error } = await supabase
      .from('agents')
      .insert([{
        ...agentData,
        role,
        company_id: null,  // Template agents have NULL company_id
        is_default: true,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error creating default agent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing default agent (template agent)
 * Only updates template agents with company_id IS NULL
 */
export async function updateDefaultAgent(agentId: string, updates: Partial<DefaultAgentConfig>) {
  try {
    // Remove company_id and is_default from updates to prevent changing these fields
    const { company_id, is_default, ...safeUpdates } = updates;
    
    const { data, error } = await supabase
      .from('agents')
      .update(safeUpdates)
      .eq('id', agentId)
      .eq('is_default', true)
      .is('company_id', null)  // Only template agents
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error updating default agent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a default agent (template agent)
 * Only deletes template agents with company_id IS NULL
 */
export async function deleteDefaultAgent(agentId: string) {
  try {
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', agentId)
      .eq('is_default', true)
      .is('company_id', null);  // Only template agents

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting default agent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Seed a default agent to all existing companies
 */
export async function seedDefaultAgentToAllCompanies(defaultAgentId: string) {
  try {
    const { data, error } = await supabase.rpc('seed_default_agent_to_all_companies' as any, {
      p_default_agent_id: defaultAgentId
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error seeding default agent to companies:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if user is platform admin
 */
export async function isPlatformAdmin() {
  try {
    const { data, error } = await supabase.rpc('is_platform_admin' as any);
    if (error) throw error;
    return { success: true, isAdmin: data };
  } catch (error: any) {
    console.error('Error checking platform admin status:', error);
    return { success: false, error: error.message, isAdmin: false };
  }
}
