import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Maximize2 } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

export interface AgentFormData {
  name: string;
  description: string;
  role: string;
  nickname: string;
  status: "active" | "training" | "inactive" | "paused";
  systemInstructions: string;
  agent_type_id?: string;
  ai_provider: string;
  ai_model: string;
  max_tokens: number;
  web_access: boolean;
}

interface AgentFormFieldsProps {
  formData: AgentFormData;
  setFormData: Dispatch<SetStateAction<AgentFormData>>;
  getModelOptions: (provider: string) => { value: string; label: string }[];
  openInstructionsEditor: () => void;
  idPrefix?: string;
}

export function AgentFormFields({
  formData,
  setFormData,
  getModelOptions,
  openInstructionsEditor,
  idPrefix = "",
}: AgentFormFieldsProps) {
  const prefix = idPrefix ? `${idPrefix}-` : "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
      {/* Left Column - Configuration */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Configuration</h3>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor={`${prefix}systemInstructions`}>System Instructions</Label>
            <Button variant="ghost" size="sm" onClick={openInstructionsEditor}>
              <Maximize2 className="mr-1 h-4 w-4" /> Expand
            </Button>
          </div>
          <Textarea
            id={`${prefix}systemInstructions`}
            value={formData.systemInstructions}
            onChange={(e) =>
              setFormData({
                ...formData,
                systemInstructions: e.target.value,
              })
            }
            placeholder="Enter the exact instructions that will be sent to the OpenAI assistant. This defines how the agent will behave and respond."
            rows={6}
            className="min-h-[120px]"
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}ai_provider`}>AI Provider</Label>
          <Select
            value={formData.ai_provider}
            onValueChange={(value) => {
              const newProvider = value;
              const newModel = getModelOptions(newProvider)[0]?.value || "gpt-4o-mini";
              setFormData({
                ...formData,
                ai_provider: newProvider,
                ai_model: newModel,
              });
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
          <Label htmlFor={`${prefix}ai_model`}>AI Model</Label>
          <Select
            value={formData.ai_model}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                ai_model: value,
              })
            }
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
          <Label htmlFor={`${prefix}max_tokens`}>Max Tokens</Label>
          <Input
            id={`${prefix}max_tokens`}
            type="number"
            value={formData.max_tokens}
            onChange={(e) =>
              setFormData({
                ...formData,
                max_tokens: parseInt(e.target.value) || 2000,
              })
            }
            placeholder="2000"
            min="100"
            max="128000"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor={`${prefix}web_access`}>Enable Web Access</Label>
          <Switch
            id={`${prefix}web_access`}
            checked={formData.web_access}
            onCheckedChange={(checked) =>
              setFormData({
                ...formData,
                web_access: checked,
              })
            }
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}status`}>Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value: AgentFormData["status"]) =>
              setFormData({
                ...formData,
                status: value,
              })
            }
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
          <Label htmlFor={`${prefix}name`}>Name</Label>
          <Input
            id={`${prefix}name`}
            value={formData.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                name: e.target.value,
              })
            }
            placeholder="Agent name"
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}role`}>Role</Label>
          <Input
            id={`${prefix}role`}
            value={formData.role}
            onChange={(e) =>
              setFormData({
                ...formData,
                role: e.target.value,
              })
            }
            placeholder="e.g., Customer Support, Sales Assistant"
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}nickname`}>Nickname</Label>
          <Input
            id={`${prefix}nickname`}
            value={formData.nickname}
            onChange={(e) =>
              setFormData({
                ...formData,
                nickname: e.target.value,
              })
            }
            placeholder="e.g., @marketing-bot, @sales-assistant"
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}description`}>Description</Label>
          <Textarea
            id={`${prefix}description`}
            value={formData.description}
            onChange={(e) =>
              setFormData({
                ...formData,
                description: e.target.value,
              })
            }
            placeholder="Agent description and capabilities"
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}
