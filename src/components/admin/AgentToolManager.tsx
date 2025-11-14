import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTools, useAgentTools, useAgentToolMutations } from "@/hooks/useAgentTools";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { 
  Settings, 
  Mail, 
  FileText, 
  HardDrive, 
  Sheet,
  Loader2
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  role: string;
  status: 'active' | 'training' | 'inactive' | 'paused';
}

interface AgentToolManagerProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
}

const getToolIcon = (toolName: string) => {
  switch (toolName) {
    case 'gmail_search': return Mail;
    case 'drive_search': return HardDrive;
    case 'docs_read': return FileText;
    case 'sheets_read': return Sheet;
    default: return Settings;
  }
};

const getToolColor = (toolName: string) => {
  switch (toolName) {
    case 'gmail_search': return 'text-red-500';
    case 'drive_search': return 'text-blue-500';
    case 'docs_read': return 'text-blue-600';
    case 'sheets_read': return 'text-green-500';
    default: return 'text-gray-500';
  }
};

export function AgentToolManager({ agent, isOpen, onClose }: AgentToolManagerProps) {
  const { data: availableTools = [], isLoading: toolsLoading } = useTools();
  const { data: agentTools = [], isLoading: agentToolsLoading } = useAgentTools(agent.id);
  const { assignTool, unassignTool, updateToolConfig } = useAgentToolMutations();
  const { data: platformAdminData } = usePlatformAdmin();
  
  const isPlatformAdmin = platformAdminData?.success && platformAdminData?.isAdmin;

  const isToolAssigned = (toolId: string) => {
    return agentTools.some(at => at.tool_id === toolId);
  };

  const getAgentTool = (toolId: string) => {
    return agentTools.find(at => at.tool_id === toolId);
  };

  const handleToolToggle = async (toolId: string) => {
    const agentTool = getAgentTool(toolId);
    const isAssigned = isToolAssigned(toolId);
    
    if (!isAssigned) {
      // If not assigned, assign and enable the tool
      assignTool.mutate({ agentId: agent.id, toolId });
    } else {
      // If assigned, toggle the enabled state
      updateToolConfig.mutate({
        agentId: agent.id,
        toolId,
        isEnabled: !agentTool?.is_enabled
      });
    }
  };

  const isLoading = toolsLoading || agentToolsLoading;
  const assignedCount = agentTools.length;
  const activeCount = agentTools.filter(at => at.is_enabled).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manage Tools for {agent.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">

            <div className="space-y-3">
              {availableTools.map((tool) => {
                const isAssigned = isToolAssigned(tool.id);
                const agentTool = getAgentTool(tool.id);
                const IconComponent = getToolIcon(tool.name);
                const iconColor = getToolColor(tool.name);

                return (
                  <Card key={tool.id} className={`transition-all ${isAssigned ? 'ring-2 ring-primary/20' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <IconComponent className={`h-6 w-6 ${iconColor}`} />
                          <div>
                            <CardTitle className="text-base">{tool.display_name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{tool.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAssigned && (
                            <Badge variant="secondary" className="text-xs">
                              {agentTool?.is_enabled ? 'Active' : 'Disabled'}
                            </Badge>
                          )}
                          {isPlatformAdmin && (
                            <Switch
                              checked={isAssigned && agentTool?.is_enabled}
                              onCheckedChange={() => handleToolToggle(tool.id)}
                              disabled={assignTool.isPending || unassignTool.isPending || updateToolConfig.isPending}
                            />
                          )}
                        </div>
                      </div>
                    </CardHeader>

                  </Card>
                );
              })}
            </div>

            {availableTools.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No tools available
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}