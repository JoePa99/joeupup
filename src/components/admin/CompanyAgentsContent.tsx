import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pause, Play, TrendingUp, MessageSquare, MoreVertical, Settings, Wrench, Plus, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getCompanyAgents, toggleAgentStatus } from "@/lib/company-agent-utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { AgentToolManager } from "./AgentToolManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDefaultAgents } from "@/lib/default-agent-utils";
import { DocumentUploadArea } from "@/components/documents/DocumentUploadArea";
import { CompanyDocumentsList } from "@/components/documents/CompanyDocumentsList";

interface CompanyAgentsContentProps {
  companyId: string;
}

export function CompanyAgentsContent({ companyId }: CompanyAgentsContentProps) {
  const [agentStatusFilter, setAgentStatusFilter] = useState<string>("all");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isToolManagerOpen, setIsToolManagerOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [isAddDefaultAgentOpen, setIsAddDefaultAgentOpen] = useState(false);
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [selectedDefaultAgentId, setSelectedDefaultAgentId] = useState<string>("");
  const [docRefreshTrigger, setDocRefreshTrigger] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    description: "",
    nickname: "",
    system_instructions: "",
    ai_provider: "openai",
    ai_model: "gpt-4o-mini",
    max_tokens: 4096,
    web_access_enabled: false,
    status: "training" as "training" | "active" | "inactive" | "paused",
    agent_type_id: ""
  });

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: platformAdminData, isLoading: adminCheckLoading } = usePlatformAdmin();

  // Fetch user profile to check authorization
  const { data: userProfile, isLoading: userProfileLoading } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check if user has admin access - ensure platform-admin always allowed
  const isPlatformAdminRPC = platformAdminData?.success && platformAdminData?.isAdmin;
  const isPlatformAdminProfile = userProfile?.role === "platform-admin";
  const isPlatformAdmin = isPlatformAdminRPC || isPlatformAdminProfile;
  const isCompanyAdmin = userProfile?.role === "admin" && userProfile?.company_id === companyId;
  const hasAdminAccess = isPlatformAdmin || isCompanyAdmin;
  const shouldDisableButtons = !adminCheckLoading && !userProfileLoading && !hasAdminAccess;

  const { data: agentsResult, isLoading: agentsLoading } = useQuery({
    queryKey: ["company-agents", companyId],
    queryFn: () => getCompanyAgents(companyId),
    enabled: !!companyId,
  });

  const agents = agentsResult?.data || [];

  // Fetch default agents (templates) for platform admins
  const { data: defaultAgentsResult } = useQuery({
    queryKey: ["default-agents"],
    queryFn: getDefaultAgents,
    enabled: isPlatformAdmin,
  });

  const defaultAgents = defaultAgentsResult?.data || [];

  // Fetch agent types
  const { data: agentTypes = [] } = useQuery({
    queryKey: ["agent-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_types")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isPlatformAdmin,
  });

  const { data: agentMetrics } = useQuery({
    queryKey: ["agent-metrics", companyId],
    queryFn: async () => {
      if (agents.length === 0) return [];
      const { data, error } = await supabase
        .from("agent_metrics")
        .select("*")
        .in("agent_id", agents.map((a: any) => a.id));
      if (error) throw error;
      return data || [];
    },
    enabled: agents.length > 0,
  });

  // Clone default agent mutation
  const cloneDefaultAgentMutation = useMutation({
    mutationFn: async (defaultAgentId: string) => {
      const { data, error } = await supabase.rpc("copy_default_agent_to_company", {
        p_default_agent_id: defaultAgentId,
        p_company_id: companyId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-agents", companyId] });
      setIsAddDefaultAgentOpen(false);
      setSelectedDefaultAgentId("");
      toast.success("Default agent added successfully");
    },
    onError: (error: any) => {
      toast.error("Error adding default agent", {
        description: error.message,
      });
    },
  });

  // Create new agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (agentData: typeof formData) => {
      // First create the OpenAI assistant
      const instructions = agentData.system_instructions || 
        `You are ${agentData.name}, ${agentData.description}. Your role is: ${agentData.role}`;
      
      const { data: assistantData, error: assistantError } = await supabase.functions.invoke(
        "manage-openai-assistants",
        {
          body: {
            action: "create",
            name: agentData.name,
            instructions: instructions,
            model: "gpt-4o-mini",
          },
        }
      );

      if (assistantError) throw new Error("Failed to create OpenAI assistant");

      // Then create the agent record
      const { data, error } = await supabase
        .from("agents")
        .insert({
          company_id: companyId,
          name: agentData.name,
          role: agentData.role,
          nickname: agentData.nickname,
          description: agentData.description,
          status: agentData.status,
          system_instructions: agentData.system_instructions,
          assistant_id: assistantData.assistant_id,
          vector_store_id: assistantData.vector_store_id,
          agent_type_id: agentData.agent_type_id || null,
          is_default: false,
          configuration: {
            ai_provider: agentData.ai_provider,
            ai_model: agentData.ai_model,
            temperature: 0.7,
            max_tokens: agentData.max_tokens,
            web_access: agentData.web_access_enabled,
          },
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-agents", companyId] });
      setIsCreateAgentOpen(false);
      resetCreateForm();
      toast.success("Agent created successfully");
    },
    onError: (error: any) => {
      toast.error("Error creating agent", {
        description: error.message,
      });
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("agents")
        .update({
          name: data.name,
          role: data.role,
          description: data.description,
          system_instructions: data.system_instructions,
          status: data.status,
          configuration: {
            ai_provider: data.ai_provider,
            ai_model: data.ai_model,
            max_tokens: data.max_tokens,
            web_access_enabled: data.web_access_enabled
          }
        })
        .eq("id", editingAgent.id);
      
      if (error) throw error;

      // Update OpenAI assistant if system instructions changed
      if (data.system_instructions !== editingAgent.system_instructions && editingAgent.assistant_id) {
        const { error: assistantError } = await supabase.functions.invoke("manage-openai-assistants", {
          body: {
            action: "update",
            assistantId: editingAgent.assistant_id,
            instructions: data.system_instructions
          }
        });
        if (assistantError) console.error("Failed to update OpenAI assistant:", assistantError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-agents", companyId] });
      toast.success("Agent updated successfully");
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const handleStatusToggle = async (agentId: string, currentStatus: string) => {
    try {
      await toggleAgentStatus(agentId, currentStatus);
      queryClient.invalidateQueries({ queryKey: ["company-agents", companyId] });
      toast.success(`Agent ${currentStatus === "active" ? "paused" : "activated"}`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEditAgent = (agent: any) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      role: agent.role,
      description: agent.description || "",
      nickname: agent.nickname || "",
      system_instructions: agent.system_instructions || "",
      ai_provider: agent.configuration?.ai_provider || "openai",
      ai_model: agent.configuration?.ai_model || "gpt-4o-mini",
      max_tokens: agent.configuration?.max_tokens || 4096,
      web_access_enabled: agent.configuration?.web_access_enabled || false,
      status: agent.status || "active",
      agent_type_id: agent.agent_type_id || "",
    });
    setIsEditDialogOpen(true);
  };

  const resetCreateForm = () => {
    setFormData({
      name: "",
      role: "",
      description: "",
      nickname: "",
      system_instructions: "",
      ai_provider: "openai",
      ai_model: "gpt-4o-mini",
      max_tokens: 4096,
      web_access_enabled: false,
      status: "training",
      agent_type_id: "",
    });
  };

  const handleCreateAgent = () => {
    if (!formData.name || !formData.role) {
      toast.error("Validation Error", {
        description: "Name and role are required",
      });
      return;
    }
    createAgentMutation.mutate(formData);
  };

  const handleCloneDefaultAgent = () => {
    if (!selectedDefaultAgentId) {
      toast.error("Please select an agent to add");
      return;
    }
    cloneDefaultAgentMutation.mutate(selectedDefaultAgentId);
  };

  const handleOpenToolManager = (agent: any) => {
    setEditingAgent(agent);
    setIsToolManagerOpen(true);
  };

  const handleDocumentsUploaded = () => {
    setDocRefreshTrigger(prev => prev + 1);
  };

  const handleDeleteAgent = (agent: any) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAgent = async () => {
    if (!agentToDelete) return;

    try {
      // Delete OpenAI assistant if it exists
      if (agentToDelete.assistant_id) {
        const { error: assistantError } = await supabase.functions.invoke("manage-openai-assistants", {
          body: {
            action: "delete",
            assistantId: agentToDelete.assistant_id
          }
        });
        if (assistantError) {
          console.error("Failed to delete OpenAI assistant:", assistantError);
          // Continue with agent deletion even if assistant deletion fails
        }
      }

      // Delete the agent record
      const { error } = await supabase
        .from("agents")
        .delete()
        .eq("id", agentToDelete.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["company-agents", companyId] });
      toast.success("Agent deleted successfully");
    } catch (error: any) {
      console.error("Error deleting agent:", error);
      toast.error("Error deleting agent", {
        description: error.message,
      });
    } finally {
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAgentMutation.mutate(formData);
  };

  const filteredAgents = agents.filter((agent: any) => {
    if (agentStatusFilter === "all") return true;
    return agent.status === agentStatusFilter;
  });

  if (agentsLoading) {
    return <div className="p-8">Loading agents...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Company Agents</h2>
          <p className="text-muted-foreground">View and manage agent status for this company</p>
        </div>
        {isPlatformAdmin && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsAddDefaultAgentOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add from Default
            </Button>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => {
                resetCreateForm();
                setIsCreateAgentOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant={agentStatusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setAgentStatusFilter("all")}
        >
          All
        </Button>
        <Button
          variant={agentStatusFilter === "active" ? "default" : "outline"}
          size="sm"
          onClick={() => setAgentStatusFilter("active")}
        >
          Active
        </Button>
        <Button
          variant={agentStatusFilter === "paused" ? "default" : "outline"}
          size="sm"
          onClick={() => setAgentStatusFilter("paused")}
        >
          Paused
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent: any) => {
          const metrics = agentMetrics?.find((m) => m.agent_id === agent.id);
          return (
            <Card key={agent.id} className="border border-gray-200 shadow-none">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="text-sm">{agent.role}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                      {agent.status}
                    </Badge>
                    {agent.is_default && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Default
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditAgent(agent)}>
                          <Settings className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenToolManager(agent)}>
                          <Wrench className="mr-2 h-4 w-4" />
                          Tools
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusToggle(agent.id, agent.status)}>
                          {agent.status === 'active' ? (
                            <>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        {isPlatformAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteAgent(agent)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">{agent.description}</p>

                {metrics && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span>{metrics.total_conversations || 0} chats</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span>{metrics.tasks_completed || 0} tasks</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Agent Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="configuration" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="configuration" className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column - Configuration */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        disabled={!isPlatformAdmin}
                      />
                    </div>

                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Input
                        id="role"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        required
                        disabled={!isPlatformAdmin}
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        disabled={!isPlatformAdmin}
                      />
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={(value: "active" | "inactive" | "paused" | "training") => setFormData({ ...formData, status: value })}
                        disabled={!isPlatformAdmin}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="training">Training</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Right Column - AI Configuration */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ai_provider">AI Provider</Label>
                      <Select 
                        value={formData.ai_provider} 
                        onValueChange={(value) => {
                          const firstModel = getModelOptions(value)[0]?.value || 'gpt-4o-mini';
                          setFormData({ ...formData, ai_provider: value, ai_model: firstModel });
                        }}
                        disabled={!isPlatformAdmin}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="google">Google</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="ai_model">AI Model</Label>
                      <Select 
                        value={formData.ai_model} 
                        onValueChange={(value) => setFormData({ ...formData, ai_model: value })}
                        disabled={!isPlatformAdmin}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                        onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                        disabled={!isPlatformAdmin}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="web_access">Web Access</Label>
                      <Switch
                        id="web_access"
                        checked={formData.web_access_enabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, web_access_enabled: checked })}
                        disabled={!isPlatformAdmin}
                      />
                    </div>
                  </div>
                </div>

                {/* System Instructions - Full Width */}
                <div>
                  <Label htmlFor="system_instructions">System Instructions</Label>
                  <Textarea
                    id="system_instructions"
                    value={formData.system_instructions}
                    onChange={(e) => setFormData({ ...formData, system_instructions: e.target.value })}
                    rows={6}
                    placeholder="Custom instructions for this agent..."
                    disabled={!isPlatformAdmin}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateAgentMutation.isPending || !isPlatformAdmin}>
                    {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="documents" className="space-y-4">
              {editingAgent ? (
                <>
                  <DocumentUploadArea 
                    agentId={editingAgent.id} 
                    companyId={companyId}
                    onUploadComplete={handleDocumentsUploaded} 
                  />
                  <div className="border-t border-border" />
                  <CompanyDocumentsList 
                    key={docRefreshTrigger}
                    companyId={companyId}
                    companyOnly={true}
                    onDocumentsUploaded={handleDocumentsUploaded} 
                  />
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No agent selected for document management.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Tool Manager Dialog */}
      {editingAgent && (
        <AgentToolManager
          agent={editingAgent}
          isOpen={isToolManagerOpen}
          onClose={() => setIsToolManagerOpen(false)}
        />
      )}

      {/* Add Default Agent Dialog */}
      <Dialog open={isAddDefaultAgentOpen} onOpenChange={setIsAddDefaultAgentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Default Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="default-agent-select">Select Template Agent</Label>
              <Select value={selectedDefaultAgentId} onValueChange={setSelectedDefaultAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent template" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {defaultAgents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} - {agent.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddDefaultAgentOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCloneDefaultAgent} 
              disabled={cloneDefaultAgentMutation.isPending || !selectedDefaultAgentId}
            >
              {cloneDefaultAgentMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Add Agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Agent Dialog */}
      <Dialog open={isCreateAgentOpen} onOpenChange={setIsCreateAgentOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="configuration" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="configuration" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
                {/* Left Column - Configuration */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">Configuration</h3>
                  <div>
                    <Label htmlFor="agent-type">Agent Type</Label>
                    <Select 
                      value={formData.agent_type_id} 
                      onValueChange={(value) => setFormData({ ...formData, agent_type_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {agentTypes.map((type: any) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="system-instructions">System Instructions</Label>
                    <Textarea
                      id="system-instructions"
                      value={formData.system_instructions}
                      onChange={(e) => setFormData({ ...formData, system_instructions: e.target.value })}
                      placeholder="Enter instructions for the agent"
                      rows={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ai-provider">AI Provider</Label>
                    <Select 
                      value={formData.ai_provider} 
                      onValueChange={(value) => {
                        const newModel = getModelOptions(value)[0]?.value || "gpt-4o-mini";
                        setFormData({ ...formData, ai_provider: value, ai_model: newModel });
                      }}
                    >
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
                    <Label htmlFor="ai-model">AI Model</Label>
                    <Select 
                      value={formData.ai_model} 
                      onValueChange={(value) => setFormData({ ...formData, ai_model: value })}
                    >
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
                    <Label htmlFor="max-tokens">Max Tokens</Label>
                    <Input
                      id="max-tokens"
                      type="number"
                      value={formData.max_tokens}
                      onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 4096 })}
                      min="100"
                      max="128000"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="web-access">Enable Web Access</Label>
                    <Switch
                      id="web-access"
                      checked={formData.web_access_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, web_access_enabled: checked })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                    >
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
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Agent name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Input
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder="e.g., Customer Support, Sales Assistant"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nickname">Nickname</Label>
                    <Input
                      id="nickname"
                      value={formData.nickname}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      placeholder="e.g., @marketing-bot"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Agent description and capabilities"
                      rows={4}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateAgentOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAgent} disabled={createAgentMutation.isPending}>
                  {createAgentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Agent
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="documents" className="space-y-4">
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">Save the agent first to add documents</p>
                <p className="text-sm text-muted-foreground">
                  Once the agent is created, you can upload and manage documents in this tab.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Agent Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agentToDelete?.name}"? This action will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Permanently delete the agent and all its data</li>
                <li>Remove the associated OpenAI assistant and vector store</li>
                <li>Delete all agent conversations and metrics</li>
                <li>Remove the agent from all channels and integrations</li>
              </ul>
              <p className="mt-2 font-semibold text-destructive">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAgent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
