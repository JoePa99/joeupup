import { useState } from "react";
import { Bars3Icon, BookOpenIcon, UserPlusIcon, PuzzlePieceIcon, ChartBarIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

export function FloatingMenuButton() {
  const navigate = useNavigate();
  const [menuPopoverOpen, setMenuPopoverOpen] = useState(false);

  const menuItems = [
    { icon: BookOpenIcon, label: "Playbook", path: "/playbook" },
    { icon: UserPlusIcon, label: "Team Management", path: "/invite-team" },
    { icon: PuzzlePieceIcon, label: "Integrations", path: "/integrations" },
    { icon: ChartBarIcon, label: "Usage & Billing", path: "/client-dashboard/usage" },
    { icon: Cog6ToothIcon, label: "Settings", path: "/settings" },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setMenuPopoverOpen(false);
  };

  return (
    <div className="absolute top-[80px] -right-4 w-full h-12 pointer-events-none" style={{ zIndex: 10000 }}>
      <Popover open={menuPopoverOpen} onOpenChange={setMenuPopoverOpen}>
        <PopoverTrigger asChild>
          <Button 
            className={`absolute top-0 flex items-center justify-center cursor-pointer hover:bg-gray-100 text-gray-700 hover:text-gray-900 bg-white shadow-sm border border-gray-200 pointer-events-auto rounded-[6px] h-8 w-8 p-0 transition-all duration-200 ${menuPopoverOpen ? 'right-6' : 'right-0'}`}
            size="sm"
          >
            <Bars3Icon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8} className={`!z-[9990] pt-[20px] h-screen w-[70px] p-8 pl-2 transition-all duration-200 bg-white shadow-none rounded-none border-r-1 border-l-0 ${menuPopoverOpen ? 'ml-[4px]' : 'ml-[-20px]'}`}>
          <TooltipProvider>
            <div className="space-y-4 bg-white grid grid-cols-1 gap-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        onClick={() => handleNavigation(item.path)}
                        className="w-9 justify-center hover:bg-gray-100  rounded-[6px] hover:text-gray-900 shadow-sm text-gray-700 h-9 px-2"
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="rounded-sm bg-white">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </PopoverContent>
      </Popover>
    </div>
  );
}

