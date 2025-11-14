import { useState } from 'react';
import { useChannelFiles, ChannelFile } from '@/hooks/useChannelFiles';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Download, 
  FileText, 
  Image, 
  File, 
  Calendar,
  User,
  Loader2,
  AlertCircle,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ChannelFilesListProps {
  channelId: string;
}

export function ChannelFilesList({ channelId }: ChannelFilesListProps) {
  const { files, isLoading, error, downloadFile, getFileUrl } = useChannelFiles(channelId);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<ChannelFile | null>(null);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('text')) {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeColor = (fileType: string) => {
    if (fileType.startsWith('image/')) return 'bg-green-100 text-green-800';
    if (fileType.includes('pdf')) return 'bg-red-100 text-red-800';
    if (fileType.includes('document') || fileType.includes('text')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const handleDownload = async (file: ChannelFile) => {
    setDownloadingFiles(prev => new Set(prev).add(file.id));
    try {
      await downloadFile(file);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });
    }
  };

  const handlePreview = async (file: ChannelFile) => {
    try {
      const url = await getFileUrl(file.path);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Preview failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Loading files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <AlertCircle className="h-6 w-6 text-destructive mb-2" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No files shared in this channel yet</p>
        <p className="text-xs">Files uploaded in messages will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">
          Files ({files.length})
        </h4>
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {getFileIcon(file.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={file.name}>
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant="secondary" 
                      className={cn("text-xs", getFileTypeColor(file.type))}
                    >
                      {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{file.uploadedBy}</span>
                    <Calendar className="h-3 w-3 ml-2" />
                    <span>{formatDistanceToNow(new Date(file.uploadedAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePreview(file)}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(file)}
                  disabled={downloadingFiles.has(file.id)}
                  className="h-8 w-8 p-0"
                >
                  {downloadingFiles.has(file.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
