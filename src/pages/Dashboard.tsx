import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { PlatformAdminProtectedRoute } from "@/components/auth/PlatformAdminProtectedRoute";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Bot, 
  BookOpen, 
  TrendingUp, 
  Activity,
  Eye,
  Loader2,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useCompanies, useDashboardKPIs, CompanyWithDetails } from "@/hooks/useAdminData";
import { useState } from "react";
import { PlaybookManager } from "@/components/admin/PlaybookManager";
import { OnboardingTracker } from "@/components/admin/OnboardingTracker";

function DashboardContent() {
  const navigate = useNavigate();
  const { data: companies, isLoading: companiesLoading, error: companiesError } = useCompanies();
  const { data: kpiData, isLoading: kpiLoading, error: kpiError } = useDashboardKPIs();
  const [showPlaybookManager, setShowPlaybookManager] = useState(false);
  const [showOnboardingTracker, setShowOnboardingTracker] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  if (companiesLoading || kpiLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Loading Dashboard
          </h2>
          <p className="text-text-secondary">
            Fetching latest data...
          </p>
        </Card>
      </div>
    );
  }

  if (companiesError || kpiError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Error Loading Dashboard
          </h2>
          <p className="text-text-secondary">
            {companiesError?.message || kpiError?.message || 'Failed to load dashboard data'}
          </p>
        </Card>
      </div>
    );
  }

  const kpis = [
    { 
      label: "Total Clients", 
      value: kpiData?.totalClients.toString() || "0", 
      change: "+12%", 
      icon: Users 
    },
    { 
      label: "Active Agents", 
      value: kpiData?.activeAgents.toString() || "0", 
      change: "+8%", 
      icon: Bot 
    },
    { 
      label: "Onboarding Rate", 
      value: `${kpiData?.onboardingRate || 0}%`, 
      change: "+5%", 
      icon: TrendingUp 
    },
    { 
      label: "Playbook Coverage", 
      value: `${kpiData?.playbookCoverage || 0}%`, 
      change: "+2%", 
      icon: BookOpen 
    },
  ];

  const handleManagePlaybook = (company: CompanyWithDetails) => {
    setSelectedCompany(company);
    setShowPlaybookManager(true);
  };

  const handleViewOnboarding = (company: CompanyWithDetails) => {
    setSelectedCompany(company);
    setShowOnboardingTracker(true);
  };

  const getPlaybookStatus = (company: CompanyWithDetails): string => {
    if (!company.playbook_sections || company.playbook_sections.length === 0) {
      return "Not Started";
    }
    
    const completed = company.playbook_sections.filter(s => s.status === 'complete').length;
    const total = company.playbook_sections.length;
    
    if (completed === 0) return "Draft";
    if (completed === total) return "Complete";
    return "In Progress";
  };

  const getPlaybookBadgeVariant = (status: string) => {
    switch (status) {
      case "Complete": return "default";
      case "In Progress": return "secondary";
      default: return "outline";
    }
  };

  // Pagination logic
  const totalPages = Math.ceil((companies?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCompanies = companies?.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  if (showPlaybookManager && selectedCompany) {
    return (
      <PlaybookManager 
        onBack={() => setShowPlaybookManager(false)}
      />
    );
  }

  if (showOnboardingTracker && selectedCompany) {
    return (
      <OnboardingTracker
        company={selectedCompany}
        onBack={() => setShowOnboardingTracker(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-text-secondary mt-1">Monitor platform performance and manage clients</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi, index) => {
              const Icon = kpi.icon;
              return (
                <Card key={index} className="p-6 border border-gray-200 shadow-none">
                  <div className="flex items-center justify-between mb-4">
                    <Icon className="h-8 w-8 text-primary" />
                    <Badge variant="secondary">
                      {kpi.change}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground mb-1">{kpi.value}</p>
                    <p className="text-sm text-text-secondary">{kpi.label}</p>
                  </div>
                </Card>
              );
          })}
      </div>

      {/* Client Management */}
      <Card className="p-6 border border-gray-200 shadow-none">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">Client Management</h2>
                <p className="text-text-secondary">Manage client accounts and monitor progress ({companies?.length || 0} clients)</p>
              </div>
            </div>

            {companies && companies.length > 0 ? (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Company</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Plan</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Onboarding</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Playbook</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Last Login</th>
                    <th className="text-left py-3 px-4 font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                                  <tbody>
                    {paginatedCompanies?.map((company) => {
                      const playbookStatus = getPlaybookStatus(company);
                      return (
                        <tr key={company.id} className="border-b border-border hover:bg-surface-subtle transition-colors">
                          <td className="py-4 px-4">
                            <div>
                              <div className="font-medium text-foreground">{company.name}</div>
                              {company.domain && (
                                <div className="text-sm text-text-secondary">{company.domain}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant={company.plan === "enterprise" ? "default" : "secondary"}>
                              {company.plan.charAt(0).toUpperCase() + company.plan.slice(1)}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-surface-subtle rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${company.onboarding_completion || 0}%` }}
                                />
                              </div>
                              <span className="text-sm text-text-secondary">{company.onboarding_completion || 0}%</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant={getPlaybookBadgeVariant(playbookStatus)}>
                              {playbookStatus}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-text-secondary">{company.last_login}</td>
                          <td className="py-4 px-4">
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => navigate(`/client/${company.id}`)}
                                title="View Client Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-sm text-text-secondary">
                  Showing {startIndex + 1} to {Math.min(endIndex, companies?.length || 0)} of {companies?.length || 0} clients
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-9 h-9"
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
            </>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted" />
                <h3 className="text-lg font-medium text-foreground mb-2">No Clients Found</h3>
                <p className="text-text-secondary">Start by adding your first client to the platform.</p>
            </div>
          )}
      </Card>
    </div>
  );
}

export default function Dashboard() {
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
            <DashboardContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}