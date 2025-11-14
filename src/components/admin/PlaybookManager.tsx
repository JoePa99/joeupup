import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/playbook/rich-text-editor';
import { CreatePlaybookDocumentModal } from '@/components/playbook/CreatePlaybookDocumentModal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ArrowLeft, 
  Plus, 
  Edit3, 
  Save, 
  History, 
  Upload, 
  FileText,
  Tag,
  Target,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { usePlaybookSections, useUpdatePlaybookSection, useCreatePlaybookSection, useIsPlatformAdmin, CompanyWithDetails, PlaybookSectionWithCompany } from '@/hooks/useAdminData';
import { supabase } from '@/integrations/supabase/client';
import { FileUploadManager } from './FileUploadManager';
import { VersionHistory } from './VersionHistory';
import { createPlaybookVersion, logPlaybookActivity } from '@/lib/playbook';
import { useAuth } from '@/contexts/AuthContext';
// import type { Database } from '@/integrations/supabase/types';

type PlaybookSection = PlaybookSectionWithCompany; // Database['public']['Tables']['playbook_sections']['Row'];
type PlaybookStatus = 'draft' | 'in_progress' | 'complete';

interface PlaybookManagerProps {
  onBack: () => void;
  companyId?: string;
}

const PLAYBOOK_SECTION_TEMPLATES = [
  {
    title: 'Mission & Vision',
    description: 'Company mission statement, vision, and core values',
    tags: ['sales', 'support', 'hr'],
    order: 1
  },
  {
    title: 'Value Proposition',
    description: 'What makes your company unique and valuable to customers',
    tags: ['sales', 'marketing'],
    order: 2
  },
  {
    title: 'Customer Segments',
    description: 'Target customer profiles and market segments',
    tags: ['sales', 'marketing', 'support'],
    order: 3
  },
  {
    title: 'SWOT Analysis',
    description: 'Strengths, Weaknesses, Opportunities, and Threats',
    tags: ['operations', 'sales'],
    order: 4
  },
  {
    title: 'Standard Operating Procedures',
    description: 'Step-by-step operational procedures and workflows',
    tags: ['operations', 'support'],
    order: 5
  },
  {
    title: 'Team Roles & Responsibilities',
    description: 'Organizational structure and role definitions',
    tags: ['hr', 'operations'],
    order: 6
  },
  {
    title: 'Tools & Integrations',
    description: 'Software tools, platforms, and system integrations',
    tags: ['operations', 'support'],
    order: 7
  },
  {
    title: 'Compliance & Legal',
    description: 'Legal requirements, compliance standards, and policies',
    tags: ['operations', 'hr'],
    order: 8
  }
];

export function PlaybookManager({ onBack, companyId: propCompanyId }: PlaybookManagerProps) {
  const { user } = useAuth();
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const [companyId, setCompanyId] = useState<string | null>(propCompanyId ?? null);
  const [sectionDocuments, setSectionDocuments] = useState<Record<string, any[]>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  // Always fetch user's own company ID, even for platform admins
  useEffect(() => {
    if (propCompanyId) return; // Skip if company ID provided as prop
    
    if (user?.id) {
      const fetchCompanyId = async () => {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

          if (error) {
            console.error('Error fetching company ID:', error);
          } else {
            setCompanyId(profile?.company_id || null);
          }
        } catch (error) {
          console.error('Error fetching company ID:', error);
        }
      };

      fetchCompanyId();
    }
  }, [user?.id, propCompanyId]);

  const { data: sections, isLoading, refetch } = usePlaybookSections(companyId);
  const updateSection = useUpdatePlaybookSection();
  const createSection = useCreatePlaybookSection();
  
  const [editingSection, setEditingSection] = useState<PlaybookSection | null>(null);
  const [showNewSection, setShowNewSection] = useState(false);
  const [showFileManager, setShowFileManager] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState<PlaybookSection | null>(null);
  const [showCreateDocumentModal, setShowCreateDocumentModal] = useState(false);
  const [newSectionData, setNewSectionData] = useState({
    title: '',
    content: '',
    tags: [] as string[],
    status: 'draft' as PlaybookStatus
  });

  // Fetch documents for all sections
  useEffect(() => {
    if (sections && sections.length > 0) {
      fetchAllSectionDocuments();
    }
  }, [sections]);

  const fetchAllSectionDocuments = async () => {
    if (!sections) return;

    const documentsMap: Record<string, any[]> = {};
    
    for (const section of sections) {
      try {
        const { data, error } = await supabase
          .from('document_archives')
          .select('id, name, file_name, file_type, created_at, doc_type')
          .eq('playbook_section_id', section.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        documentsMap[section.id] = data || [];
      } catch (error) {
        console.error(`Error fetching documents for section ${section.id}:`, error);
        documentsMap[section.id] = [];
      }
    }

    setSectionDocuments(documentsMap);
  };

  const toggleSectionExpanded = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleCreateSection = async (template?: typeof PLAYBOOK_SECTION_TEMPLATES[0]) => {
    if (!companyId) return;

    const sectionData = template || newSectionData;
    
    let title: string;
    let content: string;
    let tags: string[];
    let status: PlaybookStatus;
    
    if (template) {
      title = template.title;
      content = template.description;
      tags = template.tags;
      status = 'draft';
    } else {
      title = newSectionData.title;
      content = newSectionData.content;
      tags = newSectionData.tags;
      status = newSectionData.status;
    }
    
    if (!title.trim()) return;

    try {
      const newSection = await createSection.mutateAsync({
        company_id: companyId,
        title: title,
        content: content || '',
        tags: Array.isArray(tags) ? tags : [],
        status: status,
        section_order: (template ? template.order : 0) || (sections?.length || 0) + 1
      });

      // Log activity for new section
      if (newSection) {
        await logPlaybookActivity(newSection.id, 'created', companyId);
      }

      if (template) {
        // Template was used, just refresh
        refetch();
      } else {
        // Reset form
        setNewSectionData({
          title: '',
          content: '',
          tags: [],
          status: 'draft'
        });
        setShowNewSection(false);
      }
    } catch (error) {
      console.error('Failed to create section:', error);
    }
  };

  const handleUpdateSection = async (sectionId: string, updates: Partial<PlaybookSection>) => {
    try {
      // Get current section content for versioning
      const currentSection = sections?.find(s => s.id === sectionId);
      
      await updateSection.mutateAsync({ id: sectionId, updates });
      
      // Create version if content changed
      if (updates.content && currentSection && updates.content !== currentSection.content) {
        await createPlaybookVersion(sectionId, updates.content, 'Content updated');
      }
      
      // Log activity
      if (companyId) {
        await logPlaybookActivity(sectionId, 'updated', companyId);
      }
      
      setEditingSection(null);
      refetch();
    } catch (error) {
      console.error('Failed to update section:', error);
    }
  };

  const handleFileUpload = async (file: File, sectionId?: string) => {
    // TODO: Implement file upload to Supabase storage
    console.log('File upload not implemented yet:', file.name);
  };

  const getStatusIcon = (status: PlaybookStatus) => {
    switch (status) {
      case 'complete': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadgeVariant = (status: PlaybookStatus) => {
    switch (status) {
      case 'complete': return 'default';
      case 'in_progress': return 'secondary';
      default: return 'outline';
    }
  };

  // Sections are now auto-created, no need for recommendations
  const getMissingTemplates = () => {
    return [];
    
    const existingTitles = sections.map(s => s.title.toLowerCase());
    return PLAYBOOK_SECTION_TEMPLATES.filter(
      template => !existingTitles.includes(template.title.toLowerCase())
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded mb-4 w-1/4"></div>
            <div className="h-4 bg-muted rounded mb-8 w-1/2"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showVersionHistory) {
    return (
      <VersionHistory
        section={showVersionHistory}
        onBack={() => setShowVersionHistory(null)}
        onRestore={async (version) => {
          try {
            await updateSection.mutateAsync({
              id: showVersionHistory.id,
              updates: {
                content: version.content,
                status: version.status as PlaybookStatus,
                progress_percentage: version.progress_percentage,
                tags: version.tags
              }
            });
            setShowVersionHistory(null);
            refetch();
          } catch (error) {
            console.error('Failed to restore version:', error);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button 
          variant="outline"
          onClick={() => setShowCreateDocumentModal(true)}
          size="sm"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Create Document
        </Button>
        <Button 
          onClick={() => setShowNewSection(true)}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Section
        </Button>
      </div>

      {/* Missing Templates Suggestions */}
      {getMissingTemplates().length > 0 && (
          <Card className="p-6 mb-6 border border-gray-200 shadow-none">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Recommended Sections</h3>
            </div>
            <p className="text-text-secondary mb-4">
              Add these essential playbook sections to improve completeness:
            </p>
            <div className="flex flex-wrap gap-2">
              {getMissingTemplates().map((template, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateSection(template)}
                  className="h-auto p-3"
                >
                  <div className="text-left">
                    <div className="font-medium">{template.title}</div>
                    <div className="text-xs text-text-secondary mt-1">
                      For: {template.tags.join(', ')}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </Card>
        )}

      {/* Playbook Sections */}
      <div className="grid gap-6">
          {sections?.map((section) => (
            <Card key={section.id} className="p-6 border border-gray-200 shadow-none">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(section.status)}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {section.title}
                    </h3>
                    {!companyId && section.company && (
                      <p className="text-sm text-blue-600 mb-1">
                        {section.company.name}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getStatusBadgeVariant(section.status)}>
                        {section.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-text-secondary">
                        Progress: {section.progress_percentage || 0}%
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection(section)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowFileManager(section.id)}
                    title="Upload Documents"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Section Content */}
              {editingSection?.id === section.id ? (
                <EditSectionForm
                  section={section}
                  onSave={(updates) => handleUpdateSection(section.id, updates)}
                  onCancel={() => setEditingSection(null)}
                />
              ) : (
                <div>
                  {section.content && (
                    <div className="prose prose-sm max-w-none mb-4 text-text-secondary">
                      {section.content}
                    </div>
                  )}
                  
                  {section.tags && section.tags.length > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                      <Tag className="h-4 w-4 text-text-secondary" />
                      <div className="flex gap-1">
                        {section.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked Documents Collapsible */}
                  {sectionDocuments[section.id] && sectionDocuments[section.id].length > 0 && (
                    <Collapsible
                      open={expandedSections[section.id]}
                      onOpenChange={() => toggleSectionExpanded(section.id)}
                      className="mt-4"
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Linked Documents ({sectionDocuments[section.id].length})
                            </span>
                          </div>
                          {expandedSections[section.id] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="space-y-2 pl-6">
                          {sectionDocuments[section.id].map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{doc.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {doc.doc_type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}

              {/* File Upload Manager */}
              {showFileManager === section.id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-medium">Document Management</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowFileManager(null)}
                    >
                      Close
                    </Button>
                  </div>
                  <FileUploadManager 
                    companyId={companyId || ''}
                    sectionId={section.id}
                    onFileUploaded={(url, name) => {
                      console.log('File uploaded:', name, url);
                      // Refresh documents list to show newly uploaded files
                      fetchAllSectionDocuments();
                    }}
                  />
                </div>
              )}
            </Card>
          ))}

          {/* New Section Form */}
          {showNewSection && (
            <Card className="p-6 border border-gray-200 shadow-none">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Add New Section</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Section Title</Label>
                  <Input
                    id="title"
                    value={newSectionData.title}
                    onChange={(e) => setNewSectionData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter section title..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="content">Content</Label>
                  <RichTextEditor
                    content={newSectionData.content}
                    onChange={(content) => setNewSectionData(prev => ({ ...prev, content }))}
                    placeholder="Enter section content..."
                    className="min-h-[150px]"
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button onClick={() => handleCreateSection()}>
                    <Save className="h-4 w-4 mr-2" />
                    Create Section
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewSection(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Empty State */}
          {(!sections || sections.length === 0) && !showNewSection && (
            <Card className="p-12 text-center border border-gray-200 shadow-none">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No Playbook Sections
              </h3>
              <p className="text-text-secondary mb-6">
                Start building your knowledge base by creating playbook sections.
              </p>
              <Button onClick={() => setShowNewSection(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Section
              </Button>
            </Card>
          )}
        </div>

      {/* Create Document Modal */}
      <CreatePlaybookDocumentModal
        open={showCreateDocumentModal}
        onOpenChange={setShowCreateDocumentModal}
        onDocumentCreated={() => {
          // Could refresh documents list here if needed
          console.log('Document created successfully');
        }}
        companyId={companyId}
      />
    </div>
  );
}

// Edit Section Form Component
interface EditSectionFormProps {
  section: PlaybookSection;
  onSave: (updates: Partial<PlaybookSection>) => void;
  onCancel: () => void;
}

function EditSectionForm({ section, onSave, onCancel }: EditSectionFormProps) {
  const [formData, setFormData] = useState({
    title: section.title,
    content: section.content || '',
    status: section.status,
    progress_percentage: section.progress_percentage || 0,
    tags: section.tags || []
  });

  const handleSave = () => {
    onSave({
      title: formData.title,
      content: formData.content,
      status: formData.status,
      progress_percentage: formData.progress_percentage,
      tags: formData.tags
    });
  };

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
        />
      </div>
      
      <div>
        <Label htmlFor="edit-content">Content</Label>
        <RichTextEditor
          content={formData.content}
          onChange={(content) => setFormData(prev => ({ ...prev, content }))}
          placeholder="Write your section content here..."
          className="min-h-[200px]"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edit-status">Status</Label>
          <select
            id="edit-status"
            className="w-full px-3 py-2 border border-border rounded-md"
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              status: e.target.value as PlaybookStatus 
            }))}
          >
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
          </select>
        </div>
        
        <div>
          <Label htmlFor="edit-progress">Progress (%)</Label>
          <Input
            id="edit-progress"
            type="number"
            min="0"
            max="100"
            value={formData.progress_percentage}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              progress_percentage: parseInt(e.target.value) || 0 
            }))}
          />
        </div>
      </div>
      
      <div className="flex gap-3">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
