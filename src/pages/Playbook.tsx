import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentManagementContent } from "@/components/documents/DocumentManagementContent";
import { CompanyOSGenerator } from "@/components/company-os/CompanyOSGenerator";
import { CompanyOSViewer } from "@/components/company-os/CompanyOSViewer";
import { CompanyOSEditor } from "@/components/company-os/CompanyOSEditor";
import { 
  BookOpen, 
  FileText,
  ArrowLeft,
  Cpu,
  Loader2,
  Edit3,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SubscriptionRequiredModal } from "@/components/billing/SubscriptionRequiredModal";
import { useSubscriptionRequired } from "@/hooks/useSubscriptionRequired";
import { getCompanyOS } from "@/lib/company-os";
import { supabase } from "@/integrations/supabase/client";
import type { CompanyOS } from "@/types/company-os";

export default function Playbook() {
  const { user } = useAuth();
  const [companyOS, setCompanyOS] = useState<CompanyOS | null>(null);
  const [isLoadingOS, setIsLoadingOS] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');

  // Check subscription status
  const { 
    showModal: showSubscriptionModal, 
    setShowModal: setShowSubscriptionModal,
    isAdmin, 
    companyId,
    isLoading: isLoadingSubscription 
  } = useSubscriptionRequired();

  // Load CompanyOS on mount
  useEffect(() => {
    async function loadCompanyOS() {
      if (!companyId) {
        setIsLoadingOS(false);
        return;
      }

      setIsLoadingOS(true);
      
      // Fetch company name
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();
      
      if (company) {
        setCompanyName(company.name);
      }

      // Fetch CompanyOS
      const { success, companyOS: os } = await getCompanyOS(companyId);
      
      if (success && os) {
        setCompanyOS(os);
      }
      
      setIsLoadingOS(false);
    }

    loadCompanyOS();
  }, [companyId]);

  const handleGenerated = (os: CompanyOS) => {
    setCompanyOS(os);
    setIsRegenerating(false);
  };

  const handleSaved = (os: CompanyOS) => {
    setCompanyOS(os);
    setIsEditing(false);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-1 flex-col bg-white">
        <header className="flex h-14 md:h-16 shrink-0 items-center gap-2 border-b bg-white px-4 sm:px-6">
          <SidebarTrigger className="-ml-1 h-10 w-10 md:h-7 md:w-7" />
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Company Playbook</h1>
          </div>
        </header>
        
        <div className="flex-1 p-4 sm:p-6 bg-white">
          <Tabs defaultValue="documents" className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-transparent gap-0 p-0 h-auto border-b rounded-none">
              <TabsTrigger 
                value="documents" 
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
              >
                <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Playbook Documents</span>
                <span className="sm:hidden">Docs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="company-os" 
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
              >
                <Cpu className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">CompanyOS</span>
                <span className="sm:hidden">OS</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-6">
              <DocumentManagementContent />
            </TabsContent>

            <TabsContent value="company-os" className="space-y-6">
              {isLoadingOS ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : isEditing && companyOS ? (
                <CompanyOSEditor
                  companyOS={companyOS}
                  onSaved={handleSaved}
                  onCancel={() => setIsEditing(false)}
                />
              ) : isRegenerating && companyOS ? (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4" />
                      <span>Regenerating CompanyOS will replace the current version</span>
                    </div>
                    <Button onClick={() => setIsRegenerating(false)} variant="outline" size="sm">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to View
                    </Button>
                  </div>
                  <CompanyOSGenerator
                    companyId={companyId!}
                    companyName={companyName}
                    onGenerated={handleGenerated}
                  />
                </>
              ) : companyOS ? (
                <>
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setIsRegenerating(true)} variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regenerate
                    </Button>
                    <Button onClick={() => setIsEditing(true)} variant="outline">
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                  <CompanyOSViewer companyOS={companyOS} />
                </>
              ) : companyId ? (
                <CompanyOSGenerator
                  companyId={companyId}
                  companyName={companyName}
                  onGenerated={handleGenerated}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>No Company Selected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Please select a company to manage CompanyOS.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Subscription Required Modal */}
      {showSubscriptionModal && companyId && (
        <SubscriptionRequiredModal
          isOpen={showSubscriptionModal}
          onClose={isAdmin ? () => setShowSubscriptionModal(false) : undefined}
          companyId={companyId}
          isAdmin={isAdmin}
        />
      )}
    </SidebarProvider>
  );
}