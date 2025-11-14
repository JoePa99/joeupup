import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ConsultationForm } from "@/components/onboarding/ConsultationForm";
import { SelfServiceForm } from "@/components/onboarding/SelfServiceForm";
import { PricingStep } from "@/components/onboarding/PricingStep";
import { 
  Building, 
  Globe, 
  Upload, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Check,
  Scan,
  FileText,
  Users,
  Zap,
  Calendar,
  Target,
  LogOut
} from "lucide-react";

const steps = [
  {
    id: 1,
    title: "Company Information",
    description: "Basic details about your company"
  },
  {
    id: 2,
    title: "Choose Onboarding Path",
    description: "Select how you'd like to proceed"
  },
  {
    id: 3,
    title: "Select Your Plan",
    description: "Choose a subscription plan"
  },
  {
    id: 4,
    title: "Business Analysis",
    description: "Provide detailed information"
  },
  {
    id: 5,
    title: "Deploy Agents",
    description: "Finalize and deploy your AI agents"
  }
];

export default function Onboarding() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [onboardingPath, setOnboardingPath] = useState<"consulting" | "self_service" | "">("");
  const [companyData, setCompanyData] = useState({
    name: "",
    website: "",
    industry: "",
    description: ""
  });
  const [companyId, setCompanyId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionVerified, setSubscriptionVerified] = useState(false);

  // Check for successful payment return from Stripe
  useEffect(() => {
    const checkPaymentSuccess = async () => {
      const success = searchParams.get('success');
      const canceled = searchParams.get('canceled');

      if (success === 'true' && user && companyId) {
        // Verify the subscription is actually active
        const { data: company, error } = await supabase
          .from('companies')
          .select('subscription_status, plan_id')
          .eq('id', companyId)
          .single();

        if (!error && company) {
          if (company.subscription_status === 'active' || company.subscription_status === 'trialing') {
            toast.success('Payment successful! Your subscription is now active.');
            setSubscriptionVerified(true);
            // Auto-advance to next step
            if (currentStep === 3) {
              setCurrentStep(4);
            }
            // Clear URL parameters
            setSearchParams({});
          } else {
            toast.error('Payment verification pending. Please wait a moment...');
            // Retry after a delay
            setTimeout(checkPaymentSuccess, 3000);
          }
        }
      } else if (canceled === 'true') {
        toast.error('Payment was canceled. Please try again when ready.');
        // Clear URL parameters
        setSearchParams({});
      }
    };

    if (companyId) {
      checkPaymentSuccess();
    }
  }, [searchParams, user, companyId, currentStep]);

  // Initialize onboarding session on mount
  useEffect(() => {
    if (user) {
      initializeOnboardingSession();
    }
  }, [user]);

  const initializeOnboardingSession = async () => {
    try {
      // Get user's company ID from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user?.id)
        .maybeSingle();

      let userCompanyId = profile?.company_id;

      // If user has no company, create one
      if (!userCompanyId) {
        console.log("User has no company, creating one...");
        
        // Create company and link profile atomically using RPC function
        const { data: newCompanyResult, error: companyError } = await (supabase as any)
          .rpc('create_company_and_link_profile', { 
            p_company_name: "My Company",
            p_user_id: user?.id
          });

        if (companyError) {
          console.error("Error creating company:", companyError);
          toast.error("Failed to initialize company setup");
          return;
        }

        // Company and profile are now linked
        if (newCompanyResult && (newCompanyResult as any[]).length > 0) {
          const company = (newCompanyResult as any[])[0];
          userCompanyId = company.company_id;
          
          // Agents are now created during signup using database only
          // No OpenAI integration required for basic agent functionality
          
          toast.success("Company setup initialized");
        }
      }

      if (userCompanyId) {
        setCompanyId(userCompanyId);
      }

      // Check if session already exists
      const { data: existingSession } = await supabase
        .from("onboarding_sessions")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!existingSession) {
        // Create new session
        const { error } = await supabase
          .from("onboarding_sessions")
          .insert({
            user_id: user?.id,
            company_id: userCompanyId,
            current_step: 1,
            status: "in_progress",
          });

        if (error) {
          console.error("Error creating onboarding session:", error);
        }
      } else {
        // Load existing session data into state
        if (existingSession.current_step) {
          setCurrentStep(existingSession.current_step);
        }
        
        if (existingSession.company_id) {
          setCompanyId(existingSession.company_id);
        }
        
        // Parse session data if it exists
        if (existingSession.session_data) {
          const sessionData = existingSession.session_data as any;
          
          // Restore company data
          if (sessionData.name || sessionData.website || sessionData.industry || sessionData.description) {
            setCompanyData({
              name: sessionData.name || "",
              website: sessionData.website || "",
              industry: sessionData.industry || "",
              description: sessionData.description || ""
            });
          }
          
          // Restore onboarding path
          if (sessionData.onboardingPath) {
            setOnboardingPath(sessionData.onboardingPath);
          }
        }
      }
    } catch (error) {
      console.error("Error initializing onboarding:", error);
    }
  };

  const canProceedToStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 2:
        return companyData.name.trim() !== "" && companyData.website.trim() !== "";
      case 3:
        return onboardingPath !== "";
      case 4:
        // Check if subscription is active before proceeding past pricing step
        if (companyId) {
          const { data: company, error } = await supabase
            .from('companies')
            .select('subscription_status')
            .eq('id', companyId)
            .single();

          if (!error && company) {
            const isActive = company.subscription_status === 'active' || company.subscription_status === 'trialing';
            if (!isActive) {
              toast.error('Please complete your subscription before proceeding.');
              return false;
            }
            return true;
          }
        }
        return false;
      case 5:
        return true; // Will be handled by individual form components
      default:
        return true;
    }
  };

  const nextStep = async () => {
    if (currentStep < steps.length) {
      const canProceed = await canProceedToStep(currentStep + 1);
      if (canProceed) {
        const newStep = currentStep + 1;
        setCurrentStep(newStep);
        
        // Update session in database
        await updateOnboardingSession(newStep);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateOnboardingSession = async (step: number, additionalData?: any) => {
    try {
      const updateData = {
        current_step: step,
        session_data: {
          ...companyData,
          onboardingPath,
          ...additionalData
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("onboarding_sessions")
        .update(updateData)
        .eq("user_id", user?.id);

      if (error) {
        console.error("Error updating onboarding session:", error);
      }
    } catch (error) {
      console.error("Error updating session:", error);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Mark onboarding as completed
      const { error: sessionError } = await supabase
        .from("onboarding_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          progress_percentage: 100,
        })
        .eq("user_id", user?.id);

      if (sessionError) throw sessionError;

      // Update company information
      if (companyData.name && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        if (profile?.company_id) {
          const { error: companyError } = await supabase
            .from("companies")
            .update({
              name: companyData.name,
              domain: companyData.website,
            })
            .eq("id", profile.company_id);

          if (companyError) {
            console.error("Error updating company:", companyError);
          }
        }
      }

      toast.success("Onboarding completed successfully!");
      navigate("/client-dashboard");
    } catch (error: any) {
      toast.error("Failed to complete onboarding: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const progress = (currentStep / steps.length) * 100;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">V</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Welcome to Variable</h1>
                <p className="text-muted-foreground">Let's set up your AI agents</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Step {currentStep} of {steps.length}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Steps Sidebar */}
            <div className="lg:col-span-1">
              <nav className="space-y-2">
                {steps.map(step => (
                  <div 
                    key={step.id} 
                    className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
                      step.id === currentStep 
                        ? "bg-primary text-primary-foreground" 
                        : step.id < currentStep 
                          ? "bg-white text-foreground" 
                          : "text-text-secondary"
                    }`}
                  >
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.id < currentStep 
                        ? "bg-success text-white" 
                        : step.id === currentStep 
                          ? "bg-primary-foreground text-primary" 
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {step.id < currentStep ? <Check className="h-3 w-3" /> : step.id}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{step.title}</p>
                      <p className="text-xs opacity-75">{step.description}</p>
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              <div className="space-y-6">
                {/* Step 1: Company Information */}
                {currentStep === 1 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Company Information
                      </CardTitle>
                      <CardDescription>
                        Tell us about your business to personalize your AI agents
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="company-name">Company Name *</Label>
                          <Input
                            id="company-name"
                            placeholder="Your Company Name"
                            value={companyData.name}
                            onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="website">Website URL *</Label>
                          <Input
                            id="website"
                            type="url"
                            placeholder="https://yourcompany.com"
                            value={companyData.website}
                            onChange={(e) => setCompanyData(prev => ({ ...prev, website: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="industry">Industry</Label>
                        <Input
                          id="industry"
                          placeholder="e.g., Technology, Healthcare, Finance"
                          value={companyData.industry}
                          onChange={(e) => setCompanyData(prev => ({ ...prev, industry: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Company Description</Label>
                        <Input
                          id="description"
                          placeholder="Brief description of what your company does"
                          value={companyData.description}
                          onChange={(e) => setCompanyData(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Step 2: Choose Onboarding Path */}
                {currentStep === 2 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Choose Your Onboarding Path
                      </CardTitle>
                      <CardDescription>
                        Select the approach that best fits your needs and timeline
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup value={onboardingPath} onValueChange={(value) => setOnboardingPath(value as "consulting" | "self_service" | "")}>
                        <div className="space-y-6">
                          <div 
                            className="flex items-start space-x-4 p-6 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                            onClick={() => setOnboardingPath("consulting")}
                          >
                            <RadioGroupItem value="consulting" id="consulting" className="mt-1" />
                            <div className="flex-1 space-y-3">
                              <Label htmlFor="consulting" className="font-medium flex items-center gap-2 cursor-pointer text-lg">
                                <Users className="h-5 w-5 text-primary" />
                                Consulting Service Onboarding
                              </Label>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                <strong>Premium service:</strong> Our expert team conducts extensive research on your business, 
                                creating a comprehensive 70+ page knowledge base covering your mission, vision, value proposition, 
                                customer segments, SWOT analysis, and more. Perfect for businesses wanting a thorough, 
                                professionally-validated foundation.
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  2-3 weeks
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  Dedicated team
                                </span>
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  70+ page report
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div 
                            className="flex items-start space-x-4 p-6 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                            onClick={() => setOnboardingPath("self_service")}
                          >
                            <RadioGroupItem value="self_service" id="self_service" className="mt-1" />
                            <div className="flex-1 space-y-3">
                              <Label htmlFor="self_service" className="font-medium flex items-center gap-2 cursor-pointer text-lg">
                                <Zap className="h-5 w-5 text-primary" />
                                Self-Service Onboarding
                              </Label>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                <strong>Quick start:</strong> Enter your company URL for automated analysis, upload your own documents, 
                                and review the generated knowledge base. You maintain full control over the content and can enhance 
                                it with additional research tools. Ideal for businesses ready to get started immediately.
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  Same day
                                </span>
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  Website analysis
                                </span>
                                <span className="flex items-center gap-1">
                                  <Upload className="h-3 w-3" />
                                  Document upload
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </RadioGroup>
                    </CardContent>
                  </Card>
                )}

                {/* Step 3: Pricing Selection */}
                {currentStep === 3 && (
                  <PricingStep 
                    onComplete={() => setCurrentStep(4)}
                    companyId={companyId}
                  />
                )}

                {/* Step 4: Business Analysis Forms */}
                {currentStep === 4 && onboardingPath === "consulting" && (
                  <ConsultationForm 
                    onComplete={() => setCurrentStep(5)}
                    companyId={companyId}
                  />
                )}

                {currentStep === 4 && onboardingPath === "self_service" && (
                  <SelfServiceForm 
                    onComplete={() => setCurrentStep(5)}
                    companyId={companyId}
                  />
                )}

                {/* Step 5: Deploy Agents */}
                {currentStep === 5 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-success" />
                        {onboardingPath === "consulting" ? "Consultation Requested" : "Deployment Ready"}
                      </CardTitle>
                      <CardDescription>
                        {onboardingPath === "consulting" 
                          ? "Your consultation request has been submitted successfully"
                          : "Your AI agents are configured and ready to be deployed"
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {onboardingPath === "consulting" ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                <span className="font-medium text-primary">Consultation Scheduled</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Thank you for choosing our consulting service. Our expert team will reach out within 24-48 hours to schedule your consultation and begin the comprehensive research process.
                              </p>
                            </div>
                            
                            <div className="p-4 border rounded-lg">
                              <h4 className="font-medium mb-2">What Happens Next?</h4>
                              <ul className="text-sm text-muted-foreground space-y-2">
                                <li className="flex items-start gap-2">
                                  <CheckCircle className="h-3 w-3 mt-1 text-success" />
                                  Our team will contact you to schedule a detailed consultation
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle className="h-3 w-3 mt-1 text-success" />
                                  We'll conduct comprehensive research on your business
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle className="h-3 w-3 mt-1 text-success" />
                                  You'll receive a detailed 70+ page knowledge base document
                                </li>
                                <li className="flex items-start gap-2">
                                  <CheckCircle className="h-3 w-3 mt-1 text-success" />
                                  Your AI agents will be deployed with the validated knowledge base
                                </li>
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-success" />
                                <span className="font-medium text-success">Knowledge Base Complete</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Your knowledge base has been processed and your AI agents are ready for deployment.
                              </p>
                            </div>
                            
                            <div className="grid gap-4">
                              <div className="p-4 border rounded-lg">
                                <h4 className="font-medium mb-2">Knowledge Base</h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                  Website analysis and document processing completed with comprehensive business understanding.
                                </p>
                                <div className="flex items-center gap-2 text-sm text-success">
                                  <CheckCircle className="h-3 w-3" />
                                  Ready for deployment
                                </div>
                              </div>
                              
                              <div className="p-4 border rounded-lg">
                                <h4 className="font-medium mb-2">AI Agents</h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                  Your agents have been configured with your business knowledge and are ready to assist customers.
                                </p>
                                <div className="flex items-center gap-2 text-sm text-success">
                                  <CheckCircle className="h-3 w-3" />
                                  Configuration complete
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <Button 
                          onClick={handleComplete} 
                          size="lg" 
                          className="w-full"
                          disabled={isLoading}
                        >
                          {isLoading ? "Completing..." : "Complete Onboarding & Go to Dashboard"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Navigation */}
                {currentStep < 3 && (
                  <div className="flex justify-between pt-6">
                    <Button
                      variant="outline"
                      onClick={prevStep}
                      disabled={currentStep === 1}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      onClick={nextStep}
                      disabled={!canProceedToStep(currentStep + 1)}
                      className="flex items-center gap-2"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}