import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Tool {
  id: string;
  name: string;
  display_name: string;
  description: string;
  tool_type: string;
  schema_definition: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentTool {
  id: string;
  agent_id: string;
  tool_id: string;
  configuration: any;
  is_enabled: boolean;
  created_at: string;
  tool?: Tool;
}

export function useTools() {
  return useQuery({
    queryKey: ['tools'],
    queryFn: async (): Promise<Tool[]> => {
      const { data, error } = await supabase
        .from('tools')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (error) throw error;
      return data || [];
    }
  });
}

export function useAgentTools(agentId: string) {
  return useQuery({
    queryKey: ['agent-tools', agentId],
    queryFn: async (): Promise<AgentTool[]> => {
      const { data, error } = await supabase
        .from('agent_tools')
        .select(`
          *,
          tool:tools(*)
        `)
        .eq('agent_id', agentId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!agentId
  });
}

export function useAgentToolMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const assignTool = useMutation({
    mutationFn: async ({ agentId, toolId, configuration = {} }: { 
      agentId: string; 
      toolId: string; 
      configuration?: any;
    }) => {
      const { data, error } = await supabase
        .from('agent_tools')
        .insert({
          agent_id: agentId,
          tool_id: toolId,
          configuration,
          is_enabled: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools', variables.agentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      toast({ title: "Tool assigned successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error assigning tool", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const unassignTool = useMutation({
    mutationFn: async ({ agentId, toolId }: { agentId: string; toolId: string }) => {
      const { error } = await supabase
        .from('agent_tools')
        .delete()
        .eq('agent_id', agentId)
        .eq('tool_id', toolId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools', variables.agentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      toast({ title: "Tool unassigned successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error unassigning tool", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateToolConfig = useMutation({
    mutationFn: async ({ 
      agentId, 
      toolId, 
      configuration, 
      isEnabled 
    }: { 
      agentId: string; 
      toolId: string; 
      configuration?: any;
      isEnabled?: boolean;
    }) => {
      const updates: any = {};
      if (configuration !== undefined) updates.configuration = configuration;
      if (isEnabled !== undefined) updates.is_enabled = isEnabled;

      const { data, error } = await supabase
        .from('agent_tools')
        .update(updates)
        .eq('agent_id', agentId)
        .eq('tool_id', toolId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools', variables.agentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
      toast({ title: "Tool configuration updated" });
    },
    onError: (error) => {
      toast({ 
        title: "Error updating tool configuration", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  return {
    assignTool,
    unassignTool,
    updateToolConfig
  };
}