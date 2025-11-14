import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Settings, X } from "lucide-react";
interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  nickname: string | null;
  avatar_url: string | null;
  status: string;
}
interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
}
interface ChatHeaderProps {
  type: 'agent' | 'channel';
  agent?: Agent | null;
  channel?: Channel | null;
  onSettingsClick: () => void;
  isSettingsOpen?: boolean;
}
export function ChatHeader({
  type,
  agent,
  channel,
  onSettingsClick,
  isSettingsOpen = false
}: ChatHeaderProps) {
  if (type === 'agent' && agent) {
    return <div className="p-2 sm:p-4 border-b border-border overflow-x-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
              <AvatarImage src={agent.avatar_url || ''} />
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="font-body font-semibold text-foreground text-sm sm:text-base truncate">{agent.name}</h2>
              <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onSettingsClick} className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>;
  }
  if (type === 'channel' && channel) {
    return <div className="p-2 sm:p-4 border-b border-border overflow-x-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-semibold text-foreground truncate">#{channel.name}</h2>
              <p className="text-xs text-muted-foreground truncate">
                {channel.description || 'Team channel'}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onSettingsClick} className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
            {isSettingsOpen ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
          </Button>
        </div>
      </div>;
  }
  return null;
}