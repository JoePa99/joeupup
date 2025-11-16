import { useEffect, useMemo, useState } from "react";
import { PlatformAdminProtectedRoute } from "@/components/auth/PlatformAdminProtectedRoute";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CompanyOSGenerator } from "@/components/company-os/CompanyOSGenerator";
import { AgentManager } from "@/components/admin/AgentManager";
import { useCompanies } from "@/hooks/useAdminData";
import { useToast } from "@/hooks/use-toast";
import type { CompanyOS } from "@/types/company-os";

function AdminDashboardContent() {
  const { data: companies = [], isLoading, error } = useCompanies();
  const { toast } = useToast();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>();

  useEffect(() => {
    if (!selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  const selectedCompany = useMemo(
    () => companies.find(company => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  );

  const handleCompanyOSGenerated = (_companyOS: CompanyOS) => {
    const name = selectedCompany?.name || selectedCompany?.domain || "the selected company";
    toast({
      title: "CompanyOS updated",
      description: `New knowledge has been ingested for ${name}.`
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Admin Workspace</h1>
          <p className="text-muted-foreground">
            Upload CompanyOS documents and manage assistants for each client in a single place.
          </p>
        </div>
        <div className="w-full max-w-sm space-y-2">
          <Label htmlFor="company-selector">Select company</Label>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={selectedCompanyId}
              onValueChange={setSelectedCompanyId}
              disabled={companies.length === 0}
            >
              <SelectTrigger id="company-selector" className="bg-white">
                <SelectValue placeholder="Choose a company" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name || company.domain || "Untitled company"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load companies</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-gray-200 shadow-none">
          <CardHeader>
            <CardTitle>CompanyOS Uploads</CardTitle>
            <CardDescription>Route documents through the centralized archive + embeddings pipeline.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedCompany ? (
              <CompanyOSGenerator
                companyId={selectedCompany.id}
                companyName={selectedCompany.name || undefined}
                hideWebResearch
                onGenerated={handleCompanyOSGenerated}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a company to begin uploading documents to its CompanyOS.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-none">
          <CardHeader>
            <CardTitle>Assistant Manager</CardTitle>
            <CardDescription>Configure assistants, metadata, tools, and knowledge sources.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {selectedCompany ? (
              <div className="p-6">
                <AgentManager
                  companyId={selectedCompany.id}
                  companyName={selectedCompany.name || selectedCompany.domain || "Selected company"}
                />
              </div>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                Select a company to manage its assistants.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <PlatformAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <AdminSidebar />
          <SidebarInset className="flex-1 bg-white">
            <header className="flex h-16 items-center gap-4 border-b border-gray-200 px-6 bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Dashboard</h2>
            </header>
            <AdminDashboardContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}
