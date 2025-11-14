import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Save, Download, Copy, Edit3, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mdToHtml } from "@/lib/markdown";

interface RichTextEditorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  messageId: string;
  version?: number;
  onSave?: (title: string, content: string) => Promise<void>;
}

export function RichTextEditorSidebar({ 
  isOpen, 
  onClose, 
  title: initialTitle, 
  content: initialContent, 
  messageId,
  version = 1,
  onSave 
}: RichTextEditorSidebarProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  
  // Sample rich text content for testing
  const sampleContent = `<h1>Digital Marketing Strategy Report</h1>
<p>This comprehensive report outlines key strategies for improving your digital presence and customer engagement.</p>

<h2>Executive Summary</h2>
<p>Our analysis reveals significant opportunities for growth through <strong>strategic content marketing</strong> and <em>targeted social media campaigns</em>.</p>

<h3>Key Findings</h3>
<ul>
<li>Website traffic increased by <strong>45%</strong> over the last quarter</li>
<li>Social media engagement improved by <strong>32%</strong></li>
<li>Email marketing open rates reached <strong>28%</strong></li>
</ul>

<h2>Recommended Actions</h2>
<ol>
<li><strong>Content Strategy:</strong> Develop weekly blog posts focusing on industry insights</li>
<li><strong>SEO Optimization:</strong> Target long-tail keywords for better ranking</li>
<li><strong>Social Media:</strong> Increase posting frequency to 3x per week</li>
</ol>

<blockquote>
<p>"Success in digital marketing comes from consistent value delivery and authentic engagement with your audience."</p>
</blockquote>

<h3>Next Steps</h3>
<p>We recommend implementing these strategies over the next <code>90 days</code> with regular performance reviews.</p>

<p>For more information, visit our <a href="https://example.com">strategy guide</a>.</p>`;

  const [editedTitle, setEditedTitle] = useState(initialTitle || "Sample Rich Text Document");
  const [editedContent, setEditedContent] = useState(mdToHtml(initialContent || sampleContent));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedTitle(initialTitle || "Sample Rich Text Document");
    setEditedContent(mdToHtml(initialContent || sampleContent));
  }, [initialTitle, initialContent]);

  const handleSave = async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      await onSave(editedTitle, editedContent);
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedContent);
      toast({
        title: "Copied",
        description: "Content copied to clipboard",
      });
    } catch (error) {
      console.error('Error copying:', error);
      toast({
        title: "Error",
        description: "Failed to copy content",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([`# ${editedTitle}\n\n${editedContent}`], {
      type: "text/plain"
    });
    element.href = URL.createObjectURL(file);
    element.download = `${editedTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[32rem] sm:max-w-[32rem] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <SheetTitle className="font-semibold text-foreground">Rich Text Response</SheetTitle>
              <Badge variant="secondary" className="text-xs">
                v{version}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant={isEditing ? "outline" : "default"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </>
              ) : (
                <>
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-white">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Title
                </label>
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="Enter title..."
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Content
                </label>
                <RichTextEditor
                  content={editedContent}
                  onChange={setEditedContent}
                  placeholder="Enter content..."
                  className="w-full"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1"
                >
                  <Save className="h-3 w-3 mr-1" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditedTitle(initialTitle);
                    setEditedContent(mdToHtml(initialContent || sampleContent));
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground text-lg mb-3">
                  {editedTitle}
                </h4>
              </div>
              
              <div className="prose prose-sm max-w-none">
                <div 
                  className="text-sm text-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: editedContent }}
                />
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}