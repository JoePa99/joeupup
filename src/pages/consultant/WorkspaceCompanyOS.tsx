import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Globe, Edit, FileText, Save, Loader2 } from "lucide-react";
import { CompanyOSViewer } from "@/components/company-os/CompanyOSViewer";
import { CompanyOSEditor } from "@/components/company-os/CompanyOSEditor";

export default function WorkspaceCompanyOS() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [companyOSData, setCompanyOSData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("upload");

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");

  // Web research state
  const [researchCompanyName, setResearchCompanyName] = useState("");
  const [researchWebsite, setResearchWebsite] = useState("");
  const [researching, setResearching] = useState(false);

  // Manual entry state
  const [manualData, setManualData] = useState<any>({});

  useEffect(() => {
    if (workspaceId) {
      fetchCompanyData();
      fetchCompanyOS();
    }
  }, [workspaceId]);

  const fetchCompanyData = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      setCompanyData(data);
      setResearchCompanyName(data.name || "");
    } catch (error: any) {
      console.error('Error fetching company:', error);
      toast({
        title: "Error loading company",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyOS = async () => {
    try {
      const { data, error } = await supabase
        .from('company_knowledge')
        .select('*')
        .eq('company_id', workspaceId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        throw error;
      }

      if (data) {
        setCompanyOSData(data);
      }
    } catch (error: any) {
      console.error('Error fetching CompanyOS:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setExtracting(true);

    try {
      // Read file as text or use PDF extraction
      const text = await readFileAsText(file);
      setExtractedText(text);

      // Use GPT-4 to structure the data
      await generateCompanyOSFromText(text);
    } catch (error: any) {
      toast({
        title: "Error processing file",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const readFileAsText = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const generateCompanyOSFromText = async (text: string) => {
    try {
      // Call OpenAI to structure the extracted text into CompanyOS format
      const { data, error } = await supabase.functions.invoke('generate-company-os-from-text', {
        body: { text, company_name: companyData?.name }
      });

      if (error) throw error;

      // Preview the generated data
      setManualData(data.company_os);
      setActiveTab('manual'); // Switch to manual tab to review

      toast({
        title: "CompanyOS generated!",
        description: "Review and edit the generated data before saving.",
      });
    } catch (error: any) {
      toast({
        title: "Error generating CompanyOS",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleWebResearch = async () => {
    if (!researchCompanyName) {
      toast({
        title: "Missing company name",
        description: "Please provide a company name",
        variant: "destructive",
      });
      return;
    }

    setResearching(true);

    try {
      // Use Perplexity AI or GPT-4 to research the company
      const { data, error } = await supabase.functions.invoke('research-company', {
        body: {
          company_name: researchCompanyName,
          website: researchWebsite,
          industry: companyData?.industry
        }
      });

      if (error) throw error;

      // Preview the generated data
      setManualData(data.company_os);
      setActiveTab('manual'); // Switch to manual tab to review

      toast({
        title: "Research complete!",
        description: "Review and edit the generated data before saving.",
      });
    } catch (error: any) {
      toast({
        title: "Error researching company",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResearching(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Upsert CompanyOS data
      const { error } = await supabase
        .from('company_knowledge')
        .upsert({
          company_id: workspaceId,
          data: manualData,
          confidence_score: 0.85,
          extraction_method: activeTab === 'upload' ? 'pdf_extraction' :
                           activeTab === 'research' ? 'web_research' : 'manual_entry',
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "CompanyOS saved successfully!",
        description: "The workspace is now ready for agent configuration.",
      });

      // Refresh the data
      fetchCompanyOS();

      // Navigate to agents page
      navigate(`/consultant-portal/workspaces/${workspaceId}/agents`);
    } catch (error: any) {
      toast({
        title: "Error saving CompanyOS",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/consultant-portal')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            CompanyOS Setup: {companyData?.name}
          </h1>
          <p className="text-muted-foreground">
            Create the company operating system to power context-aware AI agents
          </p>
        </div>

        {/* Existing CompanyOS Preview */}
        {companyOSData && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Current CompanyOS</CardTitle>
              <CardDescription>
                Last updated {new Date(companyOSData.updated_at).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyOSViewer data={companyOSData.data} />
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setManualData(companyOSData.data);
                    setActiveTab('manual');
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Existing
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create/Update CompanyOS */}
        <Card>
          <CardHeader>
            <CardTitle>
              {companyOSData ? 'Update CompanyOS' : 'Create CompanyOS'}
            </CardTitle>
            <CardDescription>
              Choose a method to generate or enter company information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </TabsTrigger>
                <TabsTrigger value="research">
                  <Globe className="w-4 h-4 mr-2" />
                  Web Research
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <Edit className="w-4 h-4 mr-2" />
                  Manual Entry
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4 mt-6">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      Upload Company Document
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Upload a PDF, DOCX, or TXT file with company information
                    </p>
                    <Input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={handleFileUpload}
                      disabled={extracting}
                      className="max-w-xs"
                    />
                    {extracting && (
                      <div className="mt-4 flex items-center text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Extracting and generating CompanyOS...
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="research" className="space-y-4 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="research_company_name">
                      Company Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="research_company_name"
                      value={researchCompanyName}
                      onChange={(e) => setResearchCompanyName(e.target.value)}
                      placeholder="Acme Corporation"
                    />
                  </div>
                  <div>
                    <Label htmlFor="research_website">Website URL (optional)</Label>
                    <Input
                      id="research_website"
                      value={researchWebsite}
                      onChange={(e) => setResearchWebsite(e.target.value)}
                      placeholder="https://acme.com"
                    />
                  </div>
                  <div>
                    <Label>Industry</Label>
                    <Input
                      value={companyData?.industry || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <Button
                    onClick={handleWebResearch}
                    disabled={researching || !researchCompanyName}
                    className="w-full"
                  >
                    {researching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Researching...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4 mr-2" />
                        Research Company & Generate CompanyOS
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-6">
                <CompanyOSEditor
                  data={manualData}
                  onChange={setManualData}
                />
              </TabsContent>
            </Tabs>

            {/* Save Button */}
            {(activeTab === 'manual' && Object.keys(manualData).length > 0) && (
              <div className="mt-6 flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => setManualData({})}
                  disabled={saving}
                >
                  Reset
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save CompanyOS
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
