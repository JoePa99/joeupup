// DocumentPreviewSidebar component for previewing various file types in chat
import React, { useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { supabase } from '@/integrations/supabase/client';

interface FileAttachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface DocumentPreviewSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileAttachment | null;
}

export const DocumentPreviewSidebar: React.FC<DocumentPreviewSidebarProps> = ({
  isOpen,
  onClose,
  file
}) => {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (file && isOpen) {
      loadFile();
    }
  }, [file, isOpen]);

  const loadFile = async () => {
    if (!file) return;
    
    setLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(file.path, 3600); // 1 hour expiry
      
      if (error) throw error;
      setFileUrl(data.signedUrl);
    } catch (err) {
      setError('Failed to load file');
      console.error('Error loading file:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = file?.name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-destructive">
          {error}
        </div>
      );
    }

    if (!file || !fileUrl) return null;

    // Image preview
    if (file.type.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center h-full overflow-auto">
          <img 
            src={fileUrl} 
            alt={file.name}
            style={{ transform: `scale(${zoom / 100})` }}
            className="max-w-full max-h-full object-contain transition-transform"
          />
        </div>
      );
    }

    // PDF preview
    if (file.type === 'application/pdf') {
      return (
        <iframe
          src={fileUrl}
          className="w-full h-full border-0"
          title={file.name}
        />
      );
    }

    // CSV and text files
    if (file.type === 'text/csv' || file.type.startsWith('text/')) {
      return (
        <iframe
          src={fileUrl}
          className="w-full h-full border-0 bg-background"
          title={file.name}
        />
      );
    }

    // Default fallback for unsupported files
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="mb-4">Preview not available for this file type</p>
        <Button onClick={handleDownload} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Download File
        </Button>
      </div>
    );
  };

  

  return (
    <div className="w-96 shrink-0 bg-card border-l border-border h-full flex flex-col">
      {/* Header */}
      <div className="p-4 py-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base truncate">{file?.name}</h2>
            <p className="text-sm text-muted-foreground">
              {file && formatFileSize(file.size)}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {file?.type.startsWith('image/') && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(Math.max(25, zoom - 25))}
                  disabled={zoom <= 25}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                  {zoom}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(Math.min(200, zoom + 25))}
                  disabled={zoom >= 200}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderPreview()}
      </div>
    </div>
  );
};