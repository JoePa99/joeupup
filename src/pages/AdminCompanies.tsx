import { PlatformAdminProtectedRoute } from "@/components/auth/PlatformAdminProtectedRoute";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useCompanies, useDeleteCompany, type CompanyWithDetails } from "@/hooks/useAdminData";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Users,
  FileText,
  TrendingUp,
  BookOpen,
  Search,
  Loader2,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Trash2
} from "lucide-react";

export function AdminCompaniesContent() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: companies, isLoading, error } = useCompanies();
  const deleteCompany = useDeleteCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyWithDetails | null>(null);
  const ITEMS_PER_PAGE = 5;

  const filteredCompanies = companies?.filter((company) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      company.name.toLowerCase().includes(searchLower) ||
      (company.domain && company.domain.toLowerCase().includes(searchLower))
    );
  });

  // Pagination logic
  const totalPages = Math.ceil((filteredCompanies?.length || 0) / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCompanies = filteredCompanies?.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;

    try {
      await deleteCompany.mutateAsync(companyToDelete.id);
      toast({
        title: "Company Deleted",
        description: `${companyToDelete.name} and all related data have been permanently deleted.`,
      });
      setCompanyToDelete(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete company. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'enterprise': return 'default';
      case 'professional': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Loading Companies</h2>
          <p className="text-muted-foreground">Fetching company data...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Error Loading Companies</h2>
          <p className="text-muted-foreground">{error instanceof Error ? error.message : 'Failed to load companies'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-white">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Company Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage all companies on the platform ({companies?.length || 0} total)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{companies?.length || 0}</Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">{companies?.length || 0}</p>
          <p className="text-sm text-muted-foreground">Total Companies</p>
        </Card>
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-8 w-8 text-primary" />
            <Badge variant="secondary">
              {companies?.reduce((sum, c: any) => sum + ((c.total_users as number) || 0), 0) || 0}
            </Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {companies?.reduce((sum, c: any) => sum + ((c.total_users as number) || 0), 0) || 0}
          </p>
          <p className="text-sm text-muted-foreground">Total Users</p>
        </Card>
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <Badge variant="secondary">
              {companies?.reduce((sum, c: any) => sum + ((c.total_documents as number) || 0), 0) || 0}
            </Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {companies?.reduce((sum, c: any) => sum + ((c.total_documents as number) || 0), 0) || 0}
          </p>
          <p className="text-sm text-muted-foreground">Total Documents</p>
        </Card>
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <Badge variant="secondary">
              {companies?.length ? Math.round(companies.reduce((sum, c) => sum + (c.onboarding_completion || 0), 0) / companies.length) : 0}%
            </Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {companies?.length ? Math.round(companies.reduce((sum, c) => sum + (c.onboarding_completion || 0), 0) / companies.length) : 0}%
          </p>
          <p className="text-sm text-muted-foreground">Avg. Onboarding</p>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="border border-gray-200 shadow-none">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies by name or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Companies Table */}
      <Card className="border border-gray-200 shadow-none">
        <CardHeader>
          <CardTitle>All Companies</CardTitle>
          <CardDescription>
            Complete list of companies with their key metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompanies && filteredCompanies.length > 0 ? (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Company</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Users</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Documents</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Onboarding</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Playbook</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCompanies?.map((company) => (
                    <tr
                      key={company.id}
                      className="border-b border-border hover:bg-surface-subtle transition-colors cursor-pointer"
                      onClick={() => navigate(`/client/${company.id}`)}
                    >
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-medium text-foreground">{company.name}</div>
                          {company.domain && (
                            <div className="text-sm text-muted-foreground">{company.domain}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant={getPlanBadgeVariant(company.plan)}>
                          {company.plan.charAt(0).toUpperCase() + company.plan.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{(company as any).total_users || 0}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{(company as any).total_documents || 0}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-surface-subtle rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ width: `${company.onboarding_completion || 0}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">{company.onboarding_completion || 0}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{(company as any).playbook_completion || 0}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/client/${company.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setCompanyToDelete(company)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Company
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredCompanies?.length || 0)} of {filteredCompanies?.length || 0} companies
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
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Companies Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search query' : 'No companies in the system yet'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!companyToDelete} onOpenChange={() => setCompanyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{companyToDelete?.name}</strong>? 
              This action will permanently delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The company and all its data</li>
                <li>All users and their accounts</li>
                <li>All documents and files</li>
                <li>All playbook sections</li>
                <li>All onboarding sessions</li>
                <li>All activity logs and analytics</li>
              </ul>
              <strong className="text-destructive mt-2 block">This action cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCompany}
              disabled={deleteCompany.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCompany.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Company"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminCompanies() {
  return (
    <PlatformAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <AdminSidebar />
          <SidebarInset className="flex-1 bg-white">
            <header className="flex h-16 items-center gap-4 border-b border-gray-200 px-6 bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Companies</h2>
            </header>
            <AdminCompaniesContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}

