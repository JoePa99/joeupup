import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "./message";
import { ArrowRight } from "lucide-react";
interface FileAttachment {
  name: string;
  path: string;
  size: number;
  type: string;
}
interface MessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  attachments?: FileAttachment[];
  agent_id?: string;
  is_generating?: boolean;
  generation_progress?: number;
  rich_content?: {
    title: string;
    content: string;
    outline?: string[];
  };
  content_title?: string;
  mention_type?: 'direct_mention' | 'direct_conversation' | 'chain_mention' | null;
  tool_results?: {
    success: boolean;
    tool_id: string;
    results: any;
    summary: string;
    metadata: {
      execution_time: number;
      api_calls: number;
      content_type?: string;
    };
  };
  content_type?: 'text' | 'image_generation' | 'web_research' | 'document_analysis' | 'mixed';
  content_metadata?: {
    error?: boolean;
    error_message?: string;
    can_retry?: boolean;
    attachment_path?: string;
    attachment_name?: string;
    attachment_type?: string;
  };
  conversation_id?: string;
  chain_index?: number;
  parent_message_id?: string;
}
interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  nickname: string | null;
  avatar_url: string | null;
  status: string;
}
interface MessageListProps {
  messages: MessageData[];
  isLoading: boolean;
  agent?: Agent | null;
  channelAgents?: Agent[];
  user?: {
    user_metadata?: {
      full_name?: string;
    };
    email?: string;
  } | null;
  onFilePreview?: (file: FileAttachment) => void;
  onRichTextExpand?: (title: string, content: string, messageId: string) => void;
  isChannelManagementOpen?: boolean;
  isRichTextSidebarOpen?: boolean;
  isDocumentSidebarOpen?: boolean;
}
export function MessageList({
  messages,
  isLoading,
  agent,
  channelAgents = [],
  user,
  onFilePreview,
  onRichTextExpand,
  isChannelManagementOpen = false,
  isRichTextSidebarOpen = false,
  isDocumentSidebarOpen = false
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const getSenderInfo = (message: MessageData) => {
    if (message.role === 'user') {
      return {
        name: user?.user_metadata?.full_name || user?.email || 'You',
        handle: user?.email?.split('@')[0] || 'user',
        isUser: true
      };
    } else {
      // For assistant messages, check if it has an agent_id
      if (message.agent_id && channelAgents.length > 0) {
        const messageAgent = channelAgents.find(a => a.id === message.agent_id);
        if (messageAgent) {
          return {
            name: messageAgent.name,
            handle: messageAgent.nickname || messageAgent.name.toLowerCase().replace(/\s+/g, '-'),
            isUser: false
          };
        }
      }

      // Fallback to agent context or generic assistant
      if (agent) {
        return {
          name: agent.name,
          handle: agent.nickname || agent.name.toLowerCase().replace(/\s+/g, '-'),
          isUser: false
        };
      }
      return {
        name: 'Assistant',
        handle: 'assistant',
        isUser: false
      };
    }
  };
  return <ScrollArea 
    className="max-h-[calc(100vh-300px)] h-full w-full min-w-0 px-2 sm:px-4 py-2 overflow-x-hidden break-words z-0"
  >
      <div className="space-y-6 pb-4 h-full w-full max-w-full min-w-0 overflow-x-hidden break-words">
        {messages.map(message => {
        const senderInfo = getSenderInfo(message);
        const containerClasses = 'w-full max-w-full min-w-0 overflow-x-hidden';
        
        return <div key={message.id} className={containerClasses}>
              {/* Show chain indicator for chained responses */}
              {message.chain_index !== null && message.chain_index !== undefined && message.chain_index > 0 && (
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1 ml-1">
                  <ArrowRight className="h-3 w-3" />
                  <span>Chained response #{message.chain_index + 1}</span>
                </div>
              )}
              <Message 
                id={message.id} 
                role={message.role} 
                content={message.content} 
                created_at={message.created_at} 
                attachments={message.attachments} 
                senderInfo={senderInfo} 
                onFilePreview={onFilePreview} 
                is_generating={message.is_generating} 
                generation_progress={message.generation_progress} 
                rich_content={message.rich_content} 
                content_title={message.content_title} 
                onRichTextExpand={onRichTextExpand} 
                channelAgents={channelAgents} 
                mention_type={message.mention_type} 
                tool_results={message.tool_results} 
                content_type={message.content_type} 
                isChannelManagementOpen={isChannelManagementOpen} 
                isRichTextSidebarOpen={isRichTextSidebarOpen} 
                isDocumentSidebarOpen={isDocumentSidebarOpen}
                content_metadata={message.content_metadata}
                conversation_id={message.conversation_id}
                agent_id={message.agent_id}
              />
            </div>;
      })}
        
        {isLoading && <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <span className="font-semibold text-foreground">
                {agent ? agent.name : 'Assistant'}
              </span>
              <span className="text-muted-foreground">
                @{agent ? agent.nickname || agent.name.toLowerCase().replace(/\s+/g, '-') : 'assistant'}
              </span>
              <span className="text-muted-foreground">{formatTimestamp(new Date().toISOString())}</span>
            </div>
            <div className="bg-white rounded-[6px] p-4">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{
              animationDelay: '0.1s'
            }}></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{
              animationDelay: '0.2s'
            }}></div>
              </div>
            </div>
          </div>}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>;
}