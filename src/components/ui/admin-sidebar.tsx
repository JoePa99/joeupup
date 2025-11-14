import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPlatformAdmin } from "@/hooks/useAdminData";
import {
  ChartBarIcon,
  CpuChipIcon,
  UserIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  ChevronUpIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  ChatBubbleLeftEllipsisIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";
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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBadge } from "@/components/ui/notification-center";

// Base navigation items available to all platform admins
const baseAdminNavigation = [
  { name: "Agents", href: "/dashboard/agents", icon: CpuChipIcon },
  { name: "Consultations", href: "/dashboard/consultations", icon: ChatBubbleLeftEllipsisIcon },
  { name: "Supabase Health", href: "/dashboard/supabase-health", icon: ChartBarIcon },
  { name: "Users", href: "/dashboard/users", icon: UserIcon },
  { name: "Companies", href: "/dashboard/companies", icon: BuildingOfficeIcon },
  { name: "Documents", href: "/dashboard/documents", icon: DocumentTextIcon },
];

// Dashboard item (only for platform admins)
const dashboardItem = { name: "Dashboard", href: "/dashboard", icon: HomeIcon };

export function AdminSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const isActive = (href: string) => location.pathname === href;

  const getInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <Sidebar className="bg-white" collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-gray-200 p-4 bg-white">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-2">
              <img 
                src="/upupdndnstacked.png" 
                alt="upup dndn logo" 
                className="h-14 object-contain"
              />
            </div>
          )}
          <NotificationBadge className={collapsed ? "mx-auto" : ""} />
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-white">
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard - only visible to platform admins */}
              {isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(dashboardItem.href)}
                    tooltip={dashboardItem.name}
                  >
                    <Link to={dashboardItem.href}>
                      <dashboardItem.icon className="h-4 w-4" />
                      <span>{dashboardItem.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
              {/* Other admin navigation items */}
              {baseAdminNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.name}
                    >
                      <Link to={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200 bg-white">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="" />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left text-sm truncate">
                    {user?.email}
                  </div>
                  <ChevronUpIcon className="h-4 w-4 ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center cursor-pointer">
                    <Cog6ToothIcon className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/privacy" className="flex items-center cursor-pointer">
                    <DocumentTextIcon className="mr-2 h-4 w-4" />
                    Privacy Policy
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/terms" className="flex items-center cursor-pointer">
                    <DocumentTextIcon className="mr-2 h-4 w-4" />
                    Terms of Service
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-destructive cursor-pointer"
                >
                  <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

