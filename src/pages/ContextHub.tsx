import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/ui/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DocumentUploadArea } from "@/components/documents/DocumentUploadArea";
import { createDatabaseAgent, getCompanyAgents } from "@/lib/company-agent-utils";
import { supabase } from "@/integrations/supabase/client";
import { Plus, UploadCloud } from "lucide-react";

interface AgentType {
  id: string;
  name: string;
}

interface AgentRecord {
  id: string;
  name: string;
  role: string;
  description: string | null;
  status: string;
  configuration?: {
    instructions?: string;
    context_scopes?: {
      company_os?: boolean;
      shared_kb?: boolean;
      agent_kb?: boolean;
    };
    [key: string]: any;
  };
  agent_types?: {
    name: string;
  } | null;
}

export default function ContextHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agentTypes, setAgentTypes] = useState<AgentType[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [uploadRefreshKey, setUploadRefreshKey] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    description: "",
    instructions: "",
    agentTypeId: "",
  });
  const [contextScopes, setContextScopes] = useState({
    company_os: true,
    shared_kb: true,
    agent_kb: true,
  });

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!user?.id) return;

      const [{ data: profile }, { data: types }] = await Promise.all([
        supabase.from("profiles").select("company_id").eq("id", user.id).single(),
        supabase.from("agent_types").select("id, name").order("name"),
      ]);

      setCompanyId(profile?.company_id ?? null);
      setAgentTypes(types || []);
      if (types && types.length > 0) {
        setFormData((prev) => ({ ...prev, agentTypeId: prev.agentTypeId || types[0].id }));
      }
    };

    fetchMetadata();
  }, [user?.id]);

  const { data: agents = [], isLoading } = useQuery<AgentRecord[]>({
    queryKey: ["context-hub-agents", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const result = await getCompanyAgents(companyId);
      if (!result.success) throw new Error(result.error || "Failed to load agents");
      return result.data as AgentRecord[];
    },
    enabled: !!companyId,
  });

  const defaultRole = useMemo(() => (formData.role || formData.name ? formData.role || formData.name : "context_agent"), [
    formData.name,
    formData.role,
  ]);

  const handleDialogChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setFormData({ name: "", role: "", description: "", instructions: "", agentTypeId: agentTypes[0]?.id || "" });
      setContextScopes({ company_os: true, shared_kb: true, agent_kb: true });
      setCreatedAgentId(null);
      setUploadRefreshKey((key) => key + 1);
    }
  };

  const handleCreateAgent = async () => {
    if (!user?.id || !companyId) {
      toast({
        title: "Missing information",
        description: "We couldn't determine your company. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name || !formData.agentTypeId) {
      toast({
        title: "Incomplete form",
        description: "Please provide a name and agent type before continuing.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        role: defaultRole,
        description: formData.description || null,
        agent_type_id: formData.agentTypeId,
        status: "training" as const,
        configuration: {
          instructions: formData.instructions,
          context_scopes: contextScopes,
        },
        company_id: companyId,
        created_by: user.id,
      } as const;

      const result = await createDatabaseAgent(payload as any);

      if (!result.success) {
        throw new Error(result.error || "Failed to create agent");
      }

      setCreatedAgentId(result.data.id);
      toast({
        title: "Agent created",
        description: "You can now upload starter documents for this agent.",
      });
      queryClient.invalidateQueries({ queryKey: ["context-hub-agents", companyId] });
    } catch (error: any) {
      console.error("Error creating agent:", error);
      toast({
        title: "Error",
        description: error.message || "Could not create agent",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["context-hub-agents", companyId] });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Context Hub</h1>
            <p className="text-muted-foreground">Manage agent access to company knowledge and seed their context.</p>
          </div>
          <Dialog open={isModalOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button className="btn-hero w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create Context Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create an agent with scoped knowledge</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Agent Name</Label>
                    <Input
                      id="agent-name"
                      placeholder="Support Assistant"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent-role">Role</Label>
                    <Input
                      id="agent-role"
                      placeholder="support_specialist"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Defaults to the agent name if left blank.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent-type">Agent Type</Label>
                    <select
                      id="agent-type"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.agentTypeId}
                      onChange={(e) => setFormData({ ...formData, agentTypeId: e.target.value })}
                    >
                      <option value="" disabled>
                        Select an agent type
                      </option>
                      {agentTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent-description">Description</Label>
                    <Textarea
                      id="agent-description"
                      placeholder="Short summary of this agent's responsibilities"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent-instructions">System Instructions</Label>
                    <Textarea
                      id="agent-instructions"
                      placeholder="Outline how this agent should respond to users"
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      rows={5}
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Context scopes</p>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="scope-company-os"
                        checked={contextScopes.company_os}
                        onCheckedChange={(checked) =>
                          setContextScopes((prev) => ({ ...prev, company_os: Boolean(checked) }))
                        }
                      />
                      <Label htmlFor="scope-company-os">Grant access to Company OS</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="scope-shared-kb"
                        checked={contextScopes.shared_kb}
                        onCheckedChange={(checked) =>
                          setContextScopes((prev) => ({ ...prev, shared_kb: Boolean(checked) }))
                        }
                      />
                      <Label htmlFor="scope-shared-kb">Allow shared knowledge base documents</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="scope-agent-kb"
                        checked={contextScopes.agent_kb}
                        onCheckedChange={(checked) =>
                          setContextScopes((prev) => ({ ...prev, agent_kb: Boolean(checked) }))
                        }
                      />
                      <Label htmlFor="scope-agent-kb">Enable this agent's private knowledge base</Label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleCreateAgent} disabled={isSaving || !!createdAgentId}>
                      {isSaving ? "Creating..." : createdAgentId ? "Agent ready" : "Create agent"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UploadCloud className="h-5 w-5" />
                        Seed documents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {createdAgentId ? (
                        <DocumentUploadArea
                          key={`${createdAgentId}-${uploadRefreshKey}`}
                          agentId={createdAgentId}
                          companyId={companyId || undefined}
                          onUploadComplete={handleUploadComplete}
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground space-y-2">
                          <p>Create the agent to unlock uploads.</p>
                          <p>
                            We'll automatically route uploaded files to the agent's knowledge base once it's been provisioned.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading agents...</p>
          ) : agents.length === 0 ? (
            <p className="text-muted-foreground">No agents have been created yet.</p>
          ) : (
            agents.map((agent) => {
              const scopes = agent.configuration?.context_scopes || {};
              return (
                <Card key={agent.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-lg">
                      <span>{agent.name}</span>
                      {agent.agent_types?.name && <Badge variant="secondary">{agent.agent_types.name}</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{agent.description || "No description provided."}</p>
                    <div className="flex flex-wrap gap-2">
                      {scopes.company_os && <Badge variant="outline">Company OS</Badge>}
                      {scopes.shared_kb && <Badge variant="outline">Shared KB</Badge>}
                      {scopes.agent_kb && <Badge variant="outline">Agent KB</Badge>}
                    </div>
                    {agent.configuration?.instructions && (
                      <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                        {agent.configuration.instructions}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
