import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RichTextEditor, htmlToMarkdown } from '../playbook/rich-text-editor';
import { mdToHtml } from '@/lib/markdown';
import { Loader2, Save } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type DocumentType = Database['public']['Enums']['document_type'];

interface Document {
  id: string;
  name: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  created_at?: string;
  uploaded_by?: string;
  doc_type: DocumentType;
  description: string | null;
  tags?: string[] | null;
  storage_path?: string;
  is_editable?: boolean;
  playbook_section_id?: string | null;
}

interface EditDocumentModalProps {
  document: Document | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentUpdated?: () => void;
}

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: 'policy', label: 'Policy' },
  { value: 'manual', label: 'Manual' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
  { value: 'template', label: 'Template' },
  { value: 'sop', label: 'SOP' }
];

export function EditDocumentModal({ document, open, onOpenChange, onDocumentUpdated }: EditDocumentModalProps) {
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    doc_type: DocumentType;
    content: string;
  }>({
    name: '',
    description: '',
    doc_type: 'other',
    content: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [playbookSection, setPlaybookSection] = useState<any>(null);
  const { toast } = useToast();

  const isTextDocument = document?.file_type?.includes('text') || document?.file_type?.includes('markdown');

  useEffect(() => {
    if (document) {
      setFormData({
        name: document.name,
        description: document.description || '',
        doc_type: document.doc_type,
        content: ''
      });

      // Load content for text/markdown files from database
      if (isTextDocument) {
        loadInlineContent(document.id);
      }

      // Load playbook section if linked
      if (document.playbook_section_id) {
        loadPlaybookSection(document.playbook_section_id);
      } else {
        setPlaybookSection(null);
      }
    }
  }, [document]);

  const loadPlaybookSection = async (sectionId: string) => {
    try {
      const { data, error } = await supabase
        .from('playbook_sections')
        .select('id, title, tags, status')
        .eq('id', sectionId)
        .single();

      if (error) throw error;
      setPlaybookSection(data);
    } catch (error) {
      console.error('Error loading playbook section:', error);
    }
  };

  const loadInlineContent = async (documentArchiveId: string) => {
    setLoadingContent(true);
    try {
      // Query the documents table for inline content chunks
      const { data, error } = await supabase
        .from('documents')
        .select('content')
        .eq('document_archive_id', documentArchiveId)
        .order('id', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Concatenate all content chunks
        const markdownContent = data.map(d => d.content).join('\n\n');
        // Convert markdown to HTML for the rich text editor
        const htmlContent = mdToHtml(markdownContent);
        setFormData(prev => ({ ...prev, content: htmlContent }));
      } else {
        // No inline content found
        toast({
          title: "No content found",
          description: "This document has no editable content in the database",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading inline content:', error);
      toast({
        title: "Error loading content",
        description: "Failed to load document content for editing",
        variant: "destructive",
      });
    } finally {
      setLoadingContent(false);
    }
  };

  const handleSave = async () => {
    if (!document) return;

    setLoading(true);
    try {
      // Update metadata
      const { error: metadataError } = await supabase
        .from('document_archives')
        .update({
          name: formData.name,
          description: formData.description || null,
          doc_type: formData.doc_type
        })
        .eq('id', document.id);

      if (metadataError) throw metadataError;

      // Update content if it's a text/markdown file
      if (document.storage_path && isTextDocument && formData.content) {
        // Convert HTML to markdown before saving
        const markdownContent = htmlToMarkdown(formData.content);
        const blob = new Blob([markdownContent], { type: document.file_type || 'text/plain' });
        
        const { error: storageError } = await supabase.storage
          .from('documents')
          .update(document.storage_path, blob, {
            contentType: document.file_type || 'text/plain',
            upsert: true
          });

        if (storageError) throw storageError;
      }

      toast({
        title: "Document updated",
        description: "Document has been updated successfully",
      });

      if (onDocumentUpdated) {
        onDocumentUpdated();
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: "Update failed",
        description: "Failed to update document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label htmlFor="name">Document Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter document name"
            />
          </div>

          {playbookSection && (
            <div className="space-y-2">
              <Label>Linked Playbook Section</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{playbookSection.title}</Badge>
                <span className="text-sm text-muted-foreground capitalize">
                  Status: {playbookSection.status}
                </span>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="doc_type">Document Type</Label>
            <Select 
              value={formData.doc_type} 
              onValueChange={(value: DocumentType) => setFormData(prev => ({ ...prev, doc_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter document description (optional)"
            />
          </div>

          {isTextDocument && (
            <div className="space-y-2">
              <Label>Content</Label>
              {loadingContent ? (
                <div className="flex items-center justify-center p-8 border rounded-md">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading content...</span>
                </div>
              ) : (
                <RichTextEditor
                  content={formData.content}
                  onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                  placeholder="Edit your document content..."
                  className="min-h-[300px]"
                />
              )}
            </div>
          )}

          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium">File Information</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">File Name:</div>
              <div>{document?.file_name}</div>
              <div className="text-muted-foreground">File Type:</div>
              <div>{document?.file_type}</div>
              {document?.file_size && (
                <>
                  <div className="text-muted-foreground">File Size:</div>
                  <div>{(document.file_size / 1024 / 1024).toFixed(2)} MB</div>
                </>
              )}
              {document?.created_at && (
                <>
                  <div className="text-muted-foreground">Created:</div>
                  <div>{new Date(document.created_at).toLocaleDateString()}</div>
                </>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading || loadingContent}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || loadingContent}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}