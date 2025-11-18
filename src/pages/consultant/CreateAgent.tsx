import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Bot, Save, Loader2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)', description: 'Most capable, multimodal' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Fast and powerful' },
  { value: 'gpt-4', label: 'GPT-4', description: 'Standard GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fast and affordable' },
];

const RERANK_MODELS = [
  { value: 'cohere', label: 'Cohere Rerank v3.0' },
  { value: 'cross-encoder', label: 'Cross-Encoder' },
  { value: 'bm25', label: 'BM25 (Fallback)' },
];

const CITATION_FORMATS = [
  { value: 'footnote', label: 'Footnote [1]' },
  { value: 'inline', label: 'Inline (Source: ...)' },
  { value: 'none', label: 'None' },
];

export default function CreateAgent() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    role: "",
    description: "",
    model_name: "gpt-4o",
    temperature: 0.7,
    max_response_length: 2000,
    system_instructions: "",
  });

  const [contextConfig, setContextConfig] = useState({
    enable_company_os: true,
    enable_agent_docs: true,
    enable_shared_docs: true,
    enable_playbooks: true,
    enable_keyword_search: true,
    enable_structured_data: false,
    max_chunks_per_source: 5,
    total_max_chunks: 15,
    similarity_threshold: 0.7,
    enable_query_expansion: true,
    max_expanded_queries: 5,
    enable_reranking: true,
    rerank_model: 'cohere',
    citation_format: 'footnote',
  });

  useEffect(() => {
    if (workspaceId) {
      fetchCompanyData();
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

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleContextChange = (field: string, value: any) => {
    setContextConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.role) {
      toast({
        title: "Missing required fields",
        description: "Please provide at least a name and role for the agent",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // First create the agent
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .insert({
          company_id: workspaceId,
          name: formData.name,
          role: formData.role,
          description: formData.description || null,
          model_name: formData.model_name,
          temperature: formData.temperature,
          max_response_length: formData.max_response_length,
          system_instructions: formData.system_instructions || null,
          status: 'active',
        })
        .select()
        .single();

      if (agentError) throw agentError;

      // The context_injection_config will be auto-created by the database trigger
      // Now update it with our custom settings
      const { error: configError } = await supabase
        .from('context_injection_config')
        .update({
          retrieval_params: {
            enable_company_os: contextConfig.enable_company_os,
            enable_agent_docs: contextConfig.enable_agent_docs,
            enable_shared_docs: contextConfig.enable_shared_docs,
            enable_playbooks: contextConfig.enable_playbooks,
            enable_keyword_search: contextConfig.enable_keyword_search,
            enable_structured_data: contextConfig.enable_structured_data,
            max_chunks_per_source: contextConfig.max_chunks_per_source,
            total_max_chunks: contextConfig.total_max_chunks,
            similarity_threshold: contextConfig.similarity_threshold,
          },
          query_expansion_config: {
            enabled: contextConfig.enable_query_expansion,
            max_expansions: contextConfig.max_expanded_queries,
          },
          reranking_config: {
            enabled: contextConfig.enable_reranking,
            model: contextConfig.rerank_model,
            top_n: contextConfig.total_max_chunks,
          },
          citation_format: contextConfig.citation_format,
        })
        .eq('agent_id', agentData.id);

      if (configError) {
        console.error('Error updating context config:', configError);
        // Don't fail the whole operation for this
      }

      toast({
        title: "Agent created successfully!",
        description: `${formData.name} is now ready for use`,
      });

      // Navigate to the agent detail page
      navigate(`/consultant-portal/workspaces/${workspaceId}/agents/${agentData.id}`);
    } catch (error: any) {
      console.error('Error creating agent:', error);
      toast({
        title: "Error creating agent",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(`/consultant-portal/workspaces/${workspaceId}/agents`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agents
          </Button>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Create New Agent
          </h1>
          <p className="text-muted-foreground">
            Configure a new AI agent for {companyData?.name}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Define the agent's identity and purpose
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">
                  Agent Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g., Sales Support Agent"
                  required
                />
              </div>

              <div>
                <Label htmlFor="role">
                  Role/Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => handleFormChange('role', e.target.value)}
                  placeholder="e.g., Customer Success Specialist"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Brief description of what this agent does..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Model Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Model Configuration</CardTitle>
              <CardDescription>
                Choose the AI model and parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="model">Model</Label>
                <Select
                  value={formData.model_name}
                  onValueChange={(value) => handleFormChange('model_name', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        <div>
                          <div className="font-semibold">{model.label}</div>
                          <div className="text-xs text-muted-foreground">{model.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="temperature">
                  Temperature: {formData.temperature.toFixed(1)}
                </Label>
                <Slider
                  id="temperature"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[formData.temperature]}
                  onValueChange={([value]) => handleFormChange('temperature', value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower = more focused, Higher = more creative
                </p>
              </div>

              <div>
                <Label htmlFor="max_response_length">Max Response Length (tokens)</Label>
                <Input
                  id="max_response_length"
                  type="number"
                  value={formData.max_response_length}
                  onChange={(e) => handleFormChange('max_response_length', parseInt(e.target.value))}
                  min={100}
                  max={4000}
                />
              </div>
            </CardContent>
          </Card>

          {/* Context Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Context Injection Configuration</CardTitle>
              <CardDescription>
                Configure which context sources this agent can access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Context Sources */}
              <div className="space-y-4">
                <h4 className="font-semibold">Context Sources</h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable_company_os">CompanyOS</Label>
                    <p className="text-sm text-muted-foreground">
                      Core company information and strategy
                    </p>
                  </div>
                  <Switch
                    id="enable_company_os"
                    checked={contextConfig.enable_company_os}
                    onCheckedChange={(checked) => handleContextChange('enable_company_os', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable_agent_docs">Agent-Specific Documents</Label>
                    <p className="text-sm text-muted-foreground">
                      Documents uploaded specifically for this agent
                    </p>
                  </div>
                  <Switch
                    id="enable_agent_docs"
                    checked={contextConfig.enable_agent_docs}
                    onCheckedChange={(checked) => handleContextChange('enable_agent_docs', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable_shared_docs">Shared Company Documents</Label>
                    <p className="text-sm text-muted-foreground">
                      Documents shared across all agents
                    </p>
                  </div>
                  <Switch
                    id="enable_shared_docs"
                    checked={contextConfig.enable_shared_docs}
                    onCheckedChange={(checked) => handleContextChange('enable_shared_docs', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable_playbooks">Playbooks</Label>
                    <p className="text-sm text-muted-foreground">
                      Process documentation and guidelines
                    </p>
                  </div>
                  <Switch
                    id="enable_playbooks"
                    checked={contextConfig.enable_playbooks}
                    onCheckedChange={(checked) => handleContextChange('enable_playbooks', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable_keyword_search">Keyword Search</Label>
                    <p className="text-sm text-muted-foreground">
                      Hybrid search across all sources
                    </p>
                  </div>
                  <Switch
                    id="enable_keyword_search"
                    checked={contextConfig.enable_keyword_search}
                    onCheckedChange={(checked) => handleContextChange('enable_keyword_search', checked)}
                  />
                </div>
              </div>

              <Separator />

              {/* Advanced Settings Accordion */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="retrieval">
                  <AccordionTrigger>Retrieval Settings</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="max_chunks_per_source">
                        Max Chunks Per Source: {contextConfig.max_chunks_per_source}
                      </Label>
                      <Slider
                        id="max_chunks_per_source"
                        min={1}
                        max={10}
                        step={1}
                        value={[contextConfig.max_chunks_per_source]}
                        onValueChange={([value]) => handleContextChange('max_chunks_per_source', value)}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="total_max_chunks">
                        Total Max Chunks: {contextConfig.total_max_chunks}
                      </Label>
                      <Slider
                        id="total_max_chunks"
                        min={5}
                        max={20}
                        step={1}
                        value={[contextConfig.total_max_chunks]}
                        onValueChange={([value]) => handleContextChange('total_max_chunks', value)}
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="similarity_threshold">
                        Similarity Threshold: {contextConfig.similarity_threshold.toFixed(2)}
                      </Label>
                      <Slider
                        id="similarity_threshold"
                        min={0.5}
                        max={0.9}
                        step={0.05}
                        value={[contextConfig.similarity_threshold]}
                        onValueChange={([value]) => handleContextChange('similarity_threshold', value)}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Higher values mean stricter relevance requirements
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="query-expansion">
                  <AccordionTrigger>Query Expansion</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable_query_expansion">Enable Query Expansion</Label>
                      <Switch
                        id="enable_query_expansion"
                        checked={contextConfig.enable_query_expansion}
                        onCheckedChange={(checked) => handleContextChange('enable_query_expansion', checked)}
                      />
                    </div>

                    {contextConfig.enable_query_expansion && (
                      <div>
                        <Label htmlFor="max_expanded_queries">
                          Max Expanded Queries: {contextConfig.max_expanded_queries}
                        </Label>
                        <Slider
                          id="max_expanded_queries"
                          min={1}
                          max={10}
                          step={1}
                          value={[contextConfig.max_expanded_queries]}
                          onValueChange={([value]) => handleContextChange('max_expanded_queries', value)}
                          className="mt-2"
                        />
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="reranking">
                  <AccordionTrigger>Reranking</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable_reranking">Enable Reranking</Label>
                      <Switch
                        id="enable_reranking"
                        checked={contextConfig.enable_reranking}
                        onCheckedChange={(checked) => handleContextChange('enable_reranking', checked)}
                      />
                    </div>

                    {contextConfig.enable_reranking && (
                      <div>
                        <Label htmlFor="rerank_model">Rerank Model</Label>
                        <Select
                          value={contextConfig.rerank_model}
                          onValueChange={(value) => handleContextChange('rerank_model', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RERANK_MODELS.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                {model.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="citations">
                  <AccordionTrigger>Citations</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="citation_format">Citation Format</Label>
                      <Select
                        value={contextConfig.citation_format}
                        onValueChange={(value) => handleContextChange('citation_format', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CITATION_FORMATS.map((format) => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* System Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>System Instructions (Optional)</CardTitle>
              <CardDescription>
                Custom prompt template with Jinja2-style variables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.system_instructions}
                onChange={(e) => handleFormChange('system_instructions', e.target.value)}
                placeholder="You are {{ agent.name }}, a {{ agent.role }}. Use the following context to answer questions accurately..."
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Leave empty to use default instructions. Available variables: agent.name, agent.role, company.name
              </p>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/consultant-portal/workspaces/${workspaceId}/agents`)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Agent
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
