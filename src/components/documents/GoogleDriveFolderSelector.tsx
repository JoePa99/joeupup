import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Folder, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGoogleDriveFolder } from '@/hooks/useGoogleDriveFolder';
import { cn } from '@/lib/utils';

interface GoogleDriveFolderSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GoogleDriveFolder {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
  shared: boolean;
  owners?: Array<{ displayName: string; emailAddress: string }>;
}

export function GoogleDriveFolderSelector({ open, onOpenChange }: GoogleDriveFolderSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<GoogleDriveFolder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { listFolders, updateFolder, isUpdating, companyFolder } = useGoogleDriveFolder();

  useEffect(() => {
    if (open) {
      loadFolders();
    }
  }, [open]);

  const loadFolders = async (query = '') => {
    setIsLoading(true);
    try {
      const folderList = await listFolders(query);
      setFolders(folderList);
    } catch (error) {
      console.error('Error loading folders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load Google Drive folders. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    loadFolders(searchQuery);
  };

  const handleSave = () => {
    if (!selectedFolder) {
      toast({
        title: 'No folder selected',
        description: 'Please select a folder to continue.',
        variant: 'destructive',
      });
      return;
    }

    updateFolder(
      { folderId: selectedFolder.id, folderName: selectedFolder.name },
      {
        onSuccess: () => {
          toast({
            title: 'Folder linked successfully',
            description: `${selectedFolder.name} is now linked to your company.`,
          });
          onOpenChange(false);
        },
        onError: (error) => {
          console.error('Error updating folder:', error);
          toast({
            title: 'Error',
            description: 'Failed to link folder. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-white">
        <DialogHeader>
          <DialogTitle>Select Google Drive Folder</DialogTitle>
          <DialogDescription>
            Choose a folder from your Google Drive to link with your company. All team members will be able to view
            files from this folder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Selection */}
          {companyFolder?.folderName && (
            <div className="p-3 bg-white rounded-lg">
              <p className="text-sm text-muted-foreground">Current folder:</p>
              <p className="font-medium">{companyFolder.folderName}</p>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {/* Folders List */}
          <ScrollArea className="h-[400px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <Folder className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No folders found matching your search.' : 'No folders available.'}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-colors hover:bg-accent',
                      selectedFolder?.id === folder.id && 'bg-gray-100 border-primary'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Folder className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{folder.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-muted-foreground">
                              Modified {formatDate(folder.modifiedTime)}
                            </p>
                            {folder.shared && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                Shared
                              </span>
                            )}
                          </div>
                          {folder.owners && folder.owners.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Owner: {folder.owners[0].displayName}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedFolder?.id === folder.id && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedFolder || isUpdating}>
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Selection'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}














