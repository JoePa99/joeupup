import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronDown, ChevronRight, Maximize2, Search, AtSign, Copy } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RichTextGenerationProgress } from "./rich-text-generation-progress";
import { RichTextResponseCard } from "./rich-text-response-card";
import { ImageGenerationCard } from "./image-generation-card";
import { WebResearchCard } from "./web-research-card";
import { DocumentAnalysisCard } from "./document-analysis-card";
import { DocumentParsingError } from "./document-parsing-error";
import { FloatingSelectionToolbar } from "./floating-selection-toolbar";
import { parseMentions } from "@/lib/notifications";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { mdToHtml } from "@/lib/markdown";
import { useTextSelection } from "@/hooks/use-text-selection";
import { useToast } from "@/hooks/use-toast";

interface FileAttachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface Agent {
  id: string;
  name: string;
  nickname: string | null;
}

interface ChannelMember {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface MessageProps {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  attachments?: FileAttachment[];
  senderInfo: {
    name: string;
    handle: string;
    isUser: boolean;
  };
  onFilePreview?: (file: FileAttachment) => void;
  is_generating?: boolean;
  generation_progress?: number;
  rich_content?: {
    title: string;
    content: string;
    outline?: string[];
  };
  content_title?: string;
  onRichTextExpand?: (title: string, content: string, messageId: string) => void;
  channelAgents?: Agent[];
  channelMembers?: ChannelMember[];
  channelId?: string;
  mention_type?: 'direct_mention' | 'direct_conversation' | null;
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
  isChannelManagementOpen?: boolean;
  isRichTextSidebarOpen?: boolean;
  isDocumentSidebarOpen?: boolean;
  content_metadata?: {
    error?: boolean;
    error_message?: string;
    can_retry?: boolean;
    attachment_path?: string;
    attachment_name?: string;
    attachment_type?: string;
    citations?: {
      id: string;
      tier: 'companyOS' | 'agentDocs' | 'playbooks' | 'keywords' | string;
      content: string;
      relevanceScore?: number;
      metadata?: Record<string, any>;
    }[];
    context_used?: boolean;
    attachment_source?: Record<string, any> | null;
    document_summary?: string;
    structured_summary?: string;
  };
  conversation_id?: string;
  agent_id?: string;
}

export function Message({ 
  id, 
  role, 
  content, 
  created_at, 
  attachments = [], 
  senderInfo,
  onFilePreview,
  is_generating = false,
  generation_progress = 0,
  rich_content,
  content_title,
  onRichTextExpand,
  channelAgents = [],
  channelMembers = [],
  channelId,
  mention_type,
  tool_results,
  content_type = 'text',
  isChannelManagementOpen = false,
  isRichTextSidebarOpen = false,
  isDocumentSidebarOpen = false,
  content_metadata,
  conversation_id,
  agent_id
}: MessageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const messageRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(messageRef);
  const [channelMembersData, setChannelMembersData] = useState<ChannelMember[]>(channelMembers);

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to get username from member data
  const getUsernameFromMember = (member: ChannelMember): string => {
    if (member.first_name && member.last_name) {
      return `${member.first_name.toLowerCase()}.${member.last_name.toLowerCase()}`;
    }
    return member.email.split('@')[0];
  };

  // Helper function to get display name from member data
  const getDisplayNameFromMember = (member: ChannelMember): string => {
    if (member.first_name && member.last_name) {
      return `${member.first_name} ${member.last_name}`;
    }
    return member.email;
  };

  const tierLabels: Record<string, string> = {
    companyOS: 'Company OS',
    agentDocs: 'Knowledge Base',
    playbooks: 'Playbooks',
    keywords: 'Keywords'
  };

  const citations = content_metadata?.citations || [];
  const contextSummary = content_metadata?.document_summary || content_metadata?.structured_summary;

  const getCitationLink = (metadata?: Record<string, any>) => {
    return metadata?.url || metadata?.link || metadata?.source_url || metadata?.path;
  };

  // Check if current user is mentioned
  const isCurrentUserMentioned = (content: string): boolean => {
    if (!user?.id || !channelMembersData.length) return false;
    
    const mentions = parseMentions(content);
    const currentUserMember = channelMembersData.find(m => m.id === user.id);
    if (!currentUserMember) return false;
    
    const currentUserUsername = getUsernameFromMember(currentUserMember);
    return mentions.some(mention => mention.username.toLowerCase() === currentUserUsername.toLowerCase());
  };

  const renderParsedContent = (content: string) => {
    // Handle null, undefined, or empty content
    if (!content || typeof content !== 'string') {
      return null;
    }

    const mentions = parseMentions(content);

    // If no mentions, process markdown and return HTML
    if (mentions.length === 0) {
      const htmlContent = mdToHtml(content);
      return (
        <div
          className="markdown-content select-text cursor-text"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    }
    
    // If we have mentions, we need to preserve JSX elements
    const parts = [];
    let lastIndex = 0;
    
    // Process each mention
    for (const mention of mentions) {
      // Add text before the mention (process as markdown)
      const beforeText = content.slice(lastIndex, mention.position);
      if (beforeText) {
        const htmlBeforeText = mdToHtml(beforeText);
        parts.push(
          <span 
            key={`text-${lastIndex}`}
            dangerouslySetInnerHTML={{ __html: htmlBeforeText }}
          />
        );
      }
      
      // Find matching agent
      const agent = channelAgents.find(a => 
        (a.nickname && a.nickname.toLowerCase() === mention.username.toLowerCase()) ||
        a.name.toLowerCase() === mention.username.toLowerCase()
      );
      
      // Find matching channel member
      const member = channelMembersData.find(m => 
        getUsernameFromMember(m).toLowerCase() === mention.username.toLowerCase()
      );
      
      if (agent) {
        // Render agent mention
        const displayName = agent.nickname || agent.name;
        parts.push(
          <span 
            key={mention.position} 
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-medium text-sm"
            title={`AI Agent: ${displayName}`}
          >
            <svg className="h-3 w-3" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.5 15.5C1.5 16.43 1.5 16.894 1.577 17.28C1.73132 18.056 2.1123 18.7688 2.67175 19.3282C3.23121 19.8877 3.94401 20.2687 4.72 20.423C5.106 20.5 5.57 20.5 6.5 20.5M20.5 15.5C20.5 16.43 20.5 16.894 20.423 17.28C20.2687 18.056 19.8877 18.7688 19.3282 19.3282C18.7688 19.8877 18.056 20.2687 17.28 20.423C16.894 20.5 16.43 20.5 15.5 20.5M20.5 6.5C20.5 5.57 20.5 5.106 20.423 4.72C20.2687 3.94401 19.8877 3.23121 19.3282 2.67175C18.7688 2.1123 18.056 1.73132 17.28 1.577C16.894 1.5 16.43 1.5 15.5 1.5M1.5 6.5C1.5 5.57 1.5 5.106 1.577 4.72C1.73132 3.94401 2.1123 3.23121 2.67175 2.67175C3.23121 2.1123 3.94401 1.73132 4.72 1.577C5.106 1.5 5.57 1.5 6.5 1.5M11 7.5V5.5M9 10.5V11M13 10.5V11M10 7.5H12C13.886 7.5 14.828 7.5 15.414 8.086C16 8.672 16 9.614 16 11.5C16 13.386 16 14.328 15.414 14.914C14.828 15.5 13.886 15.5 12 15.5H10C8.114 15.5 7.172 15.5 6.586 14.914C6 14.328 6 13.386 6 11.5C6 9.614 6 8.672 6.586 8.086C7.172 7.5 8.114 7.5 10 7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            @{displayName}
          </span>
        );
      } else if (member) {
        // Render user mention
        const displayName = getDisplayNameFromMember(member);
        const isCurrentUser = member.id === user?.id;
        
        parts.push(
          <span 
            key={mention.position} 
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-sm ${
              isCurrentUser 
                ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-300' 
                : 'bg-gray-100 text-gray-800'
            }`}
            title={isCurrentUser ? 'You were mentioned' : `User: ${displayName}`}
          >
            <Avatar className="h-3 w-3">
              <AvatarImage src={member.avatar_url || ''} />
              <AvatarFallback className="text-xs">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            @{mention.username}
          </span>
        );
      } else {
        // Unknown mention, render as plain text with styling
        parts.push(
          <span 
            key={mention.position} 
            className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-sm"
            title="Unknown user"
          >
            @{mention.username}
          </span>
        );
      }
      
      lastIndex = mention.position + mention.length;
    }
    
    // Add remaining text after the last mention (process as markdown)
    const remainingText = content.slice(lastIndex);
    if (remainingText) {
      const htmlRemainingText = mdToHtml(remainingText);
      parts.push(
        <span 
          key={`text-${lastIndex}`}
          dangerouslySetInnerHTML={{ __html: htmlRemainingText }}
        />
      );
    }
    
    return <div className="markdown-content leading-relaxed select-text cursor-text">{parts}</div>;
  };

  const currentUserMentioned = isCurrentUserMentioned(content);

  // Copy to clipboard functionality
  const handleCopyMessage = async () => {
    try {
      // Get the plain text content without HTML tags
      const textContent = content.replace(/<[^>]*>/g, '').trim();
      await navigator.clipboard.writeText(textContent);
      // You could add a toast notification here if needed
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  // Pinboard handlers
  const handlePin = async (selectedText: string) => {
    if (!user?.id) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to pin content',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get user's company_id
      const { data: companyMember } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      // Get Quick Pins collection
      const { data: collection } = await supabase
        .from('pin_collections')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', 'Quick Pins')
        .single();

      const { error } = await supabase.from('pins').insert({
        user_id: user.id,
        company_id: companyMember?.company_id,
        collection_id: collection?.id,
        message_id: id,
        conversation_id: conversation_id,
        channel_id: channelId,
        content: selectedText,
        content_type: 'text',
        metadata: {
          original_message: content.substring(0, 200),
          timestamp: created_at,
          sender: senderInfo.name,
        },
      });

      if (error) throw error;

      toast({
        title: 'Pinned!',
        description: 'Content saved to Quick Pins',
      });
    } catch (error) {
      console.error('Error pinning content:', error);
      toast({
        title: 'Pin failed',
        description: 'Failed to save pin',
        variant: 'destructive',
      });
    }
  };

  const handleAskFollowup = (selectedText: string) => {
    // This would integrate with the chat input to pre-fill a follow-up question
    // For now, we'll just show a toast
    toast({
      title: 'Follow-up',
      description: 'This feature will allow you to ask about the selected text',
    });
  };

  const handleEdit = (selectedText: string) => {
    // This would open the artifact editor with the selected text
    toast({
      title: 'Edit in artifact',
      description: 'This feature will open the artifact editor',
    });
  };

  return (
    <>
      <FloatingSelectionToolbar
        selectedText={selection.text}
        rect={selection.rect}
        onPin={handlePin}
        onAskFollowup={handleAskFollowup}
        onEdit={handleEdit}
        onClose={clearSelection}
      />
      <div
        ref={messageRef}
        className={`group space-y-2 w-full min-w-0 break-words ${
          currentUserMentioned ? 'ring-2 ring-blue-200 bg-blue-50/30 rounded-lg p-2' : ''
        }`}
      >
      {/* Message Header */}
      <div className="flex items-center space-x-2 text-sm min-w-0">
        <span className="font-semibold text-foreground">{senderInfo.name}</span>
        <span className="text-muted-foreground">@{senderInfo.handle}</span>
        {currentUserMentioned && (
          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
            <AtSign className="h-3 w-3 mr-1" />
            You were mentioned
          </Badge>
        )}
        <div className="flex items-center space-x-2 ml-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyMessage}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy message"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <span className="text-muted-foreground text-xs">
            {formatTimestamp(created_at)}
          </span>
        </div>
      </div>
      
      {/* Message Content */}
      <div className={`bg-white border-b border-border p-4 w-full min-w-0 break-words ${
        currentUserMentioned ? 'border-blue-200' : ''
      }`}>
        {/* Show generation progress for AI messages that are generating */}
        {is_generating && role === 'assistant' && (
          <RichTextGenerationProgress 
            progress={generation_progress} 
            status={`Generating ${content_title || 'content'}...`}
          />
        )}

        {/* Show error state for failed document parsing */}
        {!is_generating && 
         content_metadata?.error && 
         content_metadata?.can_retry && (
          <DocumentParsingError
            errorMessage={content_metadata.error_message || 'Failed to parse document'}
            attachmentName={content_metadata.attachment_name || 'document'}
            attachmentPath={content_metadata.attachment_path || ''}
            attachmentType={content_metadata.attachment_type || ''}
            conversationId={conversation_id}
            channelId={channelId}
            agentId={agent_id || ''}
          />
        )}

        {/* Show OpenAI tool results */}
        {tool_results && !is_generating && (
          <div className="space-y-4">
            {/* Image Generation Results */}
            {content_type === 'image_generation' && tool_results.results?.success && (
              <div className="w-full min-w-0">
                <ImageGenerationCard
                  images={tool_results.results.images || []}
                  metadata={tool_results.results.metadata || {}}
                />
              </div>
            )}

            {/* Web Research Results */}
            {content_type === 'web_research' && (() => {
              const [isWebResearchExpanded, setIsWebResearchExpanded] = useState(true);

              // Normalize research payload: handle stringified JSON or direct objects
              const results = tool_results.results;
              if (!results) return false;


              // If the function wrapped payload under success, unwrap
              const payload = typeof results === 'string'
                ? (() => { try { return JSON.parse(results); } catch { return null; } })()
                : results;

              if (!payload) return false;

              // Handle different possible structures from the backend
              let research = null;
              let metadata: any = {
                depth: 'comprehensive',
                focus_areas: [],
                generated_at: new Date().toISOString(),
                execution_time: 0,
                model: 'gpt-4o'
              };

              // Structure 1: Direct research object (from openai-web-research function)
              if (payload.research) {
                research = payload.research;
                metadata = payload.metadata || {};
              }
              // Structure 2: Research data is directly in results
              else if (payload.query || payload.summary || payload.sections) {
                research = payload;
                metadata = {};
              }
              // Structure 3: Nested under success wrapper
              else if (payload.success && payload.research) {
                research = payload.research;
                metadata = payload.metadata || {};
              }
              // Structure 4: Stringified JSON that needs parsing
              else if (typeof payload === 'string') {
                try {
                  const parsed = JSON.parse(payload);
                  if (parsed.research) {
                    research = parsed.research;
                    metadata = parsed.metadata || {};
                  } else if (parsed.query || parsed.summary || parsed.sections) {
                    research = parsed;
                    metadata = {};
                  }
                } catch (e) {
                  console.error('Failed to parse stringified research data:', e);
                  return false;
                }
              }

              // Validate research object has required fields
              if (!research || typeof research !== 'object' || (!research.query && !research.summary)) {
                console.error('Invalid research data structure:', research);
                return false;
              }

              // Calculate source count first
              const sourceCount = (research.sources?.length || 0) + 
                (research.sections?.reduce((acc: number, section: any) => 
                  acc + (section.sources?.length || 0), 0) || 0);

              // Ensure research has all required fields with defaults
              const normalizedResearch = {
                query: research.query || 'Research Query',
                summary: research.summary || '',
                sections: research.sections || [],
                key_insights: research.key_insights || [],
                confidence_score: research.confidence_score || 0.8,
                total_sources: sourceCount,
                sources: research.sources || []
              };

              // Update metadata with required fields (reuse existing variable)
              metadata = {
                depth: 'comprehensive',
                focus_areas: research.focus_areas || [],
                generated_at: new Date().toISOString(),
                execution_time: tool_results?.metadata?.execution_time || 0,
                model: (tool_results?.metadata as any)?.model || 'gpt-4o'
              };


              return (
                <Collapsible open={isWebResearchExpanded} onOpenChange={setIsWebResearchExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left p-3 h-auto bg-muted/10 hover:bg-muted/20 border border-border rounded-lg whitespace-normal min-w-0"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <Search className="h-5 w-5 text-foreground flex-shrink-0" />
                          <div className="text-left min-w-0">
                            <p className="font-semibold text-sm text-foreground">Web Research Results</p>
                            <p className="text-xs text-muted-foreground truncate" title={normalizedResearch.query}>{normalizedResearch.query}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {sourceCount} sources
                          </Badge>
                          {isWebResearchExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 w-full min-w-0">
                      <WebResearchCard
                        research={normalizedResearch}
                        metadata={metadata}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })()}

            {/* Document Analysis Results */}
            {content_type === 'document_analysis' && rich_content && (rich_content as any)?.structuredAnalysis && (() => {
              const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);
              
              return (
                <Collapsible open={isAnalysisExpanded} onOpenChange={setIsAnalysisExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left p-3 h-auto bg-muted/10 hover:bg-muted/20 border border-border rounded-lg whitespace-normal min-w-0"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">Document Analysis</span>
                          <Badge variant="secondary" className="text-xs">
                            {(rich_content as any).structuredAnalysis?.documentType || 'Document'}
                          </Badge>
                        </div>
                        {isAnalysisExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3">
                      <DocumentAnalysisCard
                        analysis={(rich_content as any).structuredAnalysis}
                        documentName={(rich_content as any).documentSource || 'Document'}
                        aiProvider={(rich_content as any).aiProvider}
                        aiModel={(rich_content as any).aiModel}
                        onViewFull={() => onRichTextExpand?.(rich_content.title, rich_content.content, id)}
                        onEdit={() => onRichTextExpand?.(rich_content.title, rich_content.content, id)}
                        onDownload={() => {
                          // Create and download the analysis as a text file
                          const element = document.createElement("a");
                          const file = new Blob([`# ${rich_content.title}\n\n${rich_content.content}`], {
                            type: "text/markdown"
                          });
                          element.href = URL.createObjectURL(file);
                          element.download = `${rich_content.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
                          document.body.appendChild(element);
                          element.click();
                          document.body.removeChild(element);
                        }}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })()}

            {/* Mixed content or fallback text content */}
            {(content_type === 'mixed' || content_type === 'text' || (!tool_results.results?.success && content_type !== 'web_research' && content_type !== 'document_analysis')) && content && (
              <div className="text-sm text-foreground prose prose-sm max-w-none min-w-0 break-words select-text cursor-text">
                {renderParsedContent(content)}
              </div>
            )}

            {/* Tool execution summary for failed results */}
            {!tool_results.results?.success && content_type !== 'web_research' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  <strong>Tool execution failed:</strong> {tool_results.results?.error || 'Unknown error occurred'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Show rich text content card if available and not generating */}
        {rich_content && !is_generating && !tool_results && (
          <RichTextResponseCard
            title={rich_content.title}
            content={rich_content.content}
            onExpand={() => onRichTextExpand?.(rich_content.title, rich_content.content, id)}
            isChannelManagementOpen={isChannelManagementOpen}
            isRichTextSidebarOpen={isRichTextSidebarOpen}
            isDocumentSidebarOpen={isDocumentSidebarOpen}
          />
        )}

        {/* Regular message content */}
        {!rich_content && !is_generating && !tool_results && (
          <div className="text-sm text-foreground prose prose-sm max-w-none min-w-0 break-words select-text cursor-text">
            {renderParsedContent(content || '')}
          </div>
        )}

        {(citations.length > 0 || contextSummary) && (
          <div className="mt-3 border border-border rounded-lg bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Context Sources</div>
              {content_metadata?.context_used === false && (
                <Badge variant="outline" className="text-[10px]">Not used in reply</Badge>
              )}
            </div>

            {contextSummary && (
              <p className="text-sm text-foreground/80 leading-relaxed select-text cursor-text">
                {contextSummary}
              </p>
            )}

            {citations.map((citation, index) => {
              const link = getCitationLink(citation.metadata);
              return (
                <div key={`${citation.id}-${index}`} className="space-y-1 rounded-md bg-background p-2 border border-border/60">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {tierLabels[citation.tier] || citation.tier}
                      </Badge>
                      {citation.metadata?.source && (
                        <span className="text-xs text-muted-foreground">{citation.metadata.source}</span>
                      )}
                    </div>
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View source
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed break-words select-text cursor-text">
                    {citation.content}
                  </p>
                  {citation.metadata?.section && (
                    <p className="text-xs text-muted-foreground">Section: {citation.metadata.section}</p>
                  )}
                  {citation.relevanceScore !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>Relevance:</span>
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round(citation.relevanceScore * 100)}%
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Context Metadata Footer */}
            {content_metadata?.context_used && citations.length > 0 && (
              <div className="pt-2 mt-2 border-t border-border/50 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  <span>{citations.length} source{citations.length !== 1 ? 's' : ''} used</span>
                </div>
                {(() => {
                  // Count sources by tier
                  const tierCounts: Record<string, number> = {};
                  citations.forEach(c => {
                    tierCounts[c.tier] = (tierCounts[c.tier] || 0) + 1;
                  });
                  return Object.entries(tierCounts).map(([tier, count]) => (
                    <div key={tier} className="text-[10px]">
                      {tierLabels[tier] || tier}: {count}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}

        {/* File Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="mt-3 space-y-3 w-full max-w-[280px] min-w-0 overflow-hidden">
            {attachments.map((attachment, index) => (
              <div key={index} className="space-y-2 w-full min-w-0">
                {/* Simple File Preview */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-white rounded-[6px] border w-full min-w-0">
                  <div className="flex items-start sm:items-center space-x-3 w-full min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" title={attachment.name}>{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onFilePreview?.(attachment)}
                      className="h-6 w-full sm:w-6 sm:p-0"
                      title="Preview"
                    >
                      <ChevronDown className="h-3 w-3 mx-auto" />
                    </Button>
                  </div>
                </div>
                
                {/* Document Preview Card (for certain file types) */}
                {rich_content && (attachment.type.includes('pdf') || attachment.type.includes('document')) && (
                  <div className="bg-white border border-border rounded-[6px] p-4 shadow-sm w-full min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Document Preview</h4>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="text-xs">Version 1</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRichTextExpand?.(rich_content.title, rich_content.content, id)}
                          className="h-6 w-6 p-0"
                          title="View Rich Content Analysis"
                        >
                          <Maximize2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-foreground leading-relaxed max-h-32 overflow-hidden break-words">
                      {rich_content.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}