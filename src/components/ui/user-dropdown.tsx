import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut, ChevronDown } from "lucide-react";
export function UserDropdown() {
  const {
    user,
    signOut
  } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  if (!user) return null;
  const getInitials = () => {
    const email = user.email || "";
    return email.slice(0, 2).toUpperCase();
  };
  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };
  return <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2 border-none hover:bg-muted/50">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-sm font-medium text-foreground">{user.email}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium">{user.email}</span>
            <span className="text-xs text-muted-foreground">Admin Account</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>;
}