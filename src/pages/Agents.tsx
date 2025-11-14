import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { AgentForm } from "@/components/agents/AgentForm";
import { getDefaultAgents, createDefaultAgent, updateDefaultAgent, deleteDefaultAgent, seedDefaultAgentToAllCompanies } from "@/lib/default-agent-utils";
import { 
  Bot, 
  MessageSquare, 
  Activity, 
  Settings,
  Plus,
  Play,
  Pause,
  BarChart3,
  Edit,
  Trash2,
  Copy,
  Building2
} from "lucide-react";

export default function Agents() {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [seedToAllCompanies, setSeedToAllCompanies] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: platformAdminData, isLoading: isCheckingAdmin } = usePlatformAdmin();

  const { data: agents = [] } = useQuery({
    queryKey: ['default-agents'],
    queryFn: async () => {
      const result = await getDefaultAgents();
      return result.success ? result.data : [];
    },
    enabled: !!user && platformAdminData?.success && platformAdminData?.isAdmin,
  }) as any;

  // Handle agent status toggle
  const handleStatusToggle = async (agent: any) => {
    const result = await updateDefaultAgent(agent.id, { 
      status: agent.status === 'active' ? 'paused' : 'active' 
    });
    
    if (result.success) {
      toast({
        title: "Success",
        description: `Default agent ${agent.status === 'active' ? 'paused' : 'activated'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['default-agents'] });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to update agent status",
        variant: "destructive",
      });
    }
  };

  // Handle agent deletion
  const handleDeleteAgent = async (agent: any) => {
    if (!confirm(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`)) {
      return;
    }

    const result = await deleteDefaultAgent(agent.id);
    
    if (result.success) {
      toast({
        title: "Success",
        description: `Default agent "${agent.name}" deleted successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['default-agents'] });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to delete agent",
        variant: "destructive",
      });
    }
  };

  // Handle form success
  const handleFormSuccess = async (agentData?: any) => {
    queryClient.invalidateQueries({ queryKey: ['default-agents'] });
    
    // If seeding to all companies was requested and we have agent data
    if (seedToAllCompanies && agentData?.id) {
      const seedResult = await seedDefaultAgentToAllCompanies(agentData.id);
      if (seedResult.success) {
        toast({
          title: "Success",
          description: `Default agent created and seeded to ${seedResult.data} companies`,
        });
      } else {
        toast({
          title: "Warning",
          description: "Agent created but failed to seed to all companies",
          variant: "destructive",
        });
      }
    }
    
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingAgent(null);
    setSeedToAllCompanies(false);
  };

  // Handle edit click
  const handleEditAgent = (agent: any) => {
    setEditingAgent(agent);
    setIsEditDialogOpen(true);
  };

  // Check if user is platform admin
  if (isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect non-platform admins
  if (!platformAdminData?.success || !platformAdminData?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
          <p className="text-text-secondary mb-6">
            You need platform administrator privileges to access this section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Default Agent Catalog</h1>
            <p className="text-text-secondary text-sm sm:text-base">Manage default agents that are automatically created for all companies</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-hero w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create Default Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Default Agent</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="seedToAll"
                    checked={seedToAllCompanies}
                    onChange={(e) => setSeedToAllCompanies(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="seedToAll" className="text-sm text-text-secondary">
                    Apply to all existing companies immediately
                  </label>
                </div>
                <AgentForm
                  onSuccess={handleFormSuccess}
                  onCancel={() => setIsCreateDialogOpen(false)}
                  isDefaultAgent={true}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
          <Button variant="outline" size="sm" className="text-xs sm:text-sm">All Agents</Button>
          <Button variant="ghost" size="sm" className="text-xs sm:text-sm">Active</Button>
          <Button variant="ghost" size="sm" className="text-xs sm:text-sm">Training</Button>
          <Button variant="ghost" size="sm" className="text-xs sm:text-sm">Inactive</Button>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {(agents as any[]).map((agent) => (
            <Card key={agent.id} className="p-4 sm:p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🤖</div>
                  <div>
                    <h3 className="font-semibold text-foreground">{agent.name}</h3>
                    <p className="text-sm text-text-secondary">{agent.agent_types?.name || 'Default Agent'}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  Template
                </Badge>
              </div>

              <div className="mb-4">
                <p className="text-sm text-text-secondary mb-2">Description:</p>
                <p className="text-sm text-foreground line-clamp-2">{agent.description}</p>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                <Badge variant="outline" className="text-xs">
                  {agent.agent_types?.name || 'Custom Agent'}
                </Badge>
                <Badge variant={
                  agent.status === "active" ? "default" : 
                  agent.status === "training" ? "secondary" : 
                  agent.status === "paused" ? "outline" : "destructive"
                } className="text-xs">
                  {agent.status}
                </Badge>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedAgent(agent)}
                  className="flex-1"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Preview
                </Button>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEditAgent(agent)}
                    className="flex-1 sm:flex-none"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteAgent(agent)}
                    className="text-red-600 hover:text-red-700 flex-1 sm:flex-none"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleStatusToggle(agent)}
                    className={`flex-1 sm:flex-none ${agent.status === "active" ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}`}
                  >
                    {agent.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Preview Modal */}
        {selectedAgent && (
          <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{selectedAgent.name} - Default Agent Preview</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <h4 className="font-semibold text-foreground mb-2">Agent Details</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-text-secondary">Name:</span> {selectedAgent.name}</div>
                      <div><span className="text-text-secondary">Type:</span> {selectedAgent.agent_types?.name || 'Custom'}</div>
                      <div><span className="text-text-secondary">Status:</span> {selectedAgent.status}</div>
                    </div>
                  </Card>
                  <Card className="p-4">
                    <h4 className="font-semibold text-foreground mb-2">Configuration</h4>
                    <div className="text-sm text-text-secondary">
                      {selectedAgent.description || 'No description available'}
                    </div>
                  </Card>
                </div>
                <Card className="p-4">
                  <h4 className="font-semibold text-foreground mb-2">Instructions</h4>
                  <div className="text-sm text-text-secondary bg-surface-subtle p-3 rounded">
                    {selectedAgent.config?.instructions || 'No instructions configured'}
                  </div>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Agent Modal */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Default Agent</DialogTitle>
            </DialogHeader>
            {editingAgent && (
              <AgentForm
                agent={editingAgent}
                onSuccess={handleFormSuccess}
                onCancel={() => {
                  setIsEditDialogOpen(false);
                  setEditingAgent(null);
                }}
                isDefaultAgent={true}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}