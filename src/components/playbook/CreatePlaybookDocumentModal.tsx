import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor, htmlToMarkdown } from './rich-text-editor';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { embedInlineDocument } from '@/lib/document-processing';
import { Loader2, Save, Plus } from 'lucide-react';

interface CreatePlaybookDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentCreated?: () => void;
  companyId?: string;
}

const PLAYBOOK_SECTION_TYPES = [
  { value: 'mission', label: 'Mission & Vision', description: 'Company purpose and future aspirations' },
  { value: 'value-proposition', label: 'Value Proposition', description: 'Unique value offered to customers' },
  { value: 'customer-segments', label: 'Customer Segments', description: 'Target customer groups and personas' },
  { value: 'swot', label: 'SWOT Analysis', description: 'Strengths, weaknesses, opportunities, threats' },
  { value: 'sops', label: 'Standard Operating Procedures', description: 'Step-by-step operational processes' },
  { value: 'team-roles', label: 'Team Roles', description: 'Organizational structure and responsibilities' },
  { value: 'tools', label: 'Tools & Integrations', description: 'Technology stack and integrations' },
  { value: 'other', label: 'Other', description: 'Custom playbook section' },
];

export function CreatePlaybookDocumentModal({ 
  open, 
  onOpenChange, 
  onDocumentCreated,
  companyId 
}: CreatePlaybookDocumentModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    sectionId: '',
    content: '',
    description: '',
  });

  // Load playbook sections
  useEffect(() => {
    if (open && companyId) {
      loadSections();
    }
  }, [open, companyId]);

  const loadSections = async () => {
    try {
      const { data, error } = await supabase
        .from('playbook_sections')
        .select('id, title, tags, status')
        .eq('company_id', companyId)
        .order('section_order', { ascending: true });

      if (error) throw error;
      setSections(data || []);
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  };

  const handleSave = async (addToKnowledgeBase = false) => {
    if (!formData.title.trim() || !formData.sectionId || !formData.content.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please fill in title, section, and content",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication required",
        description: "Please log in to create documents",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get company ID if not provided
      let finalCompanyId = companyId;
      if (!finalCompanyId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        
        if (!profile?.company_id) {
          throw new Error('Company not found');
        }
        finalCompanyId = profile.company_id;
      }

      // Get section details
      const selectedSection = sections.find(s => s.id === formData.sectionId);
      const sectionTag = selectedSection?.tags?.[0] || 'section';

      // Convert HTML content to Markdown
      const markdownContent = htmlToMarkdown(formData.content);

      if (addToKnowledgeBase) {
        // For "Save & Add to Knowledge Base": Embed directly without storage
        const result = await embedInlineDocument(
          finalCompanyId,
          user.id,
          markdownContent,
          formData.title,
          sectionTag,
          formData.description,
          formData.sectionId
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to embed document');
        }

        toast({
          title: "Success",
          description: result.message || "Document embedded and added to knowledge base",
        });
      } else {
        // For "Save Draft": Use the original storage-based approach
        // Create filename
        const timestamp = Date.now();
        const sanitizedTitle = formData.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .trim();
        const filename = `playbook-${sectionTag}-${sanitizedTitle}-${timestamp}.md`;
        
        // Upload to Supabase Storage
        const filePath = `${user.id}/playbook/${filename}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, new Blob([markdownContent], { type: 'text/markdown' }));

        if (uploadError) throw uploadError;

        // Insert into document_archives
        const { data: documentData, error: documentError } = await supabase
          .from('document_archives')
          .insert({
            name: formData.title,
            file_name: filename,
            file_type: 'text/markdown',
            file_size: markdownContent.length,
            storage_path: filePath,
            uploaded_by: user.id,
            company_id: finalCompanyId,
            doc_type: 'template',
            description: formData.description || null,
            tags: ['playbook', sectionTag],
            playbook_section_id: formData.sectionId,
            is_editable: true,
          })
          .select()
          .single();

        if (documentError) throw documentError;

        toast({
          title: "Success",
          description: "Document saved as draft",
        });
      }

      // Reset form and close modal
      setFormData({
        title: '',
        sectionId: '',
        content: '',
        description: '',
      });
      
      onOpenChange(false);
      onDocumentCreated?.();

    } catch (error) {
      console.error('Error creating playbook document:', error);
      toast({
        title: "Error",
        description: "Failed to create document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedSection = sections.find(s => s.id === formData.sectionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Playbook Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter document title..."
            />
          </div>

          {/* Section Selection */}
          <div className="space-y-2">
            <Label htmlFor="sectionId">Link to Playbook Section</Label>
            <Select value={formData.sectionId} onValueChange={(value) => setFormData(prev => ({ ...prev, sectionId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a playbook section..." />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    <div className="flex items-center gap-2">
                      <span>{section.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {section.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSection && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedSection.title}</Badge>
                <span className="text-sm text-muted-foreground">
                  Status: {selectedSection.status}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of this document..."
              rows={2}
            />
          </div>

          {/* Rich Text Editor */}
          <div className="space-y-2">
            <Label>Content</Label>
            <RichTextEditor
              content={formData.content}
              onChange={(content) => setFormData(prev => ({ ...prev, content }))}
              placeholder="Write your playbook content here..."
              className="min-h-[300px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleSave(false)} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button 
            onClick={() => handleSave(true)} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save & Add to Knowledge Base
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
