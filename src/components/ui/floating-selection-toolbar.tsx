import { createPortal } from 'react-dom';
import { Pin, MessageSquare, Copy, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface FloatingSelectionToolbarProps {
  selectedText: string;
  rect: DOMRect | null;
  onPin: (text: string) => void;
  onAskFollowup: (text: string) => void;
  onEdit: (text: string) => void;
  onClose: () => void;
}

export function FloatingSelectionToolbar({
  selectedText,
  rect,
  onPin,
  onAskFollowup,
  onEdit,
  onClose,
}: FloatingSelectionToolbarProps) {
  const { toast } = useToast();

  if (!selectedText || !rect) {
    return null;
  }

  // Position the toolbar above the selection
  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top - 60}px`,
    transform: 'translateX(-50%)',
    zIndex: 9999,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedText);
      toast({
        title: 'Copied to clipboard',
        description: 'Text has been copied',
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy text',
        variant: 'destructive',
      });
    }
  };

  return createPortal(
    <div
      style={style}
      className="flex items-center gap-1 bg-white border-2 border-primary rounded-lg shadow-2xl p-1"
      onMouseDown={(e) => {
        // Prevent losing the current text selection while interacting with the toolbar
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          onPin(selectedText);
          onClose();
        }}
        title="Pin to board"
        className="h-8 px-2"
      >
        <Pin className="h-4 w-4 mr-1" />
        Pin
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          onAskFollowup(selectedText);
          onClose();
        }}
        title="Ask follow-up about selection"
        className="h-8 px-2"
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        Ask
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={handleCopy}
        title="Copy with formatting"
        className="h-8 px-2"
      >
        <Copy className="h-4 w-4 mr-1" />
        Copy
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          onEdit(selectedText);
          onClose();
        }}
        title="Edit in artifact"
        className="h-8 px-2"
      >
        <Edit className="h-4 w-4 mr-1" />
        Edit
      </Button>
    </div>,
    document.body
  );
}
