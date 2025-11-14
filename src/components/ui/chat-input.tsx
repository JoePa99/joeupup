import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Upload, File, X, Paperclip, Bot, FileText as FileTextIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  nickname: string | null;
  avatar_url: string | null;
  status: string;
}

interface ChatInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
  channelAgents?: Agent[];
  uploadedFiles: File[];
  onFileUpload: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
}

export function ChatInput({
  placeholder,
  value,
  onChange,
  onSend,
  isLoading,
  disabled = false,
  channelAgents = [],
  uploadedFiles,
  onFileUpload,
  onRemoveFile
}: ChatInputProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  
  // Mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  
  // Reset selected index when filtered agents change
  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [filteredAgents]);
  
  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '60px';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [value]);

  // Update mention popover position when it should be visible
  useEffect(() => {
    if (showMentions && inputRef.current) {
      const updatePosition = () => {
        const rect = inputRef.current?.getBoundingClientRect();
        if (rect) {
          const popoverWidth = 320; // w-80 = 320px on desktop, w-72 = 288px on mobile
          const viewportWidth = window.innerWidth;
          const padding = 8; // Padding from viewport edge
          
          // Calculate left position, ensuring it doesn't overflow right side
          let left = rect.left;
          if (left + popoverWidth > viewportWidth - padding) {
            left = viewportWidth - popoverWidth - padding;
          }
          
          // Ensure it doesn't overflow left side
          if (left < padding) {
            left = padding;
          }
          
          setMentionPosition({
            top: rect.top, // getBoundingClientRect gives viewport coordinates
            left: left
          });
        }
      };
      updatePosition();
      const handleScroll = () => updatePosition();
      const handleResize = () => updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      // Also update when value changes (textarea might resize)
      const timeoutId = setTimeout(updatePosition, 0);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    } else {
      setMentionPosition(null);
    }
  }, [showMentions, value]);
  
  // File upload state removed - direct upload only

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'pdf') {
      return (
        <div className="h-5 w-5 bg-orange-500 rounded-sm flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">PDF</span>
        </div>
      );
    }
    
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const getFileIconColor = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension === 'pdf' ? 'border-orange-200' : 'border-gray-200';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle keyboard navigation when mentions dropdown is visible
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < filteredAgents.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : filteredAgents.length - 1
        );
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredAgents.length > 0) {
          insertMention(filteredAgents[selectedMentionIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }
    
    // Regular Enter for sending message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const inputValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(inputValue);
    
    // Check for @ mentions in channel mode
    if (channelAgents.length > 0) {
      checkForMentions(inputValue, cursorPos);
    }
  };

  const checkForMentions = (text: string, cursorPos: number) => {
    // Find the last @ before cursor position
    const beforeCursor = text.substring(0, cursorPos);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) {
      setShowMentions(false);
      return;
    }
    
    // Check if there's a space between @ and cursor (would break the mention)
    const textAfterAt = beforeCursor.substring(lastAtIndex + 1);
    if (textAfterAt.includes(' ')) {
      setShowMentions(false);
      return;
    }
    
    setMentionStartPos(lastAtIndex);
    setMentionQuery(textAfterAt);
    setShowMentions(true);
    
    // Filter agents based on query
    const filtered = channelAgents.filter(agent => {
      const searchText = textAfterAt.toLowerCase();
      return agent.name.toLowerCase().includes(searchText) ||
             (agent.nickname && agent.nickname.toLowerCase().includes(searchText)) ||
             agent.role.toLowerCase().includes(searchText);
    });
    setFilteredAgents(filtered);
  };

  const insertMention = (agent: Agent) => {
    const mentionText = `@${agent.nickname || agent.name}`;
    const beforeMention = value.substring(0, mentionStartPos);
    const afterMention = value.substring(mentionStartPos + mentionQuery.length + 1);
    
    const newText = beforeMention + mentionText + ' ' + afterMention;
    onChange(newText);
    setShowMentions(false);
    setMentionQuery("");
    
    // Focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      onFileUpload([...uploadedFiles, ...newFiles]);
    }
    // Reset input value to allow uploading the same file again
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    onRemoveFile(index);
  };

  return (
    <div className="p-2 flex justify-center items-center bg-transparent w-full min-w-0 overflow-x-hidden relative z-30">
      {/* Main Container */}
      <div className="bg-white rounded-3xl shadow-md relative max-w-[90%] w-full min-w-0">
        {/* Input Section */}
        <div className="relative px-3 py-2">
          <Textarea
            ref={inputRef}
            placeholder={placeholder}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            className="w-full min-h-[60px] pr-10 pt-1 pb-3 text-black caret-foreground border-0 focus-visible:ring-0 resize-none bg-transparent focus:border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-300"
          />
          {/* Send Button */}
          <Button 
            onClick={onSend} 
            disabled={disabled || isLoading || (!value.trim() && uploadedFiles.length === 0)}
            className="absolute top-2 border-none right-2 h-8 w-8 p-4 bg-transparent hover:bg-gray-100 text-gray-600"
            size="sm"
          >
            <Send className="h-4 w-4" />
          </Button>
          {showMentions && mentionPosition && createPortal(
            <div 
              className="fixed w-72 sm:w-80 z-[100] max-w-[calc(100vw-16px)]"
              style={{
                top: `${mentionPosition.top - 8}px`,
                left: `${mentionPosition.left}px`,
                transform: 'translateY(-100%)'
              }}
            >
              <div className="rounded-md border bg-background text-popover-foreground shadow-md">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Available Agents
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredAgents.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No agents found.
                    </div>
                  ) : (
                    filteredAgents.map((agent, index) => (
                      <div
                        key={agent.id}
                        onClick={() => insertMention(agent)}
                        className={cn(
                          "flex items-center space-x-2 px-2 py-2 cursor-pointer transition-colors",
                          "hover:bg-accent/50",
                          index === selectedMentionIndex && "bg-accent"
                        )}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={agent.avatar_url || ''} />
                          <AvatarFallback>
                            <Bot className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            @{agent.nickname || agent.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {agent.role}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* Attachment Section */}
        {uploadedFiles.length > 0 && (
          <>
            <div className="border-t border-gray-100"></div>
            <div className="px-3 py-2 flex items-center gap-3 flex-wrap overflow-x-hidden rounded-b-2xl">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => document.getElementById('file-upload')?.click()}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-8 border-r border-gray-300"
                disabled={disabled || isLoading}
              >
                <Paperclip className="h-4 w-4 mr-1.5" />
                Attach
              </Button>
              <div className="flex items-center gap-2 flex-wrap">
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm group",
                      "bg-gradient-to-r from-blue-500 via-blue-400 to-purple-500 p-[1px]"
                    )}
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-white">
                      {getFileIcon(file.name)}
                      <div className="flex flex-col">
                        <span className="text-gray-900 truncate max-w-[120px]">{file.name}</span>
                        <span className="text-gray-500 text-xs">({formatFileSize(file.size)})</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(index)}
                        className="h-5 w-5 p-0 ml-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-600 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Show attach button when no files are uploaded */}
        {uploadedFiles.length === 0 && (
          <>
            <div className="border-t border-gray-200"></div>
            <div className="px-3 py-2 overflow-x-hidden rounded-b-2xl">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => document.getElementById('file-upload')?.click()}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-8"
                disabled={disabled || isLoading}
              >
                <Paperclip className="h-4 w-4 mr-1.5" />
                Attach
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        id="file-upload"
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        accept="*/*"
      />
    </div>
  );
}
