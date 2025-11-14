import { supabase } from "@/integrations/supabase/client";

/**
 * Company Agent utilities
 * These functions manage company-scoped agents
 */

export interface CompanyAgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  status: 'active' | 'training' | 'inactive' | 'paused';
  configuration: {
    instructions?: string;
    [key: string]: any;
  };
  company_id: string;
  agent_type_id: string;
  is_default?: boolean;
}

/**
 * Get agents for a company from the database
 */
export async function getCompanyAgents(companyId: string) {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        *,
        agent_types(name, description)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Create a new agent in the database and provision OpenAI resources
 */
export async function createDatabaseAgent(agentData: Omit<CompanyAgentConfig, 'id'>) {
  try {
    // First create the agent record
    const { data, error } = await supabase
      .from('agents')
      .insert([{
        ...agentData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    // Then provision OpenAI resources
    const { data: provisionData, error: provisionError } = await supabase.functions.invoke('provision-company-agent-openai', {
      body: {
        agent_id: data.id,
        company_id: agentData.company_id,
        agent_name: agentData.name,
        agent_description: agentData.description
      }
    });

    if (provisionError) {
      console.warn('Failed to provision OpenAI resources for agent:', provisionError);
      // Don't fail the entire operation, just log the warning
      // The agent will still be created but without OpenAI configuration
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Error creating agent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing agent in the database
 */
export async function updateDatabaseAgent(agentId: string, updates: Partial<CompanyAgentConfig>) {
  try {
    const { data, error } = await supabase
      .from('agents')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error updating agent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an agent from the database
 */
export async function deleteDatabaseAgent(agentId: string) {
  try {
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', agentId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Toggle agent status between active and paused
 */
export async function toggleAgentStatus(agentId: string, currentStatus: string) {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  
  try {
    const { data, error } = await supabase
      .from('agents')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString() 
      })
      .eq('id', agentId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data, newStatus };
  } catch (error: any) {
    console.error('Error toggling agent status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Copy a default agent to a company
 */
export async function copyDefaultAgentToCompany(defaultAgentId: string, companyId: string) {
  try {
    const { data, error } = await supabase.rpc('copy_default_agent_to_company' as any, {
      p_default_agent_id: defaultAgentId,
      p_company_id: companyId
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error copying default agent to company:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get agent by ID with error handling
 */
export async function getAgentById(agentId: string) {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        *,
        agent_types(name, description)
      `)
      .eq('id', agentId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Error fetching agent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create initial conversations for all agents for a user
 * Only creates conversations that don't already exist
 */
export async function createInitialConversations(
  userId: string, 
  companyId: string
): Promise<{ success: boolean; created: number; error?: string }> {
  try {
    // Fetch all active agents for the company
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('status', 'active');

    if (agentsError) throw agentsError;
    if (!agents || agents.length === 0) {
      return { success: true, created: 0 };
    }

    // Fetch existing conversations for this user
    const { data: existingConversations, error: conversationsError } = await supabase
      .from('chat_conversations')
      .select('agent_id')
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (conversationsError) throw conversationsError;

    // Find agents that don't have conversations yet
    const existingAgentIds = new Set(
      (existingConversations || []).map(c => c.agent_id)
    );
    const agentsNeedingConversations = agents.filter(
      agent => !existingAgentIds.has(agent.id)
    );

    if (agentsNeedingConversations.length === 0) {
      return { success: true, created: 0 };
    }

    // Create conversations for agents that don't have any
    const newConversations = agentsNeedingConversations.map(agent => ({
      user_id: userId,
      company_id: companyId,
      agent_id: agent.id,
      title: `Chat with ${agent.name}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('chat_conversations')
      .insert(newConversations);

    if (insertError) throw insertError;

    return { 
      success: true, 
      created: newConversations.length 
    };
  } catch (error: any) {
    console.error('Error creating initial conversations:', error);
    return { 
      success: false, 
      created: 0, 
      error: error.message 
    };
  }
}
