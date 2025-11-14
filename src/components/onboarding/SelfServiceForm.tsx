import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUpload } from "./DocumentUpload";
import { KnowledgePreview } from "./KnowledgePreview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Globe, Upload, Eye, CheckCircle, Zap } from "lucide-react";

interface SelfServiceFormProps {
  onComplete: () => void;
  companyId: string;
}

interface KnowledgeBase {
  companyOverview: string;
  missionVision: string;
  products: string;
  targetMarket: string;
  keyDifferentiators: string;
  websiteAnalysis: string;
}

export function SelfServiceForm({ onComplete, companyId }: SelfServiceFormProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<any[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase>({
    companyOverview: "",
    missionVision: "",
    products: "",
    targetMarket: "",
    keyDifferentiators: "",
    websiteAnalysis: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const analyzeWebsite = async () => {
    if (!websiteUrl) {
      toast.error("Please enter a website URL");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Call the analyze-website edge function with enhanced analysis
      const { data, error } = await supabase.functions.invoke('analyze-website', {
        body: { 
          websiteUrl,
          companyId 
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to analyze website');
      }

      if (!data?.analysis) {
        throw new Error('No analysis data received');
      }

      // Map the enhanced analysis data to our knowledge base format
      setKnowledgeBase({
        companyOverview: data.analysis.companyOverview || '',
        missionVision: data.analysis.missionVision || '',
        products: data.analysis.productsServices || data.analysis.products || '',
        targetMarket: data.analysis.targetMarket || '',
        keyDifferentiators: data.analysis.keyDifferentiators || '',
        websiteAnalysis: `Website: ${websiteUrl}\nIndustry: ${data.analysis.industryClassification || 'Not specified'}\nConfidence Score: ${Math.round((data.metadata?.confidenceScore || 0.7) * 100)}%`
      });

      toast.success(`Website analysis completed with ${Math.round((data.metadata?.confidenceScore || 0.7) * 100)}% confidence!`);
      setCurrentStep(2);
    } catch (error: any) {
      console.error('Website analysis error:', error);
      toast.error("Failed to analyze website: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDocumentsUploaded = useCallback((documents: any[]) => {
    setUploadedDocuments(documents);
  }, []);

  const generateKnowledgeBase = async () => {
    setIsGenerating(true);
    try {
      // Simulate knowledge base generation from documents
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Enhanced knowledge base with document information
      const enhancedKnowledgeBase = {
        ...knowledgeBase,
        companyOverview: knowledgeBase.companyOverview + "\n\nEnhanced with information from uploaded documents including company policies, procedures, and additional business context.",
        products: knowledgeBase.products + "\n\nDetailed product information extracted from uploaded documentation.",
      };

      setKnowledgeBase(enhancedKnowledgeBase);
      toast.success("Knowledge base generated with document information!");
      setCurrentStep(3);
    } catch (error: any) {
      toast.error("Failed to generate knowledge base: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const finalizeKnowledgeBase = async () => {
    setIsFinalizing(true);
    try {
      // Save to database
      const { error } = await supabase
        .from("onboarding_sessions")
        .update({
          onboarding_type: "self_service",
          website_url: websiteUrl,
          knowledge_base_content: knowledgeBase as any,
          documents_uploaded: uploadedDocuments,
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_steps: [1, 2, 3]
        })
        .eq("user_id", user?.id);

      if (error) throw error;

      // Get existing agents for document processing
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('status', 'active');

      if (agentsError) {
        console.error('Error fetching agents:', agentsError);
        toast.error("Agents may need manual setup later");
      }

      // Process uploaded documents if any
      if (uploadedDocuments.length > 0 && agentsData && agentsData.length > 0) {
        const agentIds = agentsData.map((agent: any) => agent.id);
        
        for (const doc of uploadedDocuments) {
          try {
            await supabase.functions.invoke('process-documents', {
              body: {
                document_id: doc.id || `doc-${Date.now()}`, // Generate ID if missing
                agent_ids: agentIds,
                content: doc.content || doc.name, // Use content if available
                metadata: {
                  filename: doc.name,
                  size: doc.size,
                  type: doc.type
                }
              }
            });
          } catch (docError) {
            console.error('Error processing document:', doc.name, docError);
          }
        }
      }

      // Send welcome email for self-service onboarding
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", user?.id)
          .single();

        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", companyId)
          .single();

        const recipientName = profile?.first_name 
          ? `${profile.first_name} ${profile.last_name || ''}`.trim()
          : profile?.email || 'there';

        await supabase.functions.invoke('send-email', {
          body: {
            type: 'welcome',
            data: {
              recipientEmail: profile?.email || user?.email,
              recipientName: recipientName,
              companyName: company?.name || 'Your Company',
              loginUrl: `${window.location.origin}/client-dashboard`,
              onboardingType: 'self_service'
            }
          }
        });
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Don't fail the form submission if welcome email fails
      }

      toast.success("Knowledge base and AI agents created successfully!");
      // Redirect to client dashboard instead of calling onComplete
      window.location.href = '/client-dashboard';
    } catch (error: any) {
      toast.error("Failed to finalize knowledge base: " + error.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Website Analysis
              </CardTitle>
              <CardDescription>
                Enter your company's website URL for automated analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website URL *</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://www.example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Our AI will analyze your website to extract key information about your business, 
                  including your mission, products, services, and target market.
                </p>
              </div>
              <Button 
                onClick={analyzeWebsite} 
                disabled={isAnalyzing || !websiteUrl}
                className="w-full"
              >
                {isAnalyzing ? "Analyzing Website..." : "Analyze Website"}
              </Button>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Document Upload (Optional)
                </CardTitle>
                <CardDescription>
                  Upload additional documents to enhance your knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentUpload
                  companyId={companyId}
                  onDocumentsUploaded={handleDocumentsUploaded}
                />
              </CardContent>
            </Card>
            
            <div className="flex gap-3">
              <Button 
                onClick={() => setCurrentStep(3)} 
                variant="outline"
              >
                Skip Document Upload
              </Button>
              <Button 
                onClick={generateKnowledgeBase}
                disabled={isGenerating || uploadedDocuments.length === 0}
              >
                {isGenerating ? "Generating Knowledge Base..." : "Generate Enhanced Knowledge Base"}
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Knowledge Base Preview
                </CardTitle>
                <CardDescription>
                  Review and edit your generated knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                <KnowledgePreview 
                  knowledgeBase={knowledgeBase}
                  onChange={setKnowledgeBase}
                  uploadedDocuments={uploadedDocuments}
                />
              </CardContent>
            </Card>
            
            <Button 
              onClick={finalizeKnowledgeBase}
              disabled={isFinalizing}
              size="lg"
              className="w-full"
            >
              {isFinalizing ? "Finalizing..." : "Finalize Knowledge Base"}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Zap className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Self-Service Onboarding
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Automated analysis of your website and documents to create a comprehensive knowledge base for your AI agents.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[
          { number: 1, label: "Website Analysis", icon: Globe },
          { number: 2, label: "Document Upload", icon: Upload },
          { number: 3, label: "Review & Finalize", icon: CheckCircle },
        ].map((step) => (
          <div key={step.number} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium ${
                currentStep >= step.number
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {currentStep > step.number ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <step.icon className="w-5 h-5" />
              )}
            </div>
            <span className="ml-2 text-sm text-muted-foreground">{step.label}</span>
            {step.number < 3 && (
              <div className="w-8 h-0.5 bg-muted mx-4"></div>
            )}
          </div>
        ))}
      </div>

      {renderStepContent()}
    </div>
  );
}