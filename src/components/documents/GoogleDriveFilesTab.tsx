import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Grid3X3, List, ExternalLink, Folder, FileText, Loader2, Settings } from 'lucide-react';
import { useGoogleDriveFolder } from '@/hooks/useGoogleDriveFolder';
import { cn } from '@/lib/utils';

interface GoogleDriveFilesTabProps {
  onOpenFolderSelector: () => void;
}

export function GoogleDriveFilesTab({ onOpenFolderSelector }: GoogleDriveFilesTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const {
    companyFolder,
    isFolderLoading,
    folderFiles,
    isFilesLoading,
    filesError,
    isAdmin,
    hasIntegration,
  } = useGoogleDriveFolder();

  const filteredFiles = (folderFiles || []).filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return 'N/A';
    const size = parseInt(bytes);
    if (size === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('folder')) return Folder;
    return FileText;
  };

  const getMimeTypeBadge = (mimeType: string) => {
    if (mimeType.includes('spreadsheet')) return 'Sheet';
    if (mimeType.includes('document')) return 'Doc';
    if (mimeType.includes('presentation')) return 'Slides';
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('image')) return 'Image';
    if (mimeType.includes('folder')) return 'Folder';
    return 'File';
  };

  // No Google integration
  if (!hasIntegration) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Folder className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Google Drive Not Connected</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Connect your Google Drive account to access and manage files from your company's Google Drive folder.
        </p>
        <Button>Connect Google Drive</Button>
      </div>
    );
  }

  // No folder selected
  if (!companyFolder?.folderId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Folder className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Folder Selected</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          {isAdmin
            ? 'Select a Google Drive folder to share with your team. All team members will be able to view files from the selected folder.'
            : 'Your administrator needs to select a Google Drive folder before you can access files here.'}
        </p>
        {isAdmin && (
          <Button onClick={onOpenFolderSelector}>
            <Settings className="mr-2 h-4 w-4" />
            Select Folder
          </Button>
        )}
      </div>
    );
  }

  // Loading state
  if (isFilesLoading || isFolderLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (filesError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <FileText className="h-16 w-16 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Error Loading Files</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          {filesError.message || 'Failed to load files from Google Drive. Please try again later.'}
        </p>
        {isAdmin && (
          <Button variant="outline" onClick={onOpenFolderSelector}>
            Change Folder
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with folder name */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">{companyFolder.folderName}</p>
            <p className="text-xs text-muted-foreground">{filteredFiles.length} files</p>
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={onOpenFolderSelector}>
            <Settings className="mr-2 h-4 w-4" />
            Change Folder
          </Button>
        )}
      </div>

      {/* Search and View Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
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

      {/* Files Display */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            {searchTerm ? 'No files found' : 'No files in this folder'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm ? 'Try adjusting your search' : 'This folder is currently empty'}
          </p>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFiles.map((file) => {
                const FileIcon = getFileIcon(file.mimeType);
                return (
                  <Card key={file.id} className="shadow-none hover:shadow-sm hover:shadow-gray-100 border border-gray-200 transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <FileIcon className="h-8 w-8 text-primary" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(file.webViewLink, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      <h4 className="text-sm font-medium truncate mb-2" title={file.name}>
                        {file.name}
                      </h4>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {getMimeTypeBadge(file.mimeType)}
                        </Badge>
                        {file.size && <span>{formatFileSize(file.size)}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Modified {formatDate(file.modifiedTime)}
                      </p>
                      {file.shared && (
                        <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          Shared
                        </span>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file) => {
                const FileIcon = getFileIcon(file.mimeType);
                return (
                  <Card key={file.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <FileIcon className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium truncate">{file.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              Modified {formatDate(file.modifiedTime)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {getMimeTypeBadge(file.mimeType)}
                          </Badge>
                          {file.size && (
                            <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                          )}
                          {file.shared && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              Shared
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(file.webViewLink, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}














