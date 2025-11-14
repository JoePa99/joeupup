import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Search, 
  Download, 
  Trash2, 
  Edit3, 
  ArrowLeft,
  Loader2,
  Building,
  User,
  HardDrive,
  Grid3X3,
  List,
  Filter,
  Calendar,
  Eye,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CompanyWithDetails } from '@/hooks/useAdminData';
import { 
  useAdminDocuments, 
  useCompanyDocuments,
  useDocumentStats,
  useDeleteDocument,
  useUpdateDocument,
  useDownloadDocument,
  formatFileSize,
  getDocumentTypeDisplayName,
  getDocumentTypeColor,
  type DocumentWithDetails 
} from '@/hooks/useDocumentManagement';
import { processMultipleDocumentsForEmbeddings } from '@/lib/document-processing';

interface DocumentManagerProps {
  company?: CompanyWithDetails | null;
  onBack: () => void;
}

export function DocumentManager({ company, onBack }: DocumentManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>(company?.id || 'all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [documentToDelete, setDocumentToDelete] = useState<DocumentWithDetails | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<DocumentWithDetails | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    doc_type: '' as any,
    tags: [] as string[]
  });
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessProgress, setReprocessProgress] = useState({ completed: 0, total: 0 });

  const { toast } = useToast();

  // Use appropriate hook based on whether we're viewing a specific company or all companies
  const { 
    data: allDocuments, 
    isLoading: loadingAllDocs, 
    error: allDocsError 
  } = useAdminDocuments();
  
  const { 
    data: companyDocs, 
    isLoading: loadingCompanyDocs 
  } = useCompanyDocuments(company?.id);

  const { data: stats } = useDocumentStats();
  const deleteDocument = useDeleteDocument();
  const updateDocument = useUpdateDocument();
  const downloadDocument = useDownloadDocument();

  // Determine which documents to use
  const documents = company ? (companyDocs || []) : (allDocuments || []);
  const isLoading = company ? loadingCompanyDocs : loadingAllDocs;

  // Get unique companies for filtering
  const companies = Array.from(new Set(
    (allDocuments || [])
      .map(doc => doc.company)
      .filter(Boolean)
  )).sort((a, b) => a!.name.localeCompare(b!.name));

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.uploader?.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || doc.doc_type === filterType;
    const matchesCompany = selectedCompany === 'all' || doc.company_id === selectedCompany;
    
    return matchesSearch && matchesType && matchesCompany;
  });

  // Get unique document types
  const documentTypes = Array.from(new Set(documents.map(doc => doc.doc_type)));

  const handleDeleteDocument = async (document: DocumentWithDetails) => {
    try {
      await deleteDocument.mutateAsync(document.id);
      toast({
        title: "Document deleted",
        description: `"${document.name}" has been permanently deleted.`,
      });
      setDocumentToDelete(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const handleEditDocument = (document: DocumentWithDetails) => {
    setDocumentToEdit(document);
    setEditForm({
      name: document.name,
      description: document.description || '',
      doc_type: document.doc_type,
      tags: document.tags || []
    });
  };

  const handleUpdateDocument = async () => {
    if (!documentToEdit) return;

    try {
      await updateDocument.mutateAsync({
        documentId: documentToEdit.id,
        updates: {
          name: editForm.name,
          description: editForm.description || null,
          doc_type: editForm.doc_type,
          tags: editForm.tags.length > 0 ? editForm.tags : null
        }
      });

      toast({
        title: "Document updated",
        description: `"${editForm.name}" has been updated.`,
      });
      setDocumentToEdit(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update document",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (document: DocumentWithDetails) => {
    try {
      await downloadDocument.mutateAsync(document);
      toast({
        title: "Download started",
        description: `Downloading "${document.file_name}"`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleReprocessAllDocuments = async () => {
    if (!company) {
      toast({
        title: "Error",
        description: "Company information is required for reprocessing",
        variant: "destructive",
      });
      return;
    }

    setReprocessing(true);
    setReprocessProgress({ completed: 0, total: documents.length });

    try {
      // Prepare documents for reprocessing
      const documentsToProcess = documents.map(doc => ({
        id: doc.id,
        name: doc.file_name
      }));

      await processMultipleDocumentsForEmbeddings(
        documentsToProcess,
        company.id,
        company.id, // Using company.id as user_id for admin operations
        (completed, total) => {
          setReprocessProgress({ completed, total });
        }
      );

      toast({
        title: "Success",
        description: `Successfully reprocessed ${documents.length} documents with improved text extraction`,
      });
    } catch (error) {
      console.error('Error reprocessing documents:', error);
      toast({
        title: "Error",
        description: "Failed to reprocess documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setReprocessing(false);
      setReprocessProgress({ completed: 0, total: 0 });
    }
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

  if (allDocsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <div className="text-red-500 mb-4">
            <FileText className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Error Loading Documents
          </h2>
          <p className="text-text-secondary mb-4">
            Failed to load document data. Please try again.
          </p>
          <Button onClick={onBack} variant="outline">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {company ? `${company.name} - Document Management` : 'Document Management'}
          </h1>
          <p className="text-text-secondary">
            {company 
              ? `Manage documents for ${company.name}`
              : 'Manage documents across all companies'
            }
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredDocuments.length}</div>
              <p className="text-xs text-muted-foreground">
                {documents.length} total
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatFileSize(filteredDocuments.reduce((sum, doc) => sum + (doc.file_size || 0), 0))}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(documents.reduce((sum, doc) => sum + (doc.file_size || 0), 0))} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companies</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {company ? 1 : companies.length}
              </div>
              <p className="text-xs text-muted-foreground">
                with documents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Document Types</CardTitle>
              <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documentTypes.length}</div>
              <p className="text-xs text-muted-foreground">
                different types
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {documentTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {getDocumentTypeDisplayName(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!company && (
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map(comp => (
                      <SelectItem key={comp!.id} value={comp!.id}>
                        {comp!.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

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
                {company && documents.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReprocessAllDocuments}
                    disabled={reprocessing}
                  >
                    {reprocessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Reprocessing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reprocess All
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Reprocessing Progress */}
            {reprocessing && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Reprocessing Documents</span>
                  <span className="text-sm text-muted-foreground">
                    {reprocessProgress.completed} / {reprocessProgress.total}
                  </span>
                </div>
                <Progress 
                  value={reprocessProgress.total > 0 ? (reprocessProgress.completed / reprocessProgress.total) * 100 : 0} 
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  This will improve the quality of semantic search by using better text extraction
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents Display */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map((doc) => (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <FileText className="h-8 w-8 text-primary mb-2" />
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            title="Download"
                            disabled={downloadDocument.isPending}
                          >
                            {downloadDocument.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditDocument(doc)}
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDocumentToDelete(doc)}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <CardTitle className="text-sm font-medium truncate" title={doc.name}>
                        {doc.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground truncate" title={doc.file_name}>
                        {doc.file_name}
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <Badge 
                            variant="secondary" 
                            className={getDocumentTypeColor(doc.doc_type)}
                          >
                            {getDocumentTypeDisplayName(doc.doc_type)}
                          </Badge>
                          <span className="text-muted-foreground">
                            {formatFileSize(doc.file_size)}
                          </span>
                        </div>
                        
                        {!company && doc.company && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building className="h-3 w-3" />
                            <span className="truncate">{doc.company.name}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="truncate">
                            {doc.uploader?.first_name && doc.uploader?.last_name 
                              ? `${doc.uploader.first_name} ${doc.uploader.last_name}`
                              : doc.uploader?.email || 'Unknown'
                            }
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(doc.created_at)}</span>
                        </div>

                        {doc.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                            {doc.description}
                          </p>
                        )}
                      </div>
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
                        <div className="flex items-center space-x-4 flex-1 min-w-0">
                          <FileText className="h-6 w-6 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-medium truncate">{doc.name}</h4>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getDocumentTypeColor(doc.doc_type)}`}
                              >
                                {getDocumentTypeDisplayName(doc.doc_type)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mb-1">
                              {doc.file_name}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {!company && doc.company && (
                                <div className="flex items-center gap-1">
                                  <Building className="h-3 w-3" />
                                  <span>{doc.company.name}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>
                                  {doc.uploader?.first_name && doc.uploader?.last_name 
                                    ? `${doc.uploader.first_name} ${doc.uploader.last_name}`
                                    : doc.uploader?.email || 'Unknown'
                                  }
                                </span>
                              </div>
                              <span>{formatFileSize(doc.file_size)}</span>
                              <span>{formatDate(doc.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            title="Download"
                            disabled={downloadDocument.isPending}
                          >
                            {downloadDocument.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEditDocument(doc)}
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDocumentToDelete(doc)}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filteredDocuments.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No documents found
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || filterType !== 'all' || selectedCompany !== 'all'
                    ? 'Try adjusting your search or filters'
                    : company
                    ? 'No documents have been uploaded for this company yet'
                    : 'No documents have been uploaded yet'
                  }
                </p>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!documentToDelete} onOpenChange={() => setDocumentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete "{documentToDelete?.name}"?
                This action cannot be undone and will:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Remove the document from all associated agents</li>
                  <li>Delete the file from storage</li>
                  <li>Remove all document history and access logs</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteDocument.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => documentToDelete && handleDeleteDocument(documentToDelete)}
                disabled={deleteDocument.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteDocument.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Document'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Document Dialog */}
        <Dialog open={!!documentToEdit} onOpenChange={() => setDocumentToEdit(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Document</DialogTitle>
              <DialogDescription>
                Update the document metadata and properties.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Document Name</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter document name"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description (optional)"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="doc_type">Document Type</Label>
                <Select 
                  value={editForm.doc_type} 
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, doc_type: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sop">SOP</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={editForm.tags.join(', ')}
                  onChange={(e) => setEditForm(prev => ({ 
                    ...prev, 
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                  }))}
                  placeholder="Enter tags separated by commas"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDocumentToEdit(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateDocument}
                disabled={!editForm.name.trim() || updateDocument.isPending}
              >
                {updateDocument.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Document'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


