import { useEffect, useMemo, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyOS } from "@/hooks/useCompanyOS";
import { supabase } from "@/integrations/supabase/client";
import { createDatabaseAgent, getCompanyAgents } from "@/lib/company-agent-utils";
import { calculateCompleteness } from "@/lib/company-os";
import { CompanyOSGenerator } from "@/components/company-os/CompanyOSGenerator";
import { CompanyOSViewer } from "@/components/company-os/CompanyOSViewer";
import { CompanyOSEditor } from "@/components/company-os/CompanyOSEditor";
import { DocumentUploadArea } from "@/components/documents/DocumentUploadArea";
import { CompanyDocumentsList } from "@/components/documents/CompanyDocumentsList";
import {
  Bot,
  Brain,
  Database,
  FileText,
  Layers3,
  Loader2,
  Plug,
  Rocket,
  Shield,
  Sparkles,
  Upload,
  Wand2
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  company_id: string | null;
  role: string | null;
  first_name?: string | null;
}

interface AssistantForm {
  name: string;
  role: string;
  description: string;
  model: string;
  temperature: number;
  webSearch: boolean;
  imageGen: boolean;
  deepResearch: boolean;
}

export default function ContextHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [assistantDialogOpen, setAssistantDialogOpen] = useState(false);
  const [activeAgentForUpload, setActiveAgentForUpload] = useState<string | null>(null);
  const [assistantForm, setAssistantForm] = useState<AssistantForm>({
    name: "",
    role: "",
    description: "",
    model: "gpt-4o-mini",
    temperature: 0.4,
    webSearch: true,
    imageGen: true,
    deepResearch: false
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      setProfileLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id, role, first_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading profile for context hub:", error);
        toast({
          title: "Unable to load workspace",
          description: "We could not load your workspace details. Please retry.",
          variant: "destructive"
        });
      }

      setProfile(data ?? null);
      setProfileLoading(false);
    };

    fetchProfile();
  }, [user?.id, toast]);

  const companyId = profile?.company_id || undefined;
  const { data: companyOS, isLoading: osLoading, refetch: refetchCompanyOS } = useCompanyOS(companyId);

  const { data: documentsSummary, isLoading: docsLoading } = useQuery({
    queryKey: ["context-documents", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_archives")
        .select("id, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const latest = data?.[0]?.created_at ? new Date(data[0].created_at).toLocaleDateString() : "-";
      return {
        count: data?.length ?? 0,
        lastUpdated: latest
      };
    }
  });

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["context-agents", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      const result = await getCompanyAgents(companyId);
      if (!result.success) throw new Error(result.error || "Failed to load agents");
      return result.data;
    }
  });

  const agentIds = useMemo(() => (agentsData || []).map((agent: any) => agent.id), [agentsData]);

  const { data: agentDocumentCounts, isLoading: agentDocLoading } = useQuery({
    queryKey: ["agent-document-counts", agentIds.join("-")],
    enabled: agentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_documents")
        .select("agent_id, document_id")
        .in("agent_id", agentIds);

      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        counts[row.agent_id] = (counts[row.agent_id] || 0) + 1;
      });
      return counts;
    }
  });

  const handleCreateAssistant = async () => {
    if (!companyId) return;
    if (!assistantForm.name.trim() || !assistantForm.role.trim()) {
      toast({
        title: "Name and role required",
        description: "Give your assistant a clear name and role to continue.",
        variant: "destructive"
      });
      return;
    }

    const { success, error } = await createDatabaseAgent({
      name: assistantForm.name.trim(),
      role: assistantForm.role.trim(),
      description: assistantForm.description.trim(),
      status: "active",
      configuration: {
        ai_provider: "openai",
        ai_model: assistantForm.model,
        temperature: assistantForm.temperature,
        tools: {
          web_search: assistantForm.webSearch,
          image_generation: assistantForm.imageGen,
          deep_research: assistantForm.deepResearch
        }
      },
      company_id: companyId,
      agent_type_id: null,
      is_default: false,
      system_instructions: `You are ${assistantForm.name}, ${assistantForm.role}. ${assistantForm.description}`,
      created_by: user?.id || null,
    } as any);

    if (!success) {
      toast({
        title: "Could not create assistant",
        description: error || "An unexpected error occurred",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Assistant ready",
      description: "We provisioned the assistant and connected the retrieval stack."
    });
    setAssistantDialogOpen(false);
    setAssistantForm({
      name: "",
      role: "",
      description: "",
      model: "gpt-4o-mini",
      temperature: 0.4,
      webSearch: true,
      imageGen: true,
      deepResearch: false
    });
    queryClient.invalidateQueries({ queryKey: ["context-agents", companyId] });
  };

  const osCompleteness = useMemo(() => {
    if (!companyOS?.os_data) return 0;
    return calculateCompleteness(companyOS.os_data as any);
  }, [companyOS]);

  const renderStatusBadge = (label: string, value: string | number, icon: JSX.Element) => (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background shadow-inner text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );

  const isLoading = profileLoading || osLoading;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 md:h-12 flex items-center border-b border-border px-4 sm:px-6 bg-white/80 backdrop-blur">
            <SidebarTrigger className="mr-4 h-10 w-10 md:h-7 md:w-7" />
            <div className="flex flex-col">
              <p className="text-xs text-muted-foreground">Context Control Center</p>
              <h1 className="text-lg font-semibold">Context Hub</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Context-first
              </Badge>
              {profile?.first_name && (
                <Badge variant="secondary" className="text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin view
                </Badge>
              )}
            </div>
          </header>

          <div className="flex-1 p-4 sm:p-6 space-y-6 bg-slate-50">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-sm border-2 border-primary/10 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Company OS
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderStatusBadge("Status", companyOS ? "Loaded" : osLoading ? "Loading" : "Not created", <Brain className="h-4 w-4" />)}
                  {renderStatusBadge("Completeness", `${osCompleteness}%`, <Layers3 className="h-4 w-4" />)}
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => setShowGenerator(true)}>
                      <Wand2 className="h-4 w-4 mr-1" />
                      Generate or replace
                    </Button>
                    <Button size="sm" variant="outline" disabled={!companyOS} onClick={() => setShowEditor(true)}>
                      <FileText className="h-4 w-4 mr-1" />
                      View / Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    Knowledge Bases
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderStatusBadge("Documents", docsLoading ? "Loading" : documentsSummary?.count ?? 0, <FileText className="h-4 w-4" />)}
                  {renderStatusBadge("Last update", docsLoading ? "-" : documentsSummary?.lastUpdated || "-", <Sparkles className="h-4 w-4" />)}
                  <p className="text-xs text-muted-foreground">
                    Upload shared knowledge first. Add assistant-specific uploads below to scope context.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Assistants
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renderStatusBadge("Active", agentsLoading ? "Loading" : agentsData?.length || 0, <Rocket className="h-4 w-4" />)}
                  {renderStatusBadge("Scoped docs", agentDocLoading ? "Loading" : Object.values(agentDocumentCounts || {}).reduce((a, b) => a + b, 0), <Layers3 className="h-4 w-4" />)}
                  <Button size="sm" variant="default" onClick={() => setAssistantDialogOpen(true)}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Create assistant
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-4 w-4 text-primary" />
                  Step 1: Company OS is always-on context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload or regenerate the Company OS first. Every assistant will prepend these principles before using other knowledge bases.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Current snapshot</h3>
                    <div className="rounded-lg border bg-white p-3">
                      {isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading Company OS...
                        </div>
                      ) : companyOS ? (
                        <CompanyOSViewer companyOS={companyOS} />
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No Company OS yet. Use the generator to create one from a URL or upload.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Actions</h3>
                    <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <Wand2 className="h-4 w-4 text-primary mt-1" />
                        <div>
                          <p className="font-medium text-sm">Generate from URL or document</p>
                          <p className="text-xs text-muted-foreground">We fetch, summarize, and store as structured context for every assistant.</p>
                          <Button variant="secondary" size="sm" className="mt-2" onClick={() => setShowGenerator(true)}>
                            Open generator
                          </Button>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-primary mt-1" />
                        <div>
                          <p className="font-medium text-sm">Edit inline</p>
                          <p className="text-xs text-muted-foreground">Tweak any section and bump the version; assistants will read the latest version automatically.</p>
                          <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowEditor(true)} disabled={!companyOS}>
                            Open editor
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="h-4 w-4 text-primary" />
                  Step 2: Upload shared and assistant knowledge
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Shared Company Knowledge Base</h3>
                    <p className="text-xs text-muted-foreground">These documents are available to all assistants after Company OS context.</p>
                    <DocumentUploadArea companyId={companyId} onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ["context-documents", companyId] })} />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Assistant-specific uploads</h3>
                    <p className="text-xs text-muted-foreground">Select an assistant to scope uploads only to that assistant.</p>
                    <div className="flex flex-wrap gap-2">
                      {(agentsData || []).map((agent: any) => (
                        <Button
                          key={agent.id}
                          variant={activeAgentForUpload === agent.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveAgentForUpload(agent.id)}
                        >
                          {agent.name}
                        </Button>
                      ))}
                    </div>
                    {activeAgentForUpload ? (
                      <DocumentUploadArea
                        companyId={companyId}
                        agentId={activeAgentForUpload}
                        onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ["agent-document-counts", agentIds.join("-")] })}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground border rounded-lg p-3 bg-muted/40">
                        Pick an assistant above to add scoped knowledge.
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <CompanyDocumentsList
                    companyId={companyId}
                    companyOnly={true}
                    onDocumentsUploaded={() => queryClient.invalidateQueries({ queryKey: ["context-documents", companyId] })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-4 w-4 text-primary" />
                  Step 3: Configure assistants for context-first responses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(agentsData || []).map((agent: any) => (
                    <Card key={agent.id} className="border shadow-none">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Bot className="h-4 w-4 text-primary" />
                          {agent.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">{agent.role}</p>
                        <p>Status: <span className="font-semibold text-foreground">{agent.status}</span></p>
                        <p>Scoped docs: {agentDocumentCounts?.[agent.id] ?? 0}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button variant="default" onClick={() => setAssistantDialogOpen(true)}>
                    <Plug className="h-4 w-4 mr-2" />
                    Add assistant
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generate or replace Company OS</DialogTitle>
          </DialogHeader>
          {companyId ? (
            <CompanyOSGenerator
              companyId={companyId}
              companyName=""
              onGenerated={() => {
                setShowGenerator(false);
                refetchCompanyOS();
              }}
            />
          ) : (
            <div className="text-sm text-muted-foreground">Missing company context. Reopen after your profile loads.</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Edit Company OS</DialogTitle>
          </DialogHeader>
          {companyOS ? (
            <CompanyOSEditor
              companyOS={companyOS}
              onSaved={(os) => {
                refetchCompanyOS();
                setShowEditor(false);
              }}
              onCancel={() => setShowEditor(false)}
            />
          ) : (
            <div className="text-sm text-muted-foreground">Generate a Company OS first.</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={assistantDialogOpen} onOpenChange={setAssistantDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create context-first assistant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="assistant-name">Name</Label>
                <Input
                  id="assistant-name"
                  value={assistantForm.name}
                  onChange={(e) => setAssistantForm({ ...assistantForm, name: e.target.value })}
                  placeholder="Business Analyst"
                />
              </div>
              <div>
                <Label htmlFor="assistant-role">Role</Label>
                <Input
                  id="assistant-role"
                  value={assistantForm.role}
                  onChange={(e) => setAssistantForm({ ...assistantForm, role: e.target.value })}
                  placeholder="Margin expansion strategist"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="assistant-description">Purpose</Label>
              <Textarea
                id="assistant-description"
                value={assistantForm.description}
                onChange={(e) => setAssistantForm({ ...assistantForm, description: e.target.value })}
                placeholder="Helps finance leaders decide on pricing, costs, and product mix using Company OS and scoped docs."
                rows={3}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="assistant-model">Model</Label>
                <select
                  id="assistant-model"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={assistantForm.model}
                  onChange={(e) => setAssistantForm({ ...assistantForm, model: e.target.value })}
                >
                  <option value="gpt-4o-mini">GPT-4o mini (fast)</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="o3-2025-04-16">o3 (reasoning)</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
              <div>
                <Label htmlFor="assistant-temp">Temperature</Label>
                <Input
                  id="assistant-temp"
                  type="number"
                  step={0.1}
                  min={0}
                  max={1}
                  value={assistantForm.temperature}
                  onChange={(e) => setAssistantForm({ ...assistantForm, temperature: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Web search
                </div>
                <Switch
                  checked={assistantForm.webSearch}
                  onCheckedChange={(checked) => setAssistantForm({ ...assistantForm, webSearch: checked })}
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" /> Image generation
                </div>
                <Switch
                  checked={assistantForm.imageGen}
                  onCheckedChange={(checked) => setAssistantForm({ ...assistantForm, imageGen: checked })}
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" /> Deep research
                </div>
                <Switch
                  checked={assistantForm.deepResearch}
                  onCheckedChange={(checked) => setAssistantForm({ ...assistantForm, deepResearch: checked })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssistantDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAssistant} disabled={!companyId}>
                Create assistant
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
