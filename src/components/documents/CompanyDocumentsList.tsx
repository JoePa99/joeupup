import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Search, Upload, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Document {
  id: string;
  name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  uploaded_by: string;
  doc_type: string;
}

interface CompanyDocumentsListProps {
  agentId?: string;
  companyId?: string;
  onDocumentsUploaded?: () => void;
  companyOnly?: boolean; // New prop to show only company documents without agent management
}

export function CompanyDocumentsList({ agentId, companyId: propCompanyId, onDocumentsUploaded, companyOnly = false }: CompanyDocumentsListProps) {
  const { user } = useAuth();
  const [fetchedCompanyId, setFetchedCompanyId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [agentDocuments, setAgentDocuments] = useState<Set<string>>(new Set());
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingDocument, setRemovingDocument] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const { toast } = useToast();

  // Use prop company ID if provided, otherwise use fetched company ID
  const companyId = propCompanyId || fetchedCompanyId;

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
          setFetchedCompanyId(profile?.company_id || null);
        }
      } catch (error) {
        console.error('Error fetching company ID:', error);
      }
    };

    fetchCompanyId();
  }, [user?.id, toast, propCompanyId]);

  // Fetch documents and agent documents when companyId is available
  useEffect(() => {
    if (companyId) {
      fetchDocuments();
      if (!companyOnly && agentId) {
        fetchAgentDocuments();
      }
    }
  }, [agentId, companyId, companyOnly]);

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
      
      // Filter out documents uploaded during onboarding
      const filteredData = (data || []).filter(doc => 
        !doc.tags?.includes('onboarding')
      );
      
      setDocuments(filteredData);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Error",
        description: "Failed to fetch company documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_documents')
        .select('document_id')
        .eq('agent_id', agentId);

      if (error) throw error;
      setAgentDocuments(new Set(data?.map(d => d.document_id) || []));
    } catch (error) {
      console.error('Error fetching agent documents:', error);
    }
  };

  const handleSelectDocument = (documentId: string, checked: boolean) => {
    const newSelected = new Set(selectedDocuments);
    if (checked) {
      newSelected.add(documentId);
    } else {
      newSelected.delete(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const availableDocuments = filteredDocuments
        .filter(doc => !agentDocuments.has(doc.id))
        .map(doc => doc.id);
      setSelectedDocuments(new Set(availableDocuments));
    } else {
      setSelectedDocuments(new Set());
    }
  };

  const uploadSelectedDocuments = async () => {
    if (selectedDocuments.size === 0) return;

    setUploading(true);
    try {
      // Get user info for the embeddings processing
      const { data: user } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.user?.id)
        .single();

      // Process documents one by one with both OpenAI and embeddings
      for (const documentId of selectedDocuments) {
        const { error } = await supabase.functions.invoke('process-agent-documents', {
          body: {
            document_archive_id: documentId,
            agent_id: agentId,
            company_id: profile?.company_id,
            user_id: user.user?.id
          }
        });
        
        if (error) {
          console.error(`Error uploading document ${documentId}:`, error);
          throw error;
        }
      }

      toast({
        title: "Success",
        description: `${selectedDocuments.size} document(s) uploaded to agent`,
      });

      setSelectedDocuments(new Set());
      await fetchAgentDocuments();
      onDocumentsUploaded?.();
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast({
        title: "Error",
        description: "Failed to upload documents to agent",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (document: Document) => {
    setRemovingDocument(document.id);
    try {
      const { error } = await supabase.functions.invoke('remove-agent-document', {
        body: {
          agent_id: agentId,
          document_id: document.id
        }
      });
      
      if (error) {
        console.error('Error removing document:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: `Document "${document.name}" removed from agent`,
      });

      // Refresh the agent documents list
      await fetchAgentDocuments();
      onDocumentsUploaded?.();
    } catch (error) {
      console.error('Error removing document:', error);
      toast({
        title: "Error",
        description: "Failed to remove document from agent",
        variant: "destructive",
      });
    } finally {
      setRemovingDocument(null);
      setDocumentToDelete(null);
    }
  };

  const handleDeleteClick = (document: Document) => {
    setDocumentToDelete(document);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableDocuments = companyOnly 
    ? filteredDocuments 
    : filteredDocuments.filter(doc => !agentDocuments.has(doc.id));
  const uploadedDocuments = companyOnly 
    ? [] 
    : filteredDocuments.filter(doc => agentDocuments.has(doc.id));

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Upload Actions - Only show for agent mode */}
      {!companyOnly && availableDocuments.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 p-2 sm:p-3 border rounded-lg bg-gray-100 shadow-none">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={selectedDocuments.size === availableDocuments.length && availableDocuments.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              {selectedDocuments.size} of {availableDocuments.length} selected
            </span>
          </div>
          <Button
            onClick={uploadSelectedDocuments}
            disabled={selectedDocuments.size === 0 || uploading}
            size="sm"
            className="w-full sm:w-auto"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            <span className="text-xs sm:text-sm">Upload Selected</span>
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {/* Available Documents */}
        {availableDocuments.length > 0 && (
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
              {companyOnly ? `Company Documents (${availableDocuments.length})` : `Available Documents (${availableDocuments.length})`}
            </h4>
            {availableDocuments.map((doc) => (
              <Card key={doc.id} className="mb-2 shadow-none border border-gray-200">
                <CardHeader className="p-2 sm:p-3 sm:pb-2">
                  <div className="flex items-start gap-2 sm:gap-3">
                    {!companyOnly && (
                      <Checkbox
                        checked={selectedDocuments.has(doc.id)}
                        onCheckedChange={(checked) => handleSelectDocument(doc.id, checked as boolean)}
                        className="mt-0.5 flex-shrink-0"
                      />
                    )}
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h4 className="text-xs sm:text-sm font-medium truncate">{doc.name}</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{doc.file_name}</p>
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-2 py-0">
                          {doc.doc_type}
                        </Badge>
                        <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                          {formatFileSize(doc.file_size)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Uploaded Documents - Only show for agent mode */}
        {!companyOnly && uploadedDocuments.length > 0 && (
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
              Already Uploaded ({uploadedDocuments.length})
            </h4>
            {uploadedDocuments.map((doc) => (
              <Card key={doc.id} className="mb-2 bg-muted/30">
                <CardHeader className="p-2 sm:p-3 sm:pb-2">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full" />
                    </div>
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h4 className="text-xs sm:text-sm font-medium truncate">{doc.name}</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{doc.file_name}</p>
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                        <Badge variant="default" className="text-[10px] sm:text-xs px-1 sm:px-2 py-0">
                          Uploaded
                        </Badge>
                        <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                          {formatFileSize(doc.file_size)}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(doc)}
                      disabled={removingDocument === doc.id}
                      className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      {removingDocument === doc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {filteredDocuments.length === 0 && (
          <div className="text-center py-6 sm:py-8 px-2">
            <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
              {searchTerm ? 'No documents found' : 'No documents available'}
            </h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {searchTerm ? 'Try adjusting your search terms' : 'Upload documents to get started'}
            </p>
          </div>
        )}
      </div>
      
      {/* Confirmation Dialog */}
      <AlertDialog open={!!documentToDelete} onOpenChange={() => setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document from Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{documentToDelete?.name}" from this agent? This action will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Remove the document from the agent's knowledge base</li>
                <li>Delete the file from the agent's vector store in OpenAI</li>
                <li>Make the document unavailable for this agent's conversations</li>
              </ul>
              <p className="mt-2 font-semibold">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingDocument === documentToDelete?.id}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => documentToDelete && removeDocument(documentToDelete)}
              disabled={removingDocument === documentToDelete?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingDocument === documentToDelete?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Document'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}