import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle,
  Download,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface FileUploadManagerProps {
  companyId: string;
  sectionId?: string;
  onFileUploaded?: (fileUrl: string, fileName: string) => void;
}

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
  sectionId?: string;
}

interface FileUpload {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  url?: string;
}

export function FileUploadManager({ companyId, sectionId, onFileUploaded }: FileUploadManagerProps) {
  const [uploads, setUploads] = useState<Map<string, FileUpload>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing files for this company/section
  const { data: existingFiles } = useQuery({
    queryKey: ['uploaded-files', companyId, sectionId],
    queryFn: async (): Promise<UploadedFile[]> => {
      const folder = sectionId ? `${companyId}/${sectionId}` : companyId;
      
      const { data, error } = await supabase.storage
        .from('playbook-documents')
        .list(folder, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const filesWithUrls = await Promise.all(
        (data || []).map(async (file) => {
          const { data: urlData } = await supabase.storage
            .from('playbook-documents')
            .createSignedUrl(`${folder}/${file.name}`, 3600); // 1 hour expiry

          return {
            id: file.id || file.name,
            name: file.name,
            url: urlData?.signedUrl || '',
            size: file.metadata?.size || 0,
            type: file.metadata?.mimetype || 'application/octet-stream',
            uploadedAt: file.created_at || new Date().toISOString(),
            sectionId
          };
        })
      );

      return filesWithUrls;
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const folder = sectionId ? `${companyId}/${sectionId}` : companyId;
      const filePath = `${folder}/${fileName}`;
      
      const { error } = await supabase.storage
        .from('playbook-documents')
        .remove([filePath]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploaded-files', companyId, sectionId] });
      toast({
        title: "File Deleted",
        description: "The file has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    }
  });

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(file => {
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} exceeds the 50MB limit`,
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/gif'
      ];

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Unsupported File Type",
          description: `${file.name} is not a supported file type`,
          variant: "destructive",
        });
        return;
      }

      uploadFile(file);
    });
  };

  const uploadFile = async (file: File) => {
    const fileId = `${Date.now()}-${file.name}`;
    const folder = sectionId ? `${companyId}/${sectionId}` : companyId;
    const filePath = `${folder}/${file.name}`;

    // Initialize upload state
    setUploads(prev => new Map(prev).set(fileId, {
      file,
      progress: 0,
      status: 'uploading'
    }));

    try {
      // Upload file with progress tracking
      const { data, error } = await supabase.storage
        .from('playbook-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = await supabase.storage
        .from('playbook-documents')
        .createSignedUrl(filePath, 3600);

      // Update upload state
      setUploads(prev => {
        const newMap = new Map(prev);
        newMap.set(fileId, {
          file,
          progress: 100,
          status: 'success',
          url: urlData?.signedUrl || ''
        });
        return newMap;
      });

      // Call callback if provided
      if (onFileUploaded && urlData?.signedUrl) {
        onFileUploaded(urlData.signedUrl, file.name);
      }

      // Refresh file list
      queryClient.invalidateQueries({ queryKey: ['uploaded-files', companyId, sectionId] });

      toast({
        title: "Upload Successful",
        description: `${file.name} has been uploaded successfully.`,
      });

      // Remove from upload list after delay
      setTimeout(() => {
        setUploads(prev => {
          const newMap = new Map(prev);
          newMap.delete(fileId);
          return newMap;
        });
      }, 3000);

    } catch (error: any) {
      setUploads(prev => {
        const newMap = new Map(prev);
        newMap.set(fileId, {
          file,
          progress: 0,
          status: 'error',
          error: error.message
        });
        return newMap;
      });

      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  const cancelUpload = (fileId: string) => {
    setUploads(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('image')) return <File className="h-5 w-5 text-blue-500" />;
    if (type.includes('word') || type.includes('document')) return <FileText className="h-5 w-5 text-blue-600" />;
    if (type.includes('sheet') || type.includes('excel')) return <File className="h-5 w-5 text-green-600" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Upload Documents</h3>
        </div>
        
        {/* Drag & Drop Area */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileSelect(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => e.preventDefault()}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted" />
          <h4 className="text-lg font-medium text-foreground mb-2">
            Drop files here or click to upload
          </h4>
          <p className="text-text-secondary mb-4">
            Support for PDF, DOC, XLS, TXT, CSV, and image files up to 50MB
          </p>
          <Button type="button">
            Choose Files
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </Card>

      {/* Active Uploads */}
      {uploads.size > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Uploading Files</h3>
          <div className="space-y-4">
            {Array.from(uploads.entries()).map(([fileId, upload]) => (
              <div key={fileId} className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {upload.status === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : upload.status === 'error' ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground truncate">
                      {upload.file.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatFileSize(upload.file.size)}
                    </span>
                  </div>
                  
                  {upload.status === 'uploading' && (
                    <Progress value={upload.progress} className="h-2" />
                  )}
                  
                  {upload.status === 'error' && (
                    <p className="text-xs text-red-500 mt-1">{upload.error}</p>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelUpload(fileId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Existing Files */}
      {existingFiles && existingFiles.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Uploaded Documents ({existingFiles.length})
          </h3>
          <div className="space-y-3">
            {existingFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-3 border border-border rounded-lg hover:bg-surface-subtle"
              >
                <div className="flex-shrink-0">
                  {getFileIcon(file.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  {file.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(file.url, '_blank')}
                      title="Download/View"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteFileMutation.mutate(file.name)}
                    title="Delete"
                    disabled={deleteFileMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {(!existingFiles || existingFiles.length === 0) && uploads.size === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Documents Uploaded
          </h3>
          <p className="text-text-secondary">
            Upload documents to support your playbook content.
          </p>
        </Card>
      )}
    </div>
  );
}
