import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateDatabaseAgent } from "@/lib/company-agent-utils";

interface EditAgentModalProps {
  agent: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAgentModal({ agent, open, onOpenChange }: EditAgentModalProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: agent.name,
    role: agent.role,
    description: agent.description,
    system_instructions: agent.system_instructions || "",
  });

  // Fetch agent's current tools
  const { data: agentTools, isLoading: agentToolsLoading } = useQuery({
    queryKey: ["agent-tools", agent.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_tools")
        .select("*")
        .eq("agent_id", agent.id);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await updateDatabaseAgent(agent.id, formData);
      if (result.success) {
        toast.success("Agent updated successfully");
        queryClient.invalidateQueries({ queryKey: ["company-agents"] });
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to update agent");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleToolEnabled = async (toolRecordId: string, currentEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from("agent_tools")
        .update({ is_enabled: !currentEnabled })
        .eq("id", toolRecordId);
      if (error) throw error;
      toast.success(currentEnabled ? "Tool disabled" : "Tool enabled");
      queryClient.invalidateQueries({ queryKey: ["agent-tools", agent.id] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Agent</DialogTitle>
          <DialogDescription>
            Update agent details and manage tool access
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="system_instructions">System Instructions</Label>
              <Textarea
                id="system_instructions"
                value={formData.system_instructions}
                onChange={(e) => setFormData({ ...formData, system_instructions: e.target.value })}
                rows={4}
                placeholder="Custom instructions for this agent..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Tools</Label>
            {agentToolsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : agentTools && agentTools.length > 0 ? (
              <div className="space-y-2 border rounded-lg p-4">
                {agentTools.map((tool) => (
                  <div key={tool.id} className="flex items-center justify-between py-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Tool ID: {tool.tool_id}</span>
                        <Badge variant={tool.is_enabled ? "default" : "secondary"}>
                          {tool.is_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                    <Switch
                      checked={tool.is_enabled}
                      onCheckedChange={() => toggleToolEnabled(tool.id, tool.is_enabled)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                No tools configured for this agent
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
