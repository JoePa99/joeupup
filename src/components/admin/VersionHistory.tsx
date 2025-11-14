import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  FileText, 
  Eye,
  RotateCcw,
  GitBranch
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type PlaybookSection = Database['public']['Tables']['playbook_sections']['Row'];

interface VersionHistoryProps {
  section: PlaybookSection;
  onBack: () => void;
  onRestore?: (version: VersionEntry) => void;
}

interface VersionEntry {
  id: string;
  version: number;
  title: string;
  content: string | null;
  status: string;
  tags: string[] | null;
  progress_percentage: number | null;
  changed_by: string | null;
  changed_at: string;
  change_summary?: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

export function VersionHistory({ section, onBack, onRestore }: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<VersionEntry | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // Fetch version history - for now we'll simulate this since we don't have a versions table
  // In a real implementation, you'd want to create a playbook_section_versions table
  const { data: versions, isLoading } = useQuery({
    queryKey: ['version-history', section.id],
    queryFn: async (): Promise<VersionEntry[]> => {
      // This would be replaced with actual version history query
      // For now, we'll create mock versions based on the current section
      const mockVersions: VersionEntry[] = [
        {
          id: `${section.id}-v3`,
          version: 3,
          title: section.title,
          content: section.content,
          status: section.status,
          tags: section.tags,
          progress_percentage: section.progress_percentage,
          changed_by: section.last_updated_by,
          changed_at: section.updated_at,
          change_summary: 'Updated content and progress',
          profiles: {
            first_name: 'Current',
            last_name: 'User',
            email: 'current@example.com'
          }
        },
        {
          id: `${section.id}-v2`,
          version: 2,
          title: section.title,
          content: section.content ? section.content.substring(0, section.content.length - 50) : null,
          status: section.status === 'complete' ? 'in_progress' : section.status,
          tags: section.tags,
          progress_percentage: Math.max(0, (section.progress_percentage || 0) - 25),
          changed_by: section.last_updated_by,
          changed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          change_summary: 'Updated status and progress tracking',
          profiles: {
            first_name: 'Previous',
            last_name: 'Editor',
            email: 'editor@example.com'
          }
        },
        {
          id: `${section.id}-v1`,
          version: 1,
          title: section.title,
          content: 'Initial draft content for this section.',
          status: 'draft',
          tags: section.tags?.slice(0, 1) || [],
          progress_percentage: 0,
          changed_by: section.last_updated_by,
          changed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          change_summary: 'Initial section creation',
          profiles: {
            first_name: 'Section',
            last_name: 'Creator',
            email: 'creator@example.com'
          }
        }
      ];

      return mockVersions;
    }
  });

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'complete': return 'default';
      case 'in_progress': return 'secondary';
      default: return 'outline';
    }
  };

  const getUserName = (profiles: VersionEntry['profiles']) => {
    if (profiles?.first_name && profiles?.last_name) {
      return `${profiles.first_name} ${profiles.last_name}`;
    }
    return profiles?.email || 'Unknown User';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-4 w-1/4"></div>
            <div className="h-4 bg-muted rounded mb-8 w-1/2"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedVersion && showDiff) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setShowDiff(false)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Versions
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Version Comparison
                </h1>
                <p className="text-text-secondary">
                  Comparing version {selectedVersion.version} with current
                </p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Version {selectedVersion.version}</h3>
                <Badge variant="outline">Historical</Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Title</Label>
                  <p className="text-foreground">{selectedVersion.title}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Content</Label>
                  <div className="prose prose-sm max-w-none">
                    {selectedVersion.content || 'No content'}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant={getStatusBadgeVariant(selectedVersion.status)}>
                      {selectedVersion.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Progress</Label>
                    <span className="text-sm">{selectedVersion.progress_percentage || 0}%</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="h-5 w-5 text-green-500" />
                <h3 className="text-lg font-semibold">Current Version</h3>
                <Badge variant="default">Latest</Badge>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Title</Label>
                  <p className="text-foreground">{section.title}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Content</Label>
                  <div className="prose prose-sm max-w-none">
                    {section.content || 'No content'}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge variant={getStatusBadgeVariant(section.status)}>
                      {section.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Progress</Label>
                    <span className="text-sm">{section.progress_percentage || 0}%</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Playbook
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Version History
              </h1>
              <p className="text-text-secondary">
                {section.title}
              </p>
            </div>
          </div>
        </div>

        {/* Version Timeline */}
        <div className="space-y-4">
          {versions?.map((version, index) => (
            <Card key={version.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">v{version.version}</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        Version {version.version}
                      </h3>
                      {index === 0 && (
                        <Badge variant="default">Current</Badge>
                      )}
                      <Badge variant={getStatusBadgeVariant(version.status)}>
                        {version.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-text-secondary mb-3">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {getUserName(version.profiles)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDate(version.changed_at)}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        Progress: {version.progress_percentage || 0}%
                      </div>
                    </div>
                    
                    {version.change_summary && (
                      <p className="text-text-secondary mb-4">{version.change_summary}</p>
                    )}
                    
                    {version.tags && version.tags.length > 0 && (
                      <div className="flex gap-1 mb-4">
                        {version.tags.map((tag, tagIndex) => (
                          <Badge key={tagIndex} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedVersion(version);
                      setShowDiff(true);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Compare
                  </Button>
                  {index > 0 && onRestore && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRestore(version)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {(!versions || versions.length === 0) && (
          <Card className="p-12 text-center">
            <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Version History
            </h3>
            <p className="text-text-secondary">
              This section doesn't have any version history yet.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
