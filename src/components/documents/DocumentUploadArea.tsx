import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Loader2, X, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processDocumentForEmbeddings } from '@/lib/document-processing';

interface DocumentUploadAreaProps {
  companyId?: string;
  onUploadComplete?: () => void;
  onClose?: () => void;
  agentId?: string;
}

interface PendingFile {
  file: File;
  id: string;
  name: string;
  description: string;
  docType: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  id: string;
  name: string;
  description: string;
  docType: string;
  documentArchiveId?: string;
}

export function DocumentUploadArea({ companyId: propCompanyId, onUploadComplete, onClose, agentId }: DocumentUploadAreaProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fetchedCompanyId, setFetchedCompanyId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Use prop company ID if provided, otherwise fetch user's company ID
  const companyId = propCompanyId || fetchedCompanyId;

  // Fetch user's company ID only if not provided via props
  useEffect(() => {
    if (propCompanyId) return; // Skip if company ID provided as prop
    
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
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
        return;
      }
      
      setFetchedCompanyId(data?.company_id);
    };
    
    fetchCompanyId();
  }, [user?.id, toast, propCompanyId]);

  const handleFileSelection = useCallback((files: FileList) => {
    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to upload documents",
        variant: "destructive",
      });
      return;
    }
    
    if (!companyId) {
      toast({
        title: "Company required",
        description: "You must be associated with a company to upload documents",
        variant: "destructive",
      });
      return;
    }

    const validFiles = Array.from(files).filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported format`,
          variant: "destructive",
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 10MB limit`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    const newPendingFiles: PendingFile[] = validFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      name: file.name.replace(/\.[^/.]+$/, ''),
      description: '',
      docType: getDocumentType(file.type)
    }));

    setPendingFiles(prev => [...prev, ...newPendingFiles]);
  }, [toast, user?.id, companyId]);

  const updatePendingFile = (id: string, field: keyof Pick<PendingFile, 'name' | 'description' | 'docType'>, value: string) => {
    setPendingFiles(prev => prev.map(file => 
      file.id === id ? { ...file, [field]: value } : file
    ));
  };

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadPendingFiles = useCallback(async () => {
    if (pendingFiles.length === 0) return;

    const newUploadingFiles: UploadingFile[] = pendingFiles.map(pendingFile => ({
      ...pendingFile,
      progress: 0,
      status: 'uploading' as const
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
    setPendingFiles([]);

    for (const uploadingFile of newUploadingFiles) {
      try {
        // Upload to Supabase storage with user ID in path - sanitize filename for storage
        const sanitizedName = sanitizeFilename(uploadingFile.file.name);
        const fileName = `${Date.now()}-${sanitizedName}`;
        const filePath = `${user?.id}/${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, uploadingFile.file);

        if (uploadError) throw uploadError;

        // Save document metadata to database
        const { data: dbData, error: dbError } = await supabase
          .from('document_archives')
          .insert({
            name: uploadingFile.name || uploadingFile.file.name.replace(/\.[^/.]+$/, ''),
            description: uploadingFile.description,
            file_name: uploadingFile.file.name,
            file_type: uploadingFile.file.type,
            file_size: uploadingFile.file.size,
            storage_path: uploadData.path,
            doc_type: uploadingFile.docType as any,
            company_id: companyId,
            uploaded_by: user.id
          })
          .select('id')
          .single();

        if (dbError) throw dbError;

        // Update status to processing for AI
        setUploadingFiles(prev =>
          prev.map(f =>
            f.id === uploadingFile.id
              ? { ...f, status: 'processing' as const, progress: 100, documentArchiveId: dbData.id }
              : f
          )
        );

        toast({
          title: "Upload successful",
          description: `${uploadingFile.file.name} is being processed for AI search...`,
        });

        // Process document for embeddings - unified flow for both agent and company documents
        try {
          const result = await processDocumentForEmbeddings(
            dbData.id,
            companyId!,
            user.id,
            agentId
          );

          if (result.success) {
            setUploadingFiles(prev =>
              prev.map(f =>
                f.id === uploadingFile.id
                  ? { ...f, status: 'completed' as const }
                  : f
              )
            );

            toast({
              title: "Document ready",
              description: agentId 
                ? `${uploadingFile.file.name} is now available to this agent`
                : `${uploadingFile.file.name} is now available to AI agents`,
            });
          } else {
            // Still mark as completed since upload succeeded, just warn about processing
            setUploadingFiles(prev =>
              prev.map(f =>
                f.id === uploadingFile.id
                  ? { ...f, status: 'completed' as const }
                  : f
              )
            );

            console.warn('Document processing failed:', result.error);
            toast({
              title: "Upload successful",
              description: `${uploadingFile.file.name} uploaded but AI processing failed`,
              variant: "destructive",
            });
          }
        } catch (processingError) {
          // Still mark as completed since upload succeeded
          setUploadingFiles(prev =>
            prev.map(f =>
              f.id === uploadingFile.id
                ? { ...f, status: 'completed' as const }
                : f
            )
          );

          console.error('Document processing error:', processingError);
          toast({
            title: "Upload successful",
            description: `${uploadingFile.file.name} uploaded but AI processing failed`,
            variant: "destructive",
          });
        }

      } catch (error) {
        console.error('Upload error:', error);
        setUploadingFiles(prev =>
          prev.map(f =>
            f.id === uploadingFile.id
              ? { ...f, status: 'error' as const }
              : f
          )
        );

        toast({
          title: "Upload failed",
          description: `Failed to upload ${uploadingFile.file.name}`,
          variant: "destructive",
        });
      }
    }

    // Clean up completed uploads after a delay
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(f => f.status === 'uploading'));
      onUploadComplete?.();
    }, 3000);
  }, [pendingFiles, toast, onUploadComplete, user?.id, companyId]);

  const sanitizeFilename = (filename: string) => {
    // Replace special characters with safe alternatives
    return filename
      .replace(/[–—]/g, '-') // Replace en dash and em dash with regular hyphen
      .replace(/[^\w\-_.]/g, '_') // Replace any other non-alphanumeric characters (except hyphens, underscores, dots) with underscores
      .replace(/_{2,}/g, '_') // Replace multiple consecutive underscores with single underscore
      .replace(/^_+|_+$/g, ''); // Remove leading and trailing underscores
  };

  const getDocumentType = (mimeType: string) => {
    switch (mimeType) {
      case 'application/pdf':
        return 'policy';
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return 'manual';
      case 'text/plain':
        return 'other';
      default:
        return 'other';
    }
  };

  const removeUploadingFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelection(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors shadow-none ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-4 sm:p-6">
          <div className="text-center">
            <Upload className="h-4 w-4 sm:h-6 sm:w-6 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="text-xs sm:text-sm font-medium mb-2">Upload New Documents</h3>
            
            <Label htmlFor="document-file-upload">
              <Button variant="outline" size="sm" asChild>
                <span className="text-xs sm:text-sm">Choose Files</span>
              </Button>
            </Label>
            <Input
              id="document-file-upload"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => e.target.files && handleFileSelection(e.target.files)}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pending Files Form */}
      {pendingFiles.length > 0 && (
        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Document Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6 pt-0 sm:pt-0">
            {pendingFiles.map((pendingFile) => (
              <div key={pendingFile.id} className="border rounded-lg p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium truncate">{pendingFile.file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePendingFile(pendingFile.id)}
                    className="flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`name-${pendingFile.id}`} className="text-[10px] sm:text-xs">Document Name</Label>
                    <Input
                      id={`name-${pendingFile.id}`}
                      value={pendingFile.name}
                      onChange={(e) => updatePendingFile(pendingFile.id, 'name', e.target.value)}
                      className="mt-1 text-xs sm:text-sm h-8 sm:h-9"
                      placeholder="Enter document name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`type-${pendingFile.id}`} className="text-[10px] sm:text-xs">Document Type</Label>
                    <select
                      id={`type-${pendingFile.id}`}
                      value={pendingFile.docType}
                      onChange={(e) => updatePendingFile(pendingFile.id, 'docType', e.target.value)}
                      className="mt-1 w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-input rounded-md bg-background h-8 sm:h-9"
                    >
                      <option value="policy">Policy</option>
                      <option value="manual">Manual</option>
                      <option value="sop">SOP</option>
                      <option value="template">Template</option>
                      <option value="contract">Contract</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor={`description-${pendingFile.id}`} className="text-[10px] sm:text-xs">Description</Label>
                  <textarea
                    id={`description-${pendingFile.id}`}
                    value={pendingFile.description}
                    onChange={(e) => updatePendingFile(pendingFile.id, 'description', e.target.value)}
                    className="mt-1 w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-input rounded-md bg-background resize-none"
                    placeholder="Enter document description"
                    rows={2}
                  />
                </div>
              </div>
            ))}
            
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 sm:pt-4 border-t">
              <Button variant="outline" onClick={() => {
                setPendingFiles([]);
                onClose?.();
              }} className="w-full sm:w-auto text-xs sm:text-sm h-9">
                Cancel
              </Button>
              <Button onClick={uploadPendingFiles} className="w-full sm:w-auto text-xs sm:text-sm h-9">
                Upload {pendingFiles.length} {pendingFiles.length === 1 ? 'Document' : 'Documents'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs sm:text-sm font-medium">Uploading Files</h4>
          {uploadingFiles.map((uploadingFile) => (
            <Card key={uploadingFile.id} className="p-2 sm:p-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium truncate">
                    {uploadingFile.file.name}
                  </p>
                  {uploadingFile.status === 'uploading' && (
                    <Progress value={uploadingFile.progress} className="mt-1 h-1 sm:h-2" />
                  )}
                  {uploadingFile.status === 'processing' && (
                    <div className="flex items-center space-x-1 mt-1">
                      <Brain className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-600" />
                      <p className="text-[10px] sm:text-xs text-blue-600">Processing for AI search...</p>
                    </div>
                  )}
                  {uploadingFile.status === 'completed' && (
                    <p className="text-[10px] sm:text-xs text-green-600">Ready for AI agents</p>
                  )}
                  {uploadingFile.status === 'error' && (
                    <p className="text-[10px] sm:text-xs text-red-600">Upload failed</p>
                  )}
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  {(uploadingFile.status === 'uploading' || uploadingFile.status === 'processing') && (
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUploadingFile(uploadingFile.id)}
                    className="h-6 w-6 sm:h-7 sm:w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}