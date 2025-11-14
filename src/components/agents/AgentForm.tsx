import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { createDefaultAgent, updateDefaultAgent } from "@/lib/default-agent-utils";
import { createDatabaseAgent, updateDatabaseAgent } from "@/lib/company-agent-utils";

const createAgentFormSchema = (isDefaultAgent: boolean) => z.object({
  name: z.string().min(1, "Agent name is required").max(100, "Name must be less than 100 characters"),
  role: isDefaultAgent ? z.string().optional() : z.string().min(1, "Role is required").max(50, "Role must be less than 50 characters"),
  description: z.string().optional(),
  agent_type_id: z.string().uuid("Please select an agent type"),
  status: z.enum(["active", "training", "inactive", "paused"]),
  avatar_url: z.string().url().optional().or(z.literal("")),
  system_instructions: z.string().optional(),
  ai_provider: z.enum(["openai", "anthropic", "google"]).default("openai"),
  ai_model: z.string().min(1, "Model is required"),
  max_tokens: z.number().min(100).max(32000).default(2000),
  web_access: z.boolean().default(false),
});

type AgentFormData = z.infer<ReturnType<typeof createAgentFormSchema>>;

interface AgentFormProps {
  agent?: any; // For editing existing agent
  onSuccess: (agentData?: any) => void;
  onCancel: () => void;
  isDefaultAgent?: boolean; // Whether this is for default agents
}

export function AgentForm({ agent, onSuccess, onCancel, isDefaultAgent = false }: AgentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agentTypes, setAgentTypes] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  const form = useForm<AgentFormData>({
    resolver: zodResolver(createAgentFormSchema(isDefaultAgent)),
    defaultValues: {
      name: agent?.name || "",
      role: agent?.role || "",
      description: agent?.description || "",
      agent_type_id: agent?.agent_type_id || "",
      status: agent?.status || "training",
      avatar_url: agent?.avatar_url || "",
      system_instructions: agent?.configuration?.instructions || "",
      ai_provider: agent?.configuration?.ai_provider || "openai",
      ai_model: agent?.configuration?.ai_model || "gpt-4o",
      max_tokens: agent?.configuration?.max_tokens || 2000,
      web_access: agent?.configuration?.web_access || false,
    },
  });

  const selectedProvider = form.watch("ai_provider");

  // Provider-specific model options
  const getModelOptions = (provider: string) => {
    switch (provider) {
      case "openai":
        return [
          { value: "gpt-5-2025-08-07", label: "GPT-5 (Most Advanced)" },
          { value: "o3-2025-04-16", label: "o3 Reasoning" },
          { value: "o4-mini-2025-04-16", label: "o4-mini (Fast & Efficient)" },
          { value: "gpt-4o", label: "GPT-4o" },
          { value: "gpt-4o-mini", label: "GPT-4o Mini" },
          { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
          { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Legacy)" },
        ];
      case "anthropic":
        return [
          { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 (Latest)" },
          { value: "claude-opus-4-1-20250805", label: "Claude Opus 4.1" },
          { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
          { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
          { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
        ];
      case "google":
        return [
          { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
          { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
          { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
          { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (Experimental)" },
        ];
      default:
        return [];
    }
  };

  // Fetch user profile and agent types
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      // Get user profile for company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      setUserProfile(profile);

      // Get agent types
      const { data: types } = await supabase
        .from('agent_types')
        .select('*')
        .order('name');
      
      setAgentTypes(types || []);
    };

    fetchData();
  }, [user]);

  const onSubmit = async (values: AgentFormData) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not found",
        variant: "destructive",
      });
      return;
    }

    // For company agents, we need the company_id
    if (!isDefaultAgent && !userProfile?.company_id) {
      toast({
        title: "Error",
        description: "User profile not found",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const config = {
        instructions: values.system_instructions || null,
        ai_provider: values.ai_provider,
        ai_model: values.ai_model,
        max_tokens: values.max_tokens,
        web_access: values.web_access,
      };

      if (isDefaultAgent) {
        // Handle default agents
        const defaultAgentData = {
          agent_type_id: values.agent_type_id,
          name: values.name,
          role: values.role || '', // Will be overridden by agent_type name in createDefaultAgent
          description: values.description || null,
          configuration: config,
          status: values.status,
          company_id: userProfile?.company_id || '',
          created_by: user.id,
        };

        let result;
        if (agent?.id) {
          result = await updateDefaultAgent(agent.id, defaultAgentData);
        } else {
          result = await createDefaultAgent(defaultAgentData);
        }

        if (!result.success) {
          throw new Error(result.error);
        }

        toast({
          title: "Success",
          description: `Default agent "${values.name}" ${agent?.id ? 'updated' : 'created'} successfully`,
        });

        onSuccess(result.data);
      } else {
        // Handle company agents
        const companyAgentData = {
          name: values.name,
          role: values.role,
          description: values.description || null,
          agent_type_id: values.agent_type_id,
          status: values.status,
          configuration: config,
          company_id: userProfile.company_id,
          created_by: user.id,
        };

        let result;
        if (agent?.id) {
          result = await updateDatabaseAgent(agent.id, companyAgentData);
        } else {
          result = await createDatabaseAgent(companyAgentData);
        }

        if (!result.success) {
          throw new Error(result.error);
        }

        toast({
          title: "Success",
          description: `Agent "${values.name}" ${agent?.id ? 'updated' : 'created'} successfully`,
        });

        onSuccess(result.data);
      }
    } catch (error: any) {
      console.error('Error saving agent:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save agent",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Customer Support Assistant" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isDefaultAgent && (
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Customer Support Specialist" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="agent_type_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agent type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {agentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="avatar_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/avatar.png" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe what this agent does and its capabilities..." 
                  className="min-h-[100px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="system_instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>System Instructions</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter the system instructions for this agent..." 
                  className="min-h-[150px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">AI Configuration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ai_provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI Provider *</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Reset model when provider changes to latest recommended models
                      const defaultModels = {
                        openai: "gpt-5-2025-08-07",
                        anthropic: "claude-sonnet-4-5-20250929",
                        google: "gemini-2.5-pro"
                      };
                      form.setValue("ai_model", defaultModels[value as keyof typeof defaultModels]);
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select AI provider" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google AI</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ai_model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI Model *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getModelOptions(selectedProvider).map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <FormField
              control={form.control}
              name="max_tokens"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Tokens</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={100}
                      max={32000}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="web_access"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Web Access</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable real-time web search capabilities
                    </div>
                  </div>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? "Saving..." : agent?.id ? "Update Agent" : "Create Agent"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
