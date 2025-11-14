import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DocumentUploadArea } from '@/components/documents/DocumentUploadArea';
import { EditDocumentModal } from '@/components/documents/EditDocumentModal';
import { DocumentPreviewModal } from '@/components/documents/DocumentPreviewModal';
import { GoogleDriveFolderSelector } from '@/components/documents/GoogleDriveFolderSelector';
import { GoogleDriveFilesTab } from '@/components/documents/GoogleDriveFilesTab';
import { FileText, Search, Grid3X3, List, Download, Trash2, MoreHorizontal, HardDrive, Edit, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminDocuments } from '@/hooks/useDocumentManagement';
import { useIsPlatformAdmin } from '@/hooks/useAdminData';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type DocumentType = Database['public']['Enums']['document_type'];

interface Document {
  id: string;
  name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  uploaded_by: string;
  doc_type: DocumentType;
  description: string | null;
  is_editable?: boolean;
  playbook_section_id?: string;
  company?: {
    id: string;
    name: string;
    domain?: string;
  };
  uploader?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface DocumentManagementContentProps {
  companyId?: string;
}

export function DocumentManagementContent({ companyId: propCompanyId }: DocumentManagementContentProps) {
  const { user } = useAuth();
  const { data: isPlatformAdmin, isLoading: isLoadingRole } = useIsPlatformAdmin();
  const [companyId, setCompanyId] = useState<string | null>(propCompanyId ?? null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [folderSelectorOpen, setFolderSelectorOpen] = useState(false);
  const { toast } = useToast();

  // Fetch user's company ID only if not provided via props
  useEffect(() => {
    if (propCompanyId) return; // Skip if company ID provided as prop
    
    const fetchCompanyId = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching company ID:', error);
          toast({
            title: "Error",
            description: "Could not fetch company information",
            variant: "destructive",
          });
        } else {
          setCompanyId(profile?.company_id || null);
        }
      } catch (error) {
        console.error('Error fetching company ID:', error);
      }
    };

    fetchCompanyId();
  }, [user?.id, toast, propCompanyId]);

  // Only enable the admin query when the user is a platform admin
  const { data: adminDocuments, isLoading: loadingAdminDocs } = useAdminDocuments({
    enabled: !!isPlatformAdmin,
  });

  // Fetch documents when companyId is available (for company-specific view)
  useEffect(() => {
    // Admins: show global docs
    if (isPlatformAdmin) {
      setDocuments(adminDocuments || []);
      setLoading(!!loadingAdminDocs);
      return;
    }
    // Non-admins: wait for companyId before fetching
    if (companyId) {
      fetchDocuments();
    } else {
      setLoading(true); // keep skeleton until companyId resolves
    }
  }, [isPlatformAdmin, adminDocuments, loadingAdminDocs, companyId]);

  const fetchDocuments = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('document_archives')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    fetchDocuments();
  };

  const handleEditDocument = (document: Document) => {
    // Only allow editing if document is editable and is text/markdown
    if (!document.is_editable) {
      toast({
        title: "Cannot edit",
        description: "Only platform-created documents can be edited",
        variant: "destructive",
      });
      return;
    }
    
    if (!document.file_type?.includes('text') && !document.file_type?.includes('markdown')) {
      toast({
        title: "Cannot edit",
        description: "Only text and markdown files can be edited",
        variant: "destructive",
      });
      return;
    }

    setSelectedDocument(document);
    setEditModalOpen(true);
    setOpenPopover(null);
  };

  const handlePreviewDocument = (document: Document) => {
    setSelectedDocument(document);
    setPreviewModalOpen(true);
    setOpenPopover(null);
  };

  const handleDeleteDocument = async (document: Document) => {
    try {
      const { error } = await supabase
        .from('document_archives')
        .delete()
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: "Document deleted",
        description: "The document has been successfully deleted.",
      });

      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleDownloadDocument = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      // For markdown documents, download as .txt
      const fileName = document.file_type === 'text/markdown' 
        ? document.file_name.replace(/\.md$/i, '.txt')
        : document.file_name;
      a.download = fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalStorage = () => {
    return documents.reduce((total, doc) => total + doc.file_size, 0);
  };

  const getDocumentTypes = () => {
    const types = new Set(documents.map(doc => doc.doc_type));
    return Array.from(types);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || doc.doc_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const renderDocumentCard = (document: Document) => (
    <Card key={document.id} className="group shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200 transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle 
                className="text-xs sm:text-sm font-medium truncate"
                title={document.name}
              >
                {document.name}
              </CardTitle>
              <p 
                className="text-xs text-muted-foreground mt-1 truncate"
                title={document.file_name}
              >
                {document.file_name}
              </p>
              {!companyId && document.company && (
                <p className="text-xs text-blue-600 mt-1 truncate" title={document.company.name}>
                  {document.company.name}
                </p>
              )}
            </div>
          </div>
          <Popover open={openPopover === document.id} onOpenChange={(open) => setOpenPopover(open ? document.id : null)}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48" align="end">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePreviewDocument(document)}
                  className="justify-start"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditDocument(document)}
                  className="justify-start"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownloadDocument(document)}
                  className="justify-start"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <AlertDialog open={deleteConfirmOpen && documentToDelete?.id === document.id} onOpenChange={(open) => {
                  if (!open) {
                    setDeleteConfirmOpen(false);
                    setDocumentToDelete(null);
                  }
                }}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDocumentToDelete(document);
                        setDeleteConfirmOpen(true);
                      }}
                      className="justify-start text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Document</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{document.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteDocument(document)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Badge variant="secondary">{document.doc_type}</Badge>
          <span>{formatFileSize(document.file_size)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {formatDate(document.created_at)}
        </p>
      </CardContent>
    </Card>
  );

  const renderDocumentListItem = (document: Document) => (
    <div key={document.id} className="flex items-center justify-between p-4 border rounded-lg group hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <div className="p-2 bg-primary/10 rounded-lg">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 max-w-full">
          <h3 
            className="text-sm sm:font-medium truncate whitespace-nowrap"
            title={document.name}
          >
            {document.name}
          </h3>
          <p 
            className="text-xs sm:text-sm text-muted-foreground truncate whitespace-nowrap"
            title={document.file_name}
          >
            {document.file_name}
          </p>
          {!companyId && document.company && (
            <p className="text-xs text-blue-600 truncate whitespace-nowrap" title={document.company.name}>
              {document.company.name}
            </p>
          )}
        </div>
        <Badge variant="secondary" className="hidden sm:inline-flex flex-shrink-0">{document.doc_type}</Badge>
        <span className="hidden md:inline text-sm text-muted-foreground flex-shrink-0">{formatFileSize(document.file_size)}</span>
        <span className="hidden lg:inline text-sm text-muted-foreground flex-shrink-0">{formatDate(document.created_at)}</span>
      </div>
      <Popover open={openPopover === document.id} onOpenChange={(open) => setOpenPopover(open ? document.id : null)}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48" align="end">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreviewDocument(document)}
              className="justify-start"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditDocument(document)}
              className="justify-start"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownloadDocument(document)}
              className="justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDocumentToDelete(document);
                setDeleteConfirmOpen(true);
              }}
              className="justify-start text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  // Show message if user has no company (only after role and profile resolution)
  if (!loading && !isLoadingRole && !isPlatformAdmin && !companyId) {
    return (
      <Card className="p-8 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Company Associated</h3>
        <p className="text-muted-foreground">
          You need to be associated with a company to view documents.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium truncate">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{documents.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium truncate">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{formatFileSize(getTotalStorage())}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium truncate">Document Types</CardTitle>
            <Grid3X3 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{getDocumentTypes().length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="browse" className="space-y-4">
        <TabsList className="bg-transparent gap-0 p-0 h-auto border-b rounded-none">
          <TabsTrigger 
            value="browse"
            className="rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Browse Documents
          </TabsTrigger>
          <TabsTrigger 
            value="upload"
            className="rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Upload New
          </TabsTrigger>
          <TabsTrigger 
            value="google-drive"
            className="rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Google Drive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {getDocumentTypes().map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Documents List */}
          {(loading || isLoadingRole || (loadingAdminDocs && isPlatformAdmin)) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-muted rounded-lg"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex justify-between mb-2">
                      <div className="h-5 bg-muted rounded w-16"></div>
                      <div className="h-4 bg-muted rounded w-12"></div>
                    </div>
                    <div className="h-3 bg-muted rounded w-20"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <Card className="p-6 sm:p-8 text-center shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
              <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2">No documents found</h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                {searchTerm || filterType !== 'all' 
                  ? "Try adjusting your search or filter criteria." 
                  : "Upload your first document to get started."
                }
              </p>
            </Card>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" 
              : "space-y-2"
            }>
              {filteredDocuments.map(viewMode === 'grid' ? renderDocumentCard : renderDocumentListItem)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload">
          {companyId ? (
            <DocumentUploadArea 
              companyId={companyId} 
              onUploadComplete={handleUploadComplete} 
            />
          ) : (
            <Card className="p-8 text-center shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Global Document Upload</h3>
              <p className="text-muted-foreground">
                To upload documents, please select a specific company from the client detail page.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="google-drive">
          <Card className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200">
            <CardContent className="pt-6">
              <GoogleDriveFilesTab onOpenFolderSelector={() => setFolderSelectorOpen(true)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {editModalOpen && selectedDocument && (
        <EditDocumentModal
          document={selectedDocument}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onDocumentUpdated={fetchDocuments}
        />
      )}

      {previewModalOpen && selectedDocument && (
        <DocumentPreviewModal
          document={selectedDocument}
          open={previewModalOpen}
          onOpenChange={setPreviewModalOpen}
        />
      )}

      <GoogleDriveFolderSelector
        open={folderSelectorOpen}
        onOpenChange={setFolderSelectorOpen}
      />
    </div>
  );
}
