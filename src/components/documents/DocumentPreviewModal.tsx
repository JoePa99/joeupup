import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, ExternalLink, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Document {
  id: string;
  name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
  uploaded_by: string;
  doc_type: string;
  description: string | null;
}

interface DocumentPreviewModalProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// File type categories for different preview methods
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
const PDF_TYPES = ['application/pdf'];
const TEXT_TYPES = ['text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript', 'application/json', 'text/markdown'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
// Office documents - will use Google Docs Viewer or Office Online
const OFFICE_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword', // .doc
  'application/vnd.ms-excel', // .xls
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.oasis.opendocument.text', // .odt
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'application/vnd.oasis.opendocument.presentation', // .odp
];

export function DocumentPreviewModal({ document, open, onOpenChange }: DocumentPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (document && open) {
      loadDocument();
    } else {
      // Reset state when modal closes
      setDocumentUrl(null);
      setTextContent(null);
      setError(null);
      setLoading(true);
    }
  }, [document, open]);

  const loadDocument = async () => {
    if (!document) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Loading document:', { 
        id: document.id, 
        file_type: document.file_type, 
        storage_path: document.storage_path 
      });
      
      // For text files, first try to fetch inline content from documents table
      if (TEXT_TYPES.includes(document.file_type)) {
        console.log('Fetching inline content for text document from documents table...');
        
        const { data: contentChunks, error: contentError } = await supabase
          .from('documents')
          .select('content')
          .eq('document_archive_id', document.id)
          .order('id', { ascending: true });

        if (contentError) {
          console.error('Error fetching inline content:', contentError);
        }

        if (contentChunks && contentChunks.length > 0) {
          // Concatenate all content chunks
          const fullContent = contentChunks.map(chunk => chunk.content).join('\n\n');
          console.log(`Found ${contentChunks.length} content chunk(s) for document`);
          setTextContent(fullContent);
          setLoading(false);
          return;
        }

        // No inline content found - this is expected for markdown created via playbook
        console.log('No inline content found in documents table');
        setError('No inline content found for this document. It may be a draft saved to storage only or hasn\'t been embedded yet.');
        setLoading(false);
        return;
      }

      // For other files, get a signed URL from storage
      const { data, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.storage_path, 3600); // 1 hour expiry

      if (urlError) {
        console.error('Storage URL error:', {
          error: urlError,
          storagePath: document.storage_path,
          bucket: 'documents'
        });
        throw urlError;
      }

      setDocumentUrl(data.signedUrl);
    } catch (err: any) {
      console.error('Error loading document:', err);
      const errorMessage = `Failed to load document. Error: ${err.message || 'Unknown error'}`;
      setError(errorMessage);
      toast({
        title: "Preview Error",
        description: "Failed to load document preview.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (error) throw error;

      // Create blob URL and trigger download
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

      toast({
        title: "Download started",
        description: `Downloading ${fileName}`,
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Download failed",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const handleOpenInNewTab = () => {
    if (documentUrl) {
      window.open(documentUrl, '_blank');
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[600px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Loading preview...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-[600px]">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    if (!document) return null;

    // Text content preview
    if (textContent !== null) {
      return (
        <div className="h-[600px] overflow-auto">
          <pre className="p-4 bg-muted rounded-lg text-sm font-mono whitespace-pre-wrap break-words">
            {textContent}
          </pre>
        </div>
      );
    }

    // Image preview
    if (IMAGE_TYPES.includes(document.file_type)) {
      return (
        <div className="flex items-center justify-center h-[600px] bg-muted/30 rounded-lg overflow-hidden">
          <img
            src={documentUrl || ''}
            alt={document.name}
            className="max-w-full max-h-full object-contain"
            onError={() => setError('Failed to load image')}
          />
        </div>
      );
    }

    // PDF preview
    if (PDF_TYPES.includes(document.file_type)) {
      return (
        <div className="h-[600px] rounded-lg overflow-hidden border">
          <iframe
            src={`${documentUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-full"
            title={document.name}
            onError={() => setError('Failed to load PDF')}
          />
        </div>
      );
    }

    // Video preview
    if (VIDEO_TYPES.includes(document.file_type)) {
      return (
        <div className="flex items-center justify-center h-[600px] bg-muted/30 rounded-lg">
          <video
            src={documentUrl || ''}
            controls
            className="max-w-full max-h-full"
            onError={() => setError('Failed to load video')}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    // Audio preview
    if (AUDIO_TYPES.includes(document.file_type)) {
      return (
        <div className="flex flex-col items-center justify-center h-[600px] bg-muted/30 rounded-lg">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4">Audio File</p>
          <audio
            src={documentUrl || ''}
            controls
            className="w-full max-w-md"
            onError={() => setError('Failed to load audio')}
          >
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    // Office documents preview using Google Docs Viewer
    if (OFFICE_TYPES.includes(document.file_type)) {
      // Use Google Docs Viewer for Office documents
      const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(documentUrl || '')}&embedded=true`;
      
      return (
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Office document preview using Google Docs Viewer. For best results, download the file or open in a new tab.
            </AlertDescription>
          </Alert>
          <div className="h-[550px] rounded-lg overflow-hidden border">
            <iframe
              src={viewerUrl}
              className="w-full h-full"
              title={document.name}
              onError={() => setError('Failed to load document preview')}
            />
          </div>
        </div>
      );
    }

    // Fallback for unsupported types
    return (
      <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium mb-2">Preview not available</p>
          <p className="text-sm text-muted-foreground mb-4">
            This file type ({document.file_type}) cannot be previewed in the browser.
          </p>
          <Button onClick={handleDownload} variant="default">
            <Download className="mr-2 h-4 w-4" />
            Download File
          </Button>
        </div>
      </div>
    );
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <DialogTitle className="text-xl truncate" title={document.name}>
                {document.name}
              </DialogTitle>
              <DialogDescription className="mt-1 truncate" title={document.file_name}>
                {document.file_name} • {document.file_type} • {(document.file_size / 1024).toFixed(1)} KB
              </DialogDescription>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {documentUrl && !TEXT_TYPES.includes(document.file_type) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                title="Download file"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {renderPreview()}
        </div>

        {document.description && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>Description:</strong> {document.description}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

