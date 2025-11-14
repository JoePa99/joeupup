import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Upload, File, X, CheckCircle, Edit3, Loader2 } from "lucide-react";
import { processDocumentForEmbeddings } from "@/lib/document-processing";

interface DocumentUploadProps {
  companyId: string;
  onDocumentsUploaded: (documents: any[]) => void;
}

interface UploadedDocument {
  id: string;
  originalName: string;
  customName: string;
  description: string;
  docType: string;
  size: number;
  type: string;
  url: string;
  uploadProgress: number;
  status: 'pending' | 'uploading' | 'completed' | 'processing' | 'error';
  documentArchiveId?: string; // Store the ID from document_archives table
}

export function DocumentUpload({ companyId, onDocumentsUploaded }: DocumentUploadProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileRefs, setFileRefs] = useState<Map<string, File>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Prevent document operations if no company ID
  if (!companyId) {
    return (
      <Card className="p-8 text-center">
        <div className="space-y-2">
          <p className="text-lg font-medium text-muted-foreground">
            Setting up your workspace...
          </p>
          <p className="text-sm text-muted-foreground">
            Please wait while we initialize your company setup.
          </p>
        </div>
      </Card>
    );
  }

  const handleFileUpload = useCallback(async (files: FileList) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv'
    ];

    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB

    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type not supported: ${file.name}`);
        continue;
      }

      if (file.size > maxSizeInBytes) {
        toast.error(`File too large: ${file.name}. Max size is 10MB.`);
        continue;
      }

      const documentId = crypto.randomUUID();
      const newDocument: UploadedDocument = {
        id: documentId,
        originalName: file.name,
        customName: file.name,
        description: '',
        docType: 'other',
        size: file.size,
        type: file.type,
        url: '',
        uploadProgress: 0,
        status: 'pending'
      };

      setDocuments(prev => [...prev, newDocument]);
      setFileRefs(prev => new Map(prev).set(documentId, file));
    }
    
    // Reset the file input so the same files can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const updateDocumentMetadata = useCallback((documentId: string, field: keyof UploadedDocument, value: string) => {
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === documentId ? { ...doc, [field]: value } : doc
      )
    );
  }, []);

  const processDocumentForEmbeddingsLocal = useCallback(async (documentArchiveId: string, companyId: string) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      const result = await processDocumentForEmbeddings(documentArchiveId, companyId, user.id);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process document for embeddings');
      }
      
      return result;
    } catch (error) {
      console.error('Error processing document for embeddings:', error);
      throw error;
    }
  }, [user?.id]);

  const uploadDocument = useCallback(async (document: UploadedDocument, file: File) => {
    try {
      // Update status to uploading
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === document.id ? { ...doc, status: 'uploading' as const } : doc
        )
      );

      // Create file path with company folder structure
      // Sanitize filename to remove special characters that cause storage errors
      const sanitizedFileName = document.originalName
        .replace(/[^\w\s.-]/g, '') // Remove special characters except word chars, spaces, dots, hyphens
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .trim();
      
      const filePath = `${companyId}/onboarding/${document.id}-${sanitizedFileName}`;

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Save document metadata to database
      const { data: documentData, error: dbError } = await supabase
        .from('document_archives')
        .insert({
          company_id: companyId,
          name: document.customName,
          description: document.description,
          file_name: document.originalName,
          file_type: document.type,
          file_size: document.size,
          storage_path: filePath,
          doc_type: document.docType as any,
          tags: ['onboarding']
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update document with archive ID and set status to processing
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === document.id
            ? { 
                ...doc, 
                url: publicUrl, 
                uploadProgress: 100, 
                status: 'processing' as const,
                documentArchiveId: documentData.id
              }
            : doc
        )
      );

      // Process document for embeddings
      const result = await processDocumentForEmbeddingsLocal(documentData.id, companyId);

      // Update document status to completed after processing
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === document.id
            ? { ...doc, status: 'completed' as const }
            : doc
        )
      );

      // Show success message with chunking info if applicable  
      const successMessage = `${document.customName} uploaded and processed successfully`;
      
      toast.success(successMessage);
    } catch (error: any) {
      console.error('Upload error:', error);
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === document.id
            ? { ...doc, status: 'error' as const }
            : doc
        )
      );
      toast.error(`Failed to upload ${document.customName}: ${error.message}`);
    }
  }, [companyId]);

  const uploadAllDocuments = useCallback(async () => {
    const pendingDocs = documents.filter(doc => doc.status === 'pending');
    
    if (pendingDocs.length === 0) {
      toast.error('No documents to upload');
      return;
    }

    // Upload all documents
    for (const doc of pendingDocs) {
      const file = fileRefs.get(doc.id);
      if (file) {
        await uploadDocument(doc, file);
      }
    }
  }, [documents, fileRefs, uploadDocument]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const removeDocument = useCallback((documentId: string) => {
    setDocuments(prev => {
      const updatedDocs = prev.filter(doc => doc.id !== documentId);
      // Reset file input when all documents are removed
      if (updatedDocs.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return updatedDocs;
    });
    setFileRefs(prev => {
      const newMap = new Map(prev);
      newMap.delete(documentId);
      return newMap;
    });
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Update parent component when documents change
  React.useEffect(() => {
    const completedDocs = documents.filter(doc => doc.status === 'completed');
    onDocumentsUploaded(completedDocs);
  }, [documents, onDocumentsUploaded]);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="p-8 text-center">
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <div className="space-y-2">
            <p className="text-lg font-medium">
              Drag and drop your documents here
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse files
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.csv"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            Browse Files
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Supported formats: PDF, DOC, DOCX, TXT, CSV (Max 10MB each)
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            ⚠️ Large documents (&gt;50KB) will be processed in chunks. Very long documents may lose some content.
          </p>
        </CardContent>
      </Card>

      {/* Document List with Metadata Forms */}
      {documents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Documents</h4>
            {documents.some(doc => doc.status === 'pending') && (
              <Button onClick={uploadAllDocuments} className="ml-auto">
                Upload All Documents
              </Button>
            )}
          </div>
          
          {documents.map((doc) => (
            <Card key={doc.id} className="p-4">
              {doc.status === 'pending' ? (
                // Metadata form for pending documents
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <File className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Configure Document</p>
                      <p className="text-xs text-muted-foreground">
                        Original: {doc.originalName} • {formatFileSize(doc.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocument(doc.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${doc.id}`}>Document Name</Label>
                      <Input
                        id={`name-${doc.id}`}
                        value={doc.customName}
                        onChange={(e) => updateDocumentMetadata(doc.id, 'customName', e.target.value)}
                        placeholder="Enter document name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`type-${doc.id}`}>Document Type</Label>
                      <Select
                        value={doc.docType}
                        onValueChange={(value) => updateDocumentMetadata(doc.id, 'docType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="policy">Company Policy</SelectItem>
                          <SelectItem value="procedure">Procedure</SelectItem>
                          <SelectItem value="training">Training Material</SelectItem>
                          <SelectItem value="product">Product Information</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`desc-${doc.id}`}>Description</Label>
                    <Textarea
                      id={`desc-${doc.id}`}
                      value={doc.description}
                      onChange={(e) => updateDocumentMetadata(doc.id, 'description', e.target.value)}
                      placeholder="Describe the content and purpose of this document..."
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
              ) : (
                // Display for uploaded/uploading documents
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <File className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.customName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.size)}
                        {doc.description && ` • ${doc.description.substring(0, 50)}${doc.description.length > 50 ? '...' : ''}`}
                      </p>
                      {doc.status === 'uploading' && (
                        <Progress value={doc.uploadProgress} className="mt-1 h-1" />
                      )}
                      {doc.status === 'processing' && (
                        <div className="flex items-center space-x-2 mt-1">
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          <span className="text-xs text-primary">Processing for AI...</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {doc.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-success" />
                    )}
                    {doc.status === 'processing' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {doc.status === 'error' && (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocument(doc.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}