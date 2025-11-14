import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/ui/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowRight, 
  Bot, 
  Brain, 
  Zap, 
  Shield, 
  Users, 
  BookOpen, 
  MessageSquare, 
  TrendingUp, 
  CheckCircle, 
  Star,
  Play,
  BarChart3,
  FileText,
  Globe,
  Lock,
  Sparkles,
  UserPlus,
  LogIn,
  ThumbsUp,
  Copy,
  Clock,
  ChevronDown,
  Award,
  Target,
  Rocket
} from "lucide-react";

const Index = () => {
  const { user, loading, isOnboardingComplete } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect authenticated users to appropriate dashboard
    if (!loading && user) {
      if (isOnboardingComplete === true) {
        // User has completed onboarding, redirect to client dashboard
        navigate('/client-dashboard', { replace: true });
      } else if (isOnboardingComplete === false) {
        // User hasn't completed onboarding, redirect to onboarding
        navigate('/onboarding', { replace: true });
      }
      // If isOnboardingComplete is null, wait for it to be determined
    }
  }, [user, loading, isOnboardingComplete, navigate]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is authenticated, don't render the landing page content
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto text-center relative z-10">
          <div className="max-w-4xl mx-auto space-y-8">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="w-3 h-3 mr-2" />
              AI-Powered Knowledge Engine
            </Badge>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Transform Your Business with
              <span className="block text-gradient bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Intelligent AI Agents
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
              Build, deploy, and manage AI agents that understand your business, 
              automate complex workflows, and provide intelligent insights 24/7.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="btn-hero group">
                  <UserPlus className="mr-2 h-5 w-5" />
                  Sign Up Free
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="group">
                  <LogIn className="mr-2 h-5 w-5" />
                  Sign In
                </Button>
              </Link>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-8 text-sm text-text-secondary">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Setup in minutes</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Enterprise security</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 rounded-full bg-gradient-primary opacity-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-gradient-secondary opacity-10 blur-3xl"></div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Build AI Agents
            </h2>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              From knowledge management to intelligent automation, our platform provides 
              all the tools you need to create powerful AI solutions.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <Card className="p-6 sm:p-8 hover-lift group border-0 shadow-lg">
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 mb-6 w-fit">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                AI Agent Creation
              </h3>
              <p className="text-text-secondary mb-4">
                Build custom AI agents tailored to your business needs. Train them on your 
                knowledge base and deploy them across multiple channels.
              </p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Custom training models</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Multi-channel deployment</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Real-time learning</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover-lift group border-0 shadow-lg">
              <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/5 mb-6 w-fit">
                <Brain className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Knowledge Management
              </h3>
              <p className="text-text-secondary mb-4">
                Create comprehensive playbooks and knowledge bases that your AI agents 
                use to make informed decisions and maintain consistency.
              </p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Version control</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Team collaboration</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Auto-updates</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover-lift group border-0 shadow-lg">
              <div className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 mb-6 w-fit">
                <Zap className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Workflow Automation
              </h3>
              <p className="text-text-secondary mb-4">
                Automate complex business processes with intelligent workflows that 
                adapt and learn from your operations.
              </p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Process optimization</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Smart routing</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Performance analytics</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover-lift group border-0 shadow-lg">
              <div className="p-4 rounded-xl bg-gradient-to-br from-success/10 to-success/5 mb-6 w-fit">
                <Shield className="h-8 w-8 text-success" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Enterprise Security
              </h3>
              <p className="text-text-secondary mb-4">
                Bank-grade security with role-based access control, audit logs, and 
                compliance with industry standards.
              </p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>RBAC controls</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Audit trails</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Data encryption</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover-lift group border-0 shadow-lg">
              <div className="p-4 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 mb-6 w-fit">
                <BarChart3 className="h-8 w-8 text-warning" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Analytics & Insights
              </h3>
              <p className="text-text-secondary mb-4">
                Get deep insights into your AI agents' performance and business 
                operations with comprehensive analytics.
              </p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Real-time metrics</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Custom dashboards</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Predictive analytics</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover-lift group border-0 shadow-lg">
              <div className="p-4 rounded-xl bg-gradient-to-br from-info/10 to-info/5 mb-6 w-fit">
                <Globe className="h-8 w-8 text-info" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Multi-Platform Support
              </h3>
              <p className="text-text-secondary mb-4">
                Deploy your AI agents across multiple platforms and integrate 
                seamlessly with your existing tools and workflows.
              </p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>API integrations</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Webhook support</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>Custom connectors</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              Get started with AI agents in three simple steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mx-auto text-white font-bold text-xl">
                  1
                </div>
                <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 w-8 h-0.5 bg-gradient-to-r from-primary to-transparent hidden md:block"></div>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Upload Your Knowledge
              </h3>
              <p className="text-text-secondary">
                Import your company documents, playbooks, and knowledge base. 
                Our AI processes and organizes everything automatically.
              </p>
            </div>
            
            <div className="text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-secondary flex items-center justify-center mx-auto text-white font-bold text-xl">
                  2
                </div>
                <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 w-8 h-0.5 bg-gradient-to-r from-secondary to-transparent hidden md:block"></div>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Train Your Agents
              </h3>
              <p className="text-text-secondary">
                Configure your AI agents with specific roles, knowledge areas, 
                and response patterns tailored to your business needs.
              </p>
            </div>
            
            <div className="text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-accent flex items-center justify-center mx-auto text-white font-bold text-xl">
                  3
                </div>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Deploy & Scale
              </h3>
              <p className="text-text-secondary">
                Launch your agents across multiple channels and watch them 
                handle customer inquiries, automate workflows, and grow smarter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Trusted by Industry Leaders
            </h2>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              Join thousands of companies already using AI agents to transform their operations
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 text-center hover-lift border-0 shadow-lg">
              <div className="flex justify-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-text-secondary mb-4">
                "The AI agents have transformed our customer service. They handle 80% of inquiries 
                with human-level accuracy, allowing our team to focus on complex cases."
              </p>
              <div className="font-semibold text-foreground">Sarah Chen</div>
              <div className="text-sm text-text-secondary">CTO, TechFlow Inc.</div>
            </Card>
            
            <Card className="p-8 text-center hover-lift border-0 shadow-lg">
              <div className="flex justify-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-text-secondary mb-4">
                "Setting up our knowledge base was incredibly easy. The AI agents learned our 
                processes quickly and now automate workflows we never thought possible."
              </p>
              <div className="font-semibold text-foreground">Michael Rodriguez</div>
              <div className="text-sm text-text-secondary">Operations Director, GlobalCorp</div>
            </Card>
            
            <Card className="p-8 text-center hover-lift border-0 shadow-lg">
              <div className="flex justify-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-text-secondary mb-4">
                "The enterprise security features give us confidence to deploy AI agents 
                across our entire organization. Compliance and audit trails are excellent."
              </p>
              <div className="font-semibold text-foreground">Dr. Emily Watson</div>
              <div className="text-sm text-text-secondary">Head of IT, SecureBank</div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-hero">
        <div className="container mx-auto text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Ready to Build Your AI Future?
            </h2>
            <p className="text-xl text-text-secondary">
              Join thousands of companies already using AI agents to automate operations, 
              enhance customer service, and drive business growth.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="btn-hero group">
                  <UserPlus className="mr-2 h-5 w-5" />
                  Sign Up Free
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="group">
                  <LogIn className="mr-2 h-5 w-5" />
                  Sign In
                </Button>
              </Link>
            </div>
            <p className="text-sm text-text-secondary">
              No credit card required • Setup in minutes • Enterprise security included
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">V</span>
                </div>
                <span className="text-xl font-bold text-gradient">Variant</span>
              </div>
              <p className="text-text-secondary text-sm">
                Building the future of AI-powered business automation.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><Link to="/login" className="hover:text-primary transition-colors">AI Agents</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Knowledge Base</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Workflow Automation</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Analytics</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><Link to="/login" className="hover:text-primary transition-colors">About</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Careers</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Contact</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Blog</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><Link to="/login" className="hover:text-primary transition-colors">Documentation</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Help Center</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Community</Link></li>
                <li><Link to="/login" className="hover:text-primary transition-colors">Status</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-text-secondary">
            <p>
              &copy; 2025 Variable. All rights reserved. | {" "}
              <Link to="/privacy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              {" "} | {" "}
              <Link to="/terms" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

