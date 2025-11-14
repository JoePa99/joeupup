import { Link } from "react-router-dom";
import { 
  BookOpen, 
  Bot, 
  Settings, 
  TrendingUp,
  Play,
  CheckCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tiles = [
  {
    title: "Complete Onboarding",
    description: "Finish setting up your knowledge base",
    icon: CheckCircle,
    href: "/onboarding",
    progress: 75,
    badge: "3 steps left",
    badgeVariant: "secondary" as const,
    gradient: "from-accent to-accent/80"
  },
  {
    title: "Knowledge Base",
    description: "Manage your company playbook",
    icon: BookOpen,
    href: "/playbook",
    badge: "12 sections",
    badgeVariant: "outline" as const,
    gradient: "from-primary to-primary/80"
  },
  {
    title: "AI Agents",
    description: "Monitor and manage your agents",
    icon: Bot,
    href: "/agents",
    badge: "3 active",
    badgeVariant: "secondary" as const,
    gradient: "from-secondary to-secondary/80"
  },
  {
    title: "Analytics",
    description: "View performance metrics",
    icon: TrendingUp,
    href: "/analytics",
    badge: "New insights",
    badgeVariant: "outline" as const,
    gradient: "from-success to-success/80"
  }
];

export function QuickAccessTiles() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-foreground">Quick Access</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.title} to={tile.href} className="group">
              <Card className="relative overflow-hidden hover-lift cursor-pointer h-full">
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={cn(
                      "p-3 rounded-lg bg-gradient-to-br",
                      tile.gradient
                    )}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <Badge variant={tile.badgeVariant} className="text-xs">
                      {tile.badge}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {tile.title}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {tile.description}
                    </p>
                  </div>

                  {tile.progress && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Progress</span>
                        <span className="font-medium text-xs">{tile.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-black transition-all duration-300"
                          style={{ width: `${tile.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Hover effect background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}