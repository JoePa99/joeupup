// FileAttachmentDisplay component for showing file attachments in chat messages
import React from 'react';
import { File, FileImage, FileText, Download } from 'lucide-react';
import { Card } from './card';

interface FileAttachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface FileAttachmentDisplayProps {
  attachments: FileAttachment[];
  onFileClick: (file: FileAttachment) => void;
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) {
    return <FileImage className="w-5 h-5 text-blue-500" />;
  }
  if (type === 'application/pdf') {
    return <FileText className="w-5 h-5 text-red-500" />;
  }
  if (type === 'text/csv' || type.includes('spreadsheet')) {
    return <FileText className="w-5 h-5 text-green-500" />;
  }
  if (type.includes('word') || type.includes('document')) {
    return <FileText className="w-5 h-5 text-blue-600" />;
  }
  return <File className="w-5 h-5 text-muted-foreground" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const FileAttachmentDisplay: React.FC<FileAttachmentDisplayProps> = ({
  attachments,
  onFileClick
}) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((file, index) => (
        <Card 
          key={index} 
          className="p-3 cursor-pointer hover:bg-muted/50 transition-colors border border-border/50"
          onClick={() => onFileClick(file)}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {getFileIcon(file.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
            <div className="flex-shrink-0">
              <Download className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};