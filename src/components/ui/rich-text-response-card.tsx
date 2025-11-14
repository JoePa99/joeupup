import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Maximize2, FileText } from "lucide-react";
import { mdToHtml } from "@/lib/markdown";

interface RichTextResponseCardProps {
  title: string;
  content: string;
  version?: number;
  onExpand?: () => void;
  className?: string;
  isChannelManagementOpen?: boolean;
  isRichTextSidebarOpen?: boolean;
  isDocumentSidebarOpen?: boolean;
}

export function RichTextResponseCard({ 
  title, 
  content, 
  version = 1, 
  onExpand,
  className = "",
  isChannelManagementOpen = false,
  isRichTextSidebarOpen = false,
  isDocumentSidebarOpen = false
}: RichTextResponseCardProps) {
  // Convert markdown to HTML
  const htmlContent = mdToHtml(content);
  
  // Helper function to truncate HTML content safely
  const truncateHtmlContent = (htmlContent: string, maxLength: number) => {
    // Create a temporary element to extract text content for length calculation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    if (textContent.length <= maxLength) {
      return htmlContent;
    }
    
    // If content is too long, truncate the text and add ellipsis
    const truncatedText = textContent.substring(0, maxLength) + '...';
    return truncatedText;
  };

  const shouldTruncate = htmlContent.length > 200;
  const displayContent = shouldTruncate ? truncateHtmlContent(htmlContent, 200) : htmlContent;

  // Calculate responsive width based on sidebar state
  const getResponsiveMaxWidth = () => {
    const channelSidebarWidth = isChannelManagementOpen ? 384 : 0; // w-96 = 384px
    const richTextSidebarWidth = isRichTextSidebarOpen ? 512 : 0; // w-96 = 384px
    const documentSidebarWidth = isDocumentSidebarOpen ? 384 : 0; // w-96 = 384px
    const baseOffset = 100; // Base margin/padding
    const totalOffset = baseOffset + channelSidebarWidth + richTextSidebarWidth + documentSidebarWidth;
    const calculatedWidth = `calc(80vw - ${totalOffset}px)`;
    // Ensure it doesn't exceed 100vw and has a minimum
    return `min(${calculatedWidth}, calc(100vw - 32px))`;
  };

  return (
    <div 
      className={`bg-white border border-border rounded-[6px] p-4 shadow-sm w-full min-w-0 overflow-x-hidden ${className}`}
      style={{ maxWidth: getResponsiveMaxWidth() }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm text-foreground">{title}</h4>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="text-xs">
            Version {version}
          </Badge>
          {onExpand && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onExpand}
              className="h-6 w-6 p-0"
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      <div 
        className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none min-w-0 break-words prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-em:text-muted-foreground prose-ul:text-muted-foreground prose-ol:text-muted-foreground prose-li:text-muted-foreground prose-a:text-primary hover:prose-a:text-primary/80"
        dangerouslySetInnerHTML={{ 
          __html: shouldTruncate ? displayContent : htmlContent 
        }}
      />

      {shouldTruncate && (
        <div className="mt-3 pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onExpand}
            className="w-full"
          >
            View Full Response
          </Button>
        </div>
      )}
    </div>
  );
}