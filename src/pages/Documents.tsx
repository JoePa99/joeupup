import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SubscriptionRequiredModal } from '@/components/billing/SubscriptionRequiredModal';
import { useSubscriptionRequired } from '@/hooks/useSubscriptionRequired';

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
}

export default function Documents() {
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

  // Check subscription status
  const { 
    showModal: showSubscriptionModal, 
    setShowModal: setShowSubscriptionModal,
    isAdmin, 
    companyId,
    isLoading: isLoadingSubscription 
  } = useSubscriptionRequired();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('document_archives')
        .select('*')
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
    setSelectedDocument(document);
    setEditModalOpen(true);
    setOpenPopover(null); // Close popover when opening edit modal
  };

  const handlePreviewDocument = (document: Document) => {
    setSelectedDocument(document);
    setPreviewModalOpen(true);
    setOpenPopover(null); // Close popover when opening preview modal
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
        description: `${document.name} has been successfully deleted.`,
      });

      fetchDocuments(); // Refresh the list
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmOpen(false);
      setDocumentToDelete(null);
      setOpenPopover(null);
    }
  };

  const openDeleteConfirmation = (document: Document) => {
    setDocumentToDelete(document);
    setDeleteConfirmOpen(true);
    setOpenPopover(null);
  };

  const handleDocumentUpdated = () => {
    fetchDocuments();
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || doc.doc_type === filterType;
    return matchesSearch && matchesType;
  });

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
      day: 'numeric'
    });
  };

  const getTotalStorage = () => {
    return documents.reduce((total, doc) => total + doc.file_size, 0);
  };

  const getDocumentTypes = () => {
    const types = new Set(documents.map(doc => doc.doc_type));
    return Array.from(types);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 md:h-12 flex items-center border-b border-border px-4 sm:px-6">
            <SidebarTrigger className="mr-4 h-10 w-10 md:h-7 md:w-7" />
            <h1 className="text-lg font-semibold">Document Management</h1>
          </header>
          
          {/* Content */}
          <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{documents.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatFileSize(getTotalStorage())}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Document Types</CardTitle>
                  <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{getDocumentTypes().length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <Tabs defaultValue="browse" className="space-y-4">
              <TabsList>
                <TabsTrigger value="browse">Browse Documents</TabsTrigger>
                <TabsTrigger value="upload">Upload New</TabsTrigger>
                <TabsTrigger value="google-drive">Google Drive</TabsTrigger>
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

                {/* Documents Display */}
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader>
                          <div className="h-4 bg-muted rounded w-3/4"></div>
                          <div className="h-3 bg-muted rounded w-1/2"></div>
                        </CardHeader>
                        <CardContent>
                          <div className="h-3 bg-muted rounded w-full mb-2"></div>
                          <div className="h-3 bg-muted rounded w-2/3"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <>
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredDocuments.map((doc) => (
                          <Card key={doc.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <FileText className="h-8 w-8 text-primary mb-2" />
                                <Popover 
                                  open={openPopover === `grid-${doc.id}`} 
                                  onOpenChange={(open) => setOpenPopover(open ? `grid-${doc.id}` : null)}
                                >
                                  <PopoverTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                   <PopoverContent className="w-fit right-10 -top-4 p-2 bg-white">
                                    <div className="flex flex-col gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start"
                                        onClick={() => handlePreviewDocument(doc)}
                                      >
                                        <Eye className="mr-2 h-4 w-4" />
                                        Preview
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start"
                                        onClick={() => handleEditDocument(doc)}
                                      >
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start text-destructive hover:text-destructive"
                                        onClick={() => openDeleteConfirmation(doc)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <CardTitle className="text-sm font-medium truncate" title={doc.name}>
                                {doc.name}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground truncate" title={doc.file_name}>
                                {doc.file_name}
                              </p>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                <Badge variant="secondary">{doc.doc_type}</Badge>
                                <span>{formatFileSize(doc.file_size)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Uploaded {formatDate(doc.created_at)}
                              </p>
                              {doc.description && (
                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                  {doc.description}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredDocuments.map((doc) => (
                          <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium truncate">{doc.name}</h4>
                                    <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-4 flex-shrink-0">
                                  <Badge variant="secondary" className="text-xs">{doc.doc_type}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(doc.file_size)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(doc.created_at)}
                                  </span>
                                  <Popover 
                                    open={openPopover === `list-${doc.id}`} 
                                    onOpenChange={(open) => setOpenPopover(open ? `list-${doc.id}` : null)}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-fit right-10 -top-4 p-2 bg-white">
                                      <div className="flex flex-col gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="justify-start"
                                          onClick={() => handlePreviewDocument(doc)}
                                        >
                                          <Eye className="mr-2 h-4 w-4" />
                                          Preview
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="justify-start"
                                          onClick={() => handleEditDocument(doc)}
                                        >
                                          <Edit className="mr-2 h-4 w-4" />
                                          Edit
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="justify-start text-destructive hover:text-destructive"
                                          onClick={() => openDeleteConfirmation(doc)}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete
                                        </Button>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {filteredDocuments.length === 0 && (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium text-muted-foreground mb-2">
                          {searchTerm || filterType !== 'all' ? 'No documents found' : 'No documents yet'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm || filterType !== 'all' 
                            ? 'Try adjusting your search or filters' 
                            : 'Upload your first document to get started'
                          }
                        </p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="upload">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload New Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DocumentUploadArea onUploadComplete={handleUploadComplete} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="google-drive">
                <Card>
                  <CardContent className="pt-6">
                    <GoogleDriveFilesTab onOpenFolderSelector={() => setFolderSelectorOpen(true)} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
      
      <EditDocumentModal
        document={selectedDocument}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onDocumentUpdated={handleDocumentUpdated}
      />

      <DocumentPreviewModal
        document={selectedDocument}
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
      />

      <GoogleDriveFolderSelector
        open={folderSelectorOpen}
        onOpenChange={setFolderSelectorOpen}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => documentToDelete && handleDeleteDocument(documentToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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