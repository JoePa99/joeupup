import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAgentTools } from "@/hooks/useAgentTools";
import { 
  Mail, 
  FileText, 
  HardDrive, 
  Sheet,
  Settings,
  Loader2
} from "lucide-react";

interface ToolStatusIndicatorsProps {
  agentId: string;
  variant?: 'badges' | 'icons' | 'compact';
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

export function ToolStatusIndicators({ agentId, variant = 'icons' }: ToolStatusIndicatorsProps) {
  const { data: agentTools = [], isLoading } = useAgentTools(agentId);

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  const activeTools = agentTools.filter(at => at.is_enabled && at.tool);
  const totalTools = agentTools.length;

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1">
        <Settings className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {activeTools.length}/{totalTools} tools
        </span>
      </div>
    );
  }

  if (variant === 'badges') {
    return (
      <div className="flex flex-wrap gap-1">
        {activeTools.map((agentTool) => {
          const tool = agentTool.tool!;
          return (
            <Badge key={agentTool.id} variant="secondary" className="text-xs">
              {tool.display_name}
            </Badge>
          );
        })}
        {totalTools === 0 && (
          <Badge variant="outline" className="text-xs">
            No tools
          </Badge>
        )}
      </div>
    );
  }

  // Default: icons variant
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {activeTools.map((agentTool) => {
          const tool = agentTool.tool!;
          const IconComponent = getToolIcon(tool.name);
          const iconColor = getToolColor(tool.name);

          return (
            <Tooltip key={agentTool.id}>
              <TooltipTrigger>
                <IconComponent className={`h-4 w-4 ${iconColor}`} />
              </TooltipTrigger>
              <TooltipContent>
                <p>{tool.display_name}</p>
                <p className="text-xs text-muted-foreground">{tool.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        
        {totalTools === 0 && (
          <Tooltip>
            <TooltipTrigger>
              <Settings className="h-4 w-4 text-muted-foreground opacity-50" />
            </TooltipTrigger>
            <TooltipContent>
              <p>No tools assigned</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}