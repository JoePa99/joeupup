import { useLocation } from "react-router-dom";
import { 
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  TrendingUp,
  ChevronLeft,
  BookOpen,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface ClientSidebarProps {
  clientId: string;
  clientName: string;
  onBack?: () => void;
}

export function ClientSidebar({ clientId, clientName, onBack }: ClientSidebarProps) {
  const location = useLocation();
  
  // Build navigation items with client-specific paths
  const navigation = [
    { name: "Overview", path: "overview", icon: LayoutDashboard },
    { name: "Users", path: "users", icon: Users },
    { name: "Documents", path: "documents", icon: FileText },
    { name: "Consultations", path: "consultations", icon: MessageSquare },
    { name: "Onboarding", path: "onboarding", icon: TrendingUp },
    { name: "Playbook", path: "playbook", icon: BookOpen },
    { name: "Company Agents", path: "agents", icon: Bot },
  ];

  // Check if current hash matches the section
  const getCurrentSection = () => {
    const hash = location.hash.replace('#', '');
    return hash || 'overview';
  };

  const isActive = (path: string) => getCurrentSection() === path;

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-4">
        <div className="space-y-2">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="w-full justify-start"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          )}
          <div>
            <h2 className="text-lg font-bold text-gradient truncate">{clientName}</h2>
            <p className="text-xs text-muted-foreground">Client Details</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.path)}
                      tooltip={item.name}
                    >
                      <a href={`#${item.path}`}>
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

