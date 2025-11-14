import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AgentToolManager } from "./AgentToolManager";
import { ToolStatusIndicators } from "./ToolStatusIndicators";
import { Bot, Plus, Edit, Trash2, Play, Pause, Settings, Loader2, RefreshCw, MessageSquare, Wrench, Maximize2 } from "lucide-react";
interface Agent {
  id: string;
  name: string;
  description: string | null;
  role: string;
  nickname: string | null;
  status: 'active' | 'training' | 'inactive' | 'paused';
  assistant_id: string | null;
  vector_store_id: string | null;
  configuration: any;
  avatar_url: string | null;
  system_instructions: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  agent_types?: {
    name: string;
    description: string;
  };
}
interface AgentFormData {
  name: string;
  description: string;
  role: string;
  nickname: string;
  status: 'active' | 'training' | 'inactive' | 'paused';
  systemInstructions: string;
  agent_type_id?: string;
  ai_provider: string;
  ai_model: string;
  max_tokens: number;
  web_access: boolean;
}
export function AgentManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isToolManagerOpen, setIsToolManagerOpen] = useState(false);
  const [toolManagerAgent, setToolManagerAgent] = useState<Agent | null>(null);
  const [isInstructionsEditorOpen, setIsInstructionsEditorOpen] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    role: '',
    nickname: '',
    status: 'training',
    systemInstructions: '',
    ai_provider: 'openai',
    ai_model: 'gpt-4o-mini',
    max_tokens: 2000,
    web_access: false
  });
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();

  // Fetch agents (only default agents)
  const {
    data: agents = [],
    isLoading: agentsLoading
  } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: async (): Promise<Agent[]> => {
      const {
        data,
        error
      } = await supabase.from('agents').select(`
          *,
          agent_types(name, description)
        `).eq('is_default', true).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch agent types
  const {
    data: agentTypes = []
  } = useQuery({
    queryKey: ['agent-types'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('agent_types').select('*').order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Create agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (agentData: AgentFormData) => {
      // First create the OpenAI assistant
      const instructions = agentData.systemInstructions || `You are ${agentData.name}, ${agentData.description}. Your role is: ${agentData.role}`;
      const {
        data: assistantData,
        error: assistantError
      } = await supabase.functions.invoke('manage-openai-assistants', {
        body: {
          action: 'create',
          name: agentData.name,
          instructions: instructions,
          model: 'gpt-4o-mini'
        }
      });
      if (assistantError) throw new Error('Failed to create OpenAI assistant');

      // Then create the agent record - only include valid database columns
      const {
        data,
        error
      } = await supabase.from('agents').insert({
        company_id: null,
        name: agentData.name,
        role: agentData.role,
        nickname: agentData.nickname,
        description: agentData.description,
        status: agentData.status,
        system_instructions: agentData.systemInstructions,
        assistant_id: assistantData.assistant_id,
        vector_store_id: assistantData.vector_store_id,
        agent_type_id: agentData.agent_type_id,
        is_default: true,
        configuration: {
          ai_provider: agentData.ai_provider,
          ai_model: agentData.ai_model,
          temperature: 0.7,
          max_tokens: agentData.max_tokens,
          web_access: agentData.web_access
        }
      }).select().single();
      
      if (error) {
        console.error('Agent creation error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-agents']
      });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Agent created successfully"
      });
    },
    onError: error => {
      toast({
        title: "Error creating agent",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
      assistant_id
    }: {
      id: string;
      updates: Partial<AgentFormData>;
      assistant_id: string | null;
    }) => {
      // Update OpenAI assistant if it exists and systemInstructions changed
      if (assistant_id && updates.systemInstructions !== undefined) {
        const { error: assistantError } = await supabase.functions.invoke('manage-openai-assistants', {
          body: {
            action: 'update',
            assistant_id: assistant_id,
            instructions: updates.systemInstructions,
            name: updates.name
          }
        });
        if (assistantError) throw new Error('Failed to update OpenAI assistant');
      }

      // Map systemInstructions to system_instructions for the database
      const { systemInstructions, ai_provider, ai_model, max_tokens, web_access, ...restUpdates } = updates;
      const dbUpdates: any = {
        ...restUpdates,
        system_instructions: systemInstructions
      };
      
      // Update configuration if AI provider fields changed
      if (ai_provider || ai_model || max_tokens !== undefined || web_access !== undefined) {
        const { data: currentAgent } = await supabase
          .from('agents')
          .select('configuration')
          .eq('id', id)
          .single();
        
        const currentConfig = (currentAgent?.configuration as any) || {};
        dbUpdates.configuration = {
          ...currentConfig,
          ai_provider: ai_provider || currentConfig.ai_provider,
          ai_model: ai_model || currentConfig.ai_model,
          max_tokens: max_tokens !== undefined ? max_tokens : currentConfig.max_tokens,
          web_access: web_access !== undefined ? web_access : currentConfig.web_access
        };
      }
      
      const {
        data,
        error
      } = await supabase.from('agents').update(dbUpdates).eq('id', id).eq('is_default', true).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-agents']
      });
      setIsEditDialogOpen(false);
      setSelectedAgent(null);
      toast({
        title: "Agent updated successfully"
      });
    },
    onError: error => {
      toast({
        title: "Error updating agent",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete agent mutation
  const deleteAgentMutation = useMutation({
    mutationFn: async (agent: Agent) => {
      // First delete the OpenAI assistant if it exists
      if (agent.assistant_id) {
        await supabase.functions.invoke('manage-openai-assistants', {
          body: {
            action: 'delete',
            assistant_id: agent.assistant_id
          }
        });
      }

      // Then delete the agent record (only if it's a default agent)
      const {
        error
      } = await supabase.from('agents').delete().eq('id', agent.id).eq('is_default', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-agents']
      });
      toast({
        title: "Agent deleted successfully"
      });
    },
    onError: error => {
      toast({
        title: "Error deleting agent",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      role: '',
      nickname: '',
      status: 'training',
      systemInstructions: '',
      ai_provider: 'openai',
      ai_model: 'gpt-4o-mini',
      max_tokens: 2000,
      web_access: false
    });
  };

  const openInstructionsEditor = () => {
    setInstructionsDraft(formData.systemInstructions || '');
    setIsInstructionsEditorOpen(true);
  };

  const saveInstructionsDraft = () => {
    setFormData(prev => ({ ...prev, systemInstructions: instructionsDraft }));
    setIsInstructionsEditorOpen(false);
  };

  const getModelOptions = (provider: string) => {
    switch (provider) {
      case 'openai':
        return [
          { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Most Advanced)' },
          { value: 'o3-2025-04-16', label: 'o3 Reasoning' },
          { value: 'o4-mini-2025-04-16', label: 'o4-mini (Fast & Efficient)' },
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
        ];
      case 'anthropic':
        return [
          { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (Latest)' },
          { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1' },
          { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
          { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' }
        ];
      case 'google':
        return [
          { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
          { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
          { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
        ];
      default:
        return [];
    }
  };
  const handleCreateAgent = () => {
    if (!formData.name || !formData.role) {
      toast({
        title: "Validation Error",
        description: "Name and role are required",
        variant: "destructive"
      });
      return;
    }
    createAgentMutation.mutate(formData);
  };
  const handleEditAgent = () => {
    if (!selectedAgent) return;
    updateAgentMutation.mutate({
      id: selectedAgent.id,
      updates: formData,
      assistant_id: selectedAgent.assistant_id
    });
  };
  const handleDeleteAgent = (agent: Agent) => {
    if (confirm(`Are you sure you want to delete ${agent.name}? This will also delete the associated OpenAI assistant.`)) {
      deleteAgentMutation.mutate(agent);
    }
  };
  const openEditDialog = async (agent: Agent) => {
    setSelectedAgent(agent);
    setIsEditDialogOpen(true);
    
    // Set initial form data with database values
    const initialFormData = {
      name: agent.name,
      description: agent.description || '',
      role: agent.role,
      nickname: agent.nickname || '',
      status: agent.status,
      systemInstructions: agent.system_instructions || `You are ${agent.name}, ${agent.description}. Your role is: ${agent.role}`,
      ai_provider: agent.configuration?.ai_provider || 'openai',
      ai_model: agent.configuration?.ai_model || agent.configuration?.model || 'gpt-4o-mini',
      max_tokens: agent.configuration?.max_tokens || 2000,
      web_access: agent.configuration?.web_access || false
    };
    setFormData(initialFormData);
  };
  const openToolManager = (agent: Agent) => {
    setToolManagerAgent(agent);
    setIsToolManagerOpen(true);
  };
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'training':
        return 'secondary';
      case 'inactive':
        return 'outline';
      default:
        return 'outline';
    }
  };
  if (agentsLoading) {
    return <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>;
  }
  return <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Total Agents: {agents.length}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          if (open) {
            resetForm();
          }
          setIsCreateDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
              {/* Left Column - Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Configuration</h3>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="systemInstructions">System Instructions</Label>
                    <Button variant="ghost" size="sm" onClick={openInstructionsEditor}>
                      <Maximize2 className="mr-1 h-4 w-4" /> Expand
                    </Button>
                  </div>
                  <Textarea 
                    id="systemInstructions" 
                    value={formData.systemInstructions} 
                    onChange={e => setFormData({
                      ...formData,
                      systemInstructions: e.target.value
                    })} 
                    placeholder="Enter the exact instructions that will be sent to the OpenAI assistant. This defines how the agent will behave and respond."
                    rows={6}
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <Label htmlFor="ai_provider">AI Provider</Label>
                  <Select value={formData.ai_provider} onValueChange={(value) => {
                    const newProvider = value;
                    const newModel = getModelOptions(newProvider)[0]?.value || 'gpt-4o-mini';
                    setFormData({
                      ...formData,
                      ai_provider: newProvider,
                      ai_model: newModel
                    });
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ai_model">AI Model</Label>
                  <Select value={formData.ai_model} onValueChange={(value) => setFormData({
                    ...formData,
                    ai_model: value
                  })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {getModelOptions(formData.ai_provider).map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="max_tokens">Max Tokens</Label>
                  <Input 
                    id="max_tokens" 
                    type="number" 
                    value={formData.max_tokens} 
                    onChange={(e) => setFormData({
                      ...formData,
                      max_tokens: parseInt(e.target.value) || 2000
                    })} 
                    placeholder="2000" 
                    min="100"
                    max="128000"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="web_access">Enable Web Access</Label>
                  <Switch 
                    id="web_access"
                    checked={formData.web_access}
                    onCheckedChange={(checked) => setFormData({
                      ...formData,
                      web_access: checked
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData({
                  ...formData,
                  status: value
                })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right Column - Agent Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Agent Details</h3>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData({
                  ...formData,
                  name: e.target.value
                })} placeholder="Agent name" />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={formData.role} onChange={e => setFormData({
                  ...formData,
                  role: e.target.value
                })} placeholder="e.g., Customer Support, Sales Assistant" />
                </div>
                <div>
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input id="nickname" value={formData.nickname} onChange={e => setFormData({
                  ...formData,
                  nickname: e.target.value
                })} placeholder="e.g., @marketing-bot, @sales-assistant" />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={formData.description} onChange={e => setFormData({
                  ...formData,
                  description: e.target.value
                })} placeholder="Agent description and capabilities" rows={4} />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAgent} disabled={createAgentMutation.isPending}>
                {createAgentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Agent
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => <Card key={agent.id} className="border border-gray-200 shadow-none transition-colors hover:bg-gray-50">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start">
                  
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{agent.role}</p>
                  </div>
                </div>
                <Badge variant={getStatusBadgeVariant(agent.status)}>
                  {agent.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {agent.description || 'No description available'}
              </p>
              
              {/* Tool Status Indicators */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tools:</span>
                  <ToolStatusIndicators agentId={agent.id} variant="compact" />
                </div>
                <div className="flex items-center gap-1">
                  <ToolStatusIndicators agentId={agent.id} variant="icons" />
                </div>
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assistant ID:</span>
                  <span className="font-mono text-xs">
                    {agent.assistant_id ? `${agent.assistant_id.slice(0, 8)}...` : 'Not created'}
                  </span>
                </div>
                
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(agent)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => openToolManager(agent)}>
                  <Wrench className="h-4 w-4 mr-1" />
                  Tools
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDeleteAgent(agent)} disabled={deleteAgentMutation.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>)}
      </div>

      {agents.length === 0 && <div className="text-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No agents yet</h3>
          <p className="text-muted-foreground mb-4">Create your first AI agent to get started</p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>}

      {/* Edit Agent Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
            {/* Left Column - Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Configuration</h3>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-systemInstructions">System Instructions</Label>
                  <Button variant="ghost" size="sm" onClick={openInstructionsEditor}>
                    <Maximize2 className="mr-1 h-4 w-4" /> Expand
                  </Button>
                </div>
                <Textarea 
                  id="edit-systemInstructions" 
                  value={formData.systemInstructions} 
                  onChange={e => setFormData({
                    ...formData,
                    systemInstructions: e.target.value
                  })} 
                  placeholder="Enter the exact instructions that will be sent to the OpenAI assistant. This defines how the agent will behave and respond."
                  rows={6}
                  className="min-h-[120px]"
                />
              </div>
              <div>
                <Label htmlFor="edit-ai_provider">AI Provider</Label>
                <Select value={formData.ai_provider} onValueChange={(value) => {
                  const newProvider = value;
                  const newModel = getModelOptions(newProvider)[0]?.value || 'gpt-4o-mini';
                  setFormData({
                    ...formData,
                    ai_provider: newProvider,
                    ai_model: newModel
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-ai_model">AI Model</Label>
                <Select value={formData.ai_model} onValueChange={(value) => setFormData({
                  ...formData,
                  ai_model: value
                })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {getModelOptions(formData.ai_provider).map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-max_tokens">Max Tokens</Label>
                <Input 
                  id="edit-max_tokens" 
                  type="number" 
                  value={formData.max_tokens} 
                  onChange={(e) => setFormData({
                    ...formData,
                    max_tokens: parseInt(e.target.value) || 2000
                  })} 
                  placeholder="2000" 
                  min="100"
                  max="128000"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-web_access">Enable Web Access</Label>
                <Switch 
                  id="edit-web_access"
                  checked={formData.web_access}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    web_access: checked
                  })}
                />
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formData.status} onValueChange={(value: any) => setFormData({
                ...formData,
                status: value
              })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right Column - Agent Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Agent Details</h3>
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" value={formData.name} onChange={e => setFormData({
                ...formData,
                name: e.target.value
              })} placeholder="Agent name" />
              </div>
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Input id="edit-role" value={formData.role} onChange={e => setFormData({
                ...formData,
                role: e.target.value
              })} placeholder="e.g., Customer Support, Sales Assistant" />
              </div>
              <div>
                <Label htmlFor="edit-nickname">Nickname</Label>
                <Input id="edit-nickname" value={formData.nickname} onChange={e => setFormData({
                ...formData,
                nickname: e.target.value
              })} placeholder="e.g., @marketing-bot, @sales-assistant" />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" value={formData.description} onChange={e => setFormData({
                ...formData,
                description: e.target.value
              })} placeholder="Agent description and capabilities" rows={4} />
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditAgent} disabled={updateAgentMutation.isPending}>
              {updateAgentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Agent
            </Button>
          </div>
          </DialogContent>
        </Dialog>

        {/* Tool Manager Dialog */}
        {toolManagerAgent && <AgentToolManager agent={toolManagerAgent} isOpen={isToolManagerOpen} onClose={() => {
      setIsToolManagerOpen(false);
      setToolManagerAgent(null);
    }} />}

        {/* System Instructions Editor Modal */}
        <Dialog open={isInstructionsEditorOpen} onOpenChange={setIsInstructionsEditorOpen}>
          <DialogContent className="max-w-5xl w-[90vw]">
            <DialogHeader>
              <DialogTitle>Edit System Instructions</DialogTitle>
            </DialogHeader>
            <Textarea
              value={instructionsDraft}
              onChange={(e) => setInstructionsDraft(e.target.value)}
              className="min-h-[60vh] font-mono"
              placeholder="Write detailed agent instructions here..."
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{instructionsDraft.length} chars</span>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setIsInstructionsEditorOpen(false)}>Cancel</Button>
                <Button onClick={saveInstructionsDraft}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>;
}