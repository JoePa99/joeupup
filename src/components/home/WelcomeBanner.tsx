import { ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

export function WelcomeBanner() {
  return (
    <Card className="relative overflow-hidden bg-gradient-hero border-0 p-8 mb-8">
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">
                Build Smarter with <span className="text-gradient">AI Agents</span>
              </h1>
              <p className="text-text-secondary text-lg">
                Transform your business operations with intelligent AI agents that work 24/7
              </p>
            </div>
            
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse"></div>
                <span className="text-text-secondary">Always-on automation</span>
              </div>
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-text-secondary" />
                <span className="text-text-secondary">Intelligent workflows</span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Link to="/login">
                <Button className="btn-hero group">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="ghost">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-primary opacity-20 blur-xl"></div>
              <div className="absolute inset-0 w-32 h-32 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                <Activity className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 rounded-full bg-gradient-primary opacity-5 blur-3xl"></div>
    </Card>
  );
}