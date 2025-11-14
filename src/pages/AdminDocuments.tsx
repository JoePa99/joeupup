import { PlatformAdminProtectedRoute } from "@/components/auth/PlatformAdminProtectedRoute";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/ui/admin-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { EditDocumentModal } from "@/components/documents/EditDocumentModal";
import {
  useAdminDocuments,
  useDocumentStats,
  useDownloadDocument,
  useDeleteDocument,
  formatFileSize,
  getDocumentTypeColor,
  type DocumentWithDetails
} from "@/hooks/useDocumentManagement";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Search,
  Loader2,
  AlertCircle,
  Download,
  Eye,
  Edit,
  Trash2,
  Building2,
  Upload,
  FolderOpen,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function AdminDocumentsContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithDetails | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { toast } = useToast();

  const { data: documents, isLoading, error } = useAdminDocuments({ enabled: true });
  const { data: stats } = useDocumentStats();
  const downloadMutation = useDownloadDocument();
  const deleteMutation = useDeleteDocument();

  // Group documents by company
  const documentsByCompany = documents?.reduce((acc, doc) => {
    const companyId = doc.company_id || 'no-company';
    const companyName = doc.company?.name || 'No Company';
    
    if (!acc[companyId]) {
      acc[companyId] = {
        id: companyId,
        name: companyName,
        documents: []
      };
    }
    
    acc[companyId].documents.push(doc);
    return acc;
  }, {} as Record<string, { id: string; name: string; documents: DocumentWithDetails[] }>);

  const filteredGroups = documentsByCompany ? Object.values(documentsByCompany).map(group => ({
    ...group,
    documents: group.documents.filter(doc => {
      const searchLower = searchQuery.toLowerCase();
      return (
        doc.name.toLowerCase().includes(searchLower) ||
        doc.file_name.toLowerCase().includes(searchLower) ||
        doc.doc_type.toLowerCase().includes(searchLower) ||
        (doc.description && doc.description.toLowerCase().includes(searchLower))
      );
    })
  })).filter(group => group.documents.length > 0) : [];

  const handlePreview = (doc: DocumentWithDetails) => {
    setSelectedDocument(doc);
    setPreviewOpen(true);
  };

  const handleEdit = (doc: DocumentWithDetails) => {
    setSelectedDocument(doc);
    setEditOpen(true);
  };

  const handleDownload = async (doc: DocumentWithDetails) => {
    try {
      await downloadMutation.mutateAsync(doc);
      toast({
        title: "Download started",
        description: `Downloading ${doc.file_name}`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (doc: DocumentWithDetails) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(doc.id);
      toast({
        title: "Document deleted",
        description: `${doc.name} has been deleted successfully`,
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Loading Documents</h2>
          <p className="text-muted-foreground">Fetching document data...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-white">
        <Card className="p-8 text-center border border-gray-200 shadow-none">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Error Loading Documents</h2>
          <p className="text-muted-foreground">{error instanceof Error ? error.message : 'Failed to load documents'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Document Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage all documents across companies ({documents?.length || 0} total)
          </p>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{stats?.totalDocuments || 0}</Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats?.totalDocuments || 0}</p>
          <p className="text-sm text-muted-foreground">Total Documents</p>
        </Card>
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{stats?.companiesWithDocuments || 0}</Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats?.companiesWithDocuments || 0}</p>
          <p className="text-sm text-muted-foreground">Companies</p>
        </Card>
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <FolderOpen className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{stats?.byType.length || 0}</Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats?.byType.length || 0}</p>
          <p className="text-sm text-muted-foreground">Document Types</p>
        </Card>
        <Card className="p-6 border border-gray-200 shadow-none">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <Badge variant="secondary">{formatFileSize(stats?.totalSize || 0)}</Badge>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatFileSize(stats?.totalSize || 0)}</p>
          <p className="text-sm text-muted-foreground">Total Storage</p>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="border border-gray-200 shadow-none">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents by name, type, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Documents by Company */}
      <Card className="border border-gray-200 shadow-none">
        <CardHeader>
          <CardTitle>Documents by Company</CardTitle>
          <CardDescription>
            Documents organized by company for easy management
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredGroups && filteredGroups.length > 0 ? (
            <Accordion type="multiple" className="w-full">
              {filteredGroups.map((group) => (
                <AccordionItem key={group.id} value={group.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Building2 className="h-5 w-5 text-primary" />
                      <span className="font-medium">{group.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {group.documents.length} {group.documents.length === 1 ? 'document' : 'documents'}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {group.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-surface-subtle transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium truncate">{doc.name}</p>
                                <Badge className={getDocumentTypeColor(doc.doc_type)}>
                                  {doc.doc_type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="truncate">{doc.file_name}</span>
                                <span>•</span>
                                <span>{formatFileSize(doc.file_size)}</span>
                                <span>•</span>
                                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                {doc.uploader && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      by {doc.uploader.first_name} {doc.uploader.last_name}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(doc)}
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(doc)}
                              disabled={downloadMutation.isPending}
                              title="Download"
                            >
                              {downloadMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(doc)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(doc)}
                              disabled={deleteMutation.isPending}
                              title="Delete"
                              className="text-destructive hover:text-destructive"
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Documents Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search query' : 'No documents in the system yet'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {selectedDocument && (
        <>
          <DocumentPreviewModal
            document={{
              id: selectedDocument.id,
              name: selectedDocument.name,
              file_name: selectedDocument.file_name,
              file_type: selectedDocument.file_type,
              file_size: selectedDocument.file_size,
              storage_path: selectedDocument.storage_path,
              created_at: selectedDocument.created_at,
              uploaded_by: selectedDocument.uploaded_by,
              doc_type: selectedDocument.doc_type,
              description: selectedDocument.description
            }}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
          />
          <EditDocumentModal
            document={{
              id: selectedDocument.id,
              name: selectedDocument.name,
              file_name: selectedDocument.file_name,
              doc_type: selectedDocument.doc_type,
              description: selectedDocument.description,
              tags: selectedDocument.tags
            }}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </>
      )}
    </div>
  );
}

export default function AdminDocuments() {
  return (
    <PlatformAdminProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-white">
          <AdminSidebar />
          <SidebarInset className="flex-1 bg-white">
            <header className="flex h-16 items-center gap-4 border-b border-gray-200 px-6 bg-white">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Documents</h2>
            </header>
            <AdminDocumentsContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </PlatformAdminProtectedRoute>
  );
}

