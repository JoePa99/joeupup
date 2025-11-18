import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Bot,
  FileText,
  Settings,
  MessageSquare,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Agent {
  id: string;
  name: string;
  role: string;
  description: string | null;
  status: 'active' | 'training' | 'inactive';
  model_name: string;
  documentation_count: number;
  created_at: string;
}

export default function WorkspaceAgents() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [companyData, setCompanyData] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  useEffect(() => {
    if (workspaceId) {
      fetchCompanyData();
      fetchAgents();
    }
  }, [workspaceId]);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      setCompanyData(data);
    } catch (error: any) {
      console.error('Error fetching company:', error);
    }
  };

  const fetchAgents = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('company_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAgents(data || []);
    } catch (error: any) {
      console.error('Error fetching agents:', error);
      toast({
        title: "Error loading agents",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;

    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentToDelete.id);

      if (error) throw error;

      toast({
        title: "Agent deleted",
        description: `${agentToDelete.name} has been removed`,
      });

      // Refresh agents list
      fetchAgents();
    } catch (error: any) {
      toast({
        title: "Error deleting agent",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'training':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            Training
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="secondary">
            <XCircle className="w-3 h-3 mr-1" />
            Inactive
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/consultant-portal')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Agents: {companyData?.name}
              </h1>
              <p className="text-muted-foreground">
                Manage AI agents for this workspace
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/consultant-portal/workspaces/${workspaceId}/company-os`)}
              >
                <Settings className="w-4 h-4 mr-2" />
                CompanyOS
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/consultant-portal/workspaces/${workspaceId}/playbooks`)}
              >
                <FileText className="w-4 h-4 mr-2" />
                Playbooks
              </Button>
              <Button
                onClick={() => navigate(`/consultant-portal/workspaces/${workspaceId}/agents/new`)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </div>
          </div>
        </div>

        {/* Agents Grid */}
        {agents.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bot className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No agents yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first AI agent for this workspace
              </p>
              <Button onClick={() => navigate(`/consultant-portal/workspaces/${workspaceId}/agents/new`)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/consultant-portal/workspaces/${workspaceId}/agents/${agent.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-5 h-5 text-primary" />
                        <CardTitle className="text-xl">{agent.name}</CardTitle>
                      </div>
                      <CardDescription>{agent.role}</CardDescription>
                    </div>
                    {getStatusBadge(agent.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {agent.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {agent.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="flex items-center text-muted-foreground">
                        <FileText className="w-4 h-4 mr-2" />
                        Documents
                      </span>
                      <span className="font-semibold">{agent.documentation_count || 0}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-mono text-xs">{agent.model_name}</span>
                    </div>

                    <div className="pt-3 border-t flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/consultant-portal/workspaces/${workspaceId}/agents/${agent.id}/documents`);
                        }}
                        className="flex-1"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Docs
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Open test chat modal
                          toast({
                            title: "Test Chat",
                            description: "Test chat feature coming soon",
                          });
                        }}
                        className="flex-1"
                      >
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAgentToDelete(agent);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.
              All associated documents and configurations will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAgent} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
