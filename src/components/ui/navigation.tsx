import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformAdmin } from "@/hooks/use-platform-admin";
import { 
  Home, 
  BookOpen, 
  Bot, 
  User, 
  HelpCircle, 
  Menu, 
  X,
  Settings,
  UserPlus,
  LogIn,
  Building2
} from "lucide-react";
import { UserDropdown } from "./user-dropdown";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { data: platformAdminData } = usePlatformAdmin();

  const isActive = (href: string) => location.pathname === href;

  // Dynamic navigation based on user role
  const getNavigation = () => {
    const baseNavigation = [
      { name: "Home", href: "/", icon: Home },
      { name: "Playbook", href: "/playbook", icon: BookOpen },
    ];

    // Add agent management based on role
    if (platformAdminData?.success && platformAdminData?.isAdmin) {
      baseNavigation.push(
        { name: "Default Agents", href: "/agents", icon: Bot },
        { name: "Company Agents", href: "/company-agents", icon: Building2 }
      );
    } else {
      baseNavigation.push({ name: "AI Agents", href: "/company-agents", icon: Bot });
    }

    baseNavigation.push(
      { name: "Profile", href: "/profile", icon: User },
      { name: "Help", href: "/help", icon: HelpCircle }
    );

    return baseNavigation;
  };

  const navigation = getNavigation();

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center space-x-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200",
                isActive(item.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-64 bg-card border-l border-border p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Menu</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors duration-200 w-full",
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

export function Header() {
  const { user } = useAuth();
  
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="text-xl font-bold text-gradient">Variable</span>
            </Link>
          </div>

          {user ? (
            <>
              <Navigation />
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
                <UserDropdown />
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-3">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </Link>
              <Link to="/login">
                <Button size="sm" className="flex items-center space-x-2">
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Up</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}