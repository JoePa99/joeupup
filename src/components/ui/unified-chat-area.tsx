import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getChannelWithAccess } from "@/lib/channel-utils";
import { useUserPresence } from "@/hooks/useUserPresence";
import { CompanyDocumentsList } from "@/components/documents/CompanyDocumentsList";
import { AgentDocumentsSidebar } from "@/components/documents/AgentDocumentsSidebar";
import { ChannelManagementSidebar } from "@/components/channels/ChannelManagementSidebar";
import { DocumentPreviewSidebar } from "./document-preview-sidebar";
import { RichTextEditorSidebar } from "./rich-text-editor-sidebar";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ChatHeader } from "./chat-header";
import { WelcomeDashboard } from "./welcome-dashboard";
import { ImageGenerationModal } from "./image-generation-modal";

interface FileAttachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  nickname: string | null;
  avatar_url: string | null;
  status: string;
  ai_provider?: string;
  ai_model?: string;
}

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  attachments?: FileAttachment[];
  agent_id?: string;
  is_generating?: boolean;
  generation_progress?: number;
  rich_content?: any;
  content_title?: string;
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
  client_message_id?: string;
  chain_index?: number;
  parent_message_id?: string;
  agent_chain?: string[];
}

interface Conversation {
  id: string;
  title: string;
  agent_id: string;
  created_at: string;
  updated_at: string;
}

interface UnifiedChatAreaProps {
  agentId?: string;
  channelId?: string;
}

export function UnifiedChatArea({ agentId, channelId }: UnifiedChatAreaProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelAgents, setChannelAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  
  // User presence tracking
  const { startPresenceTracking, stopPresenceTracking } = useUserPresence({
    channelId,
    conversationId: selectedConversation?.id,
    agentId
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingContext, setLoadingContext] = useState<{ type: 'channel' | 'conversation'; id: string } | null>(null);
  const [userProfile, setUserProfile] = useState<{ company_id: string | null } | null>(null);
  
  // Ref to track conversation creation locks per agent
  const creatingConversationRef = useRef<Record<string, boolean>>({});
  
  // Compute if current context is loading
  const isLoading = loadingContext !== null && (
    (channelId && loadingContext.type === 'channel' && loadingContext.id === channelId) ||
    (selectedConversation && loadingContext.type === 'conversation' && loadingContext.id === selectedConversation.id)
  );
  
  const [isDocumentSidebarOpen, setIsDocumentSidebarOpen] = useState(false);
  const [isChannelManagementOpen, setIsChannelManagementOpen] = useState(false);
  const [showPreviewSidebar, setShowPreviewSidebar] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
  const [showRichTextSidebar, setShowRichTextSidebar] = useState(false);
  const [richTextContent, setRichTextContent] = useState<{
    title: string;
    content: string;
    messageId: string;
  } | null>(null);
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Image generation state
  const [isImageGenerationOpen, setIsImageGenerationOpen] = useState(false);

  // Helper function to deduplicate messages by ID and client_message_id
  const dedupeMessages = (messages: Message[]): Message[] => {
    const seen = new Set<string>();
    const seenClientIds = new Set<string>();
    const result: Message[] = [];
    
    for (const msg of messages) {
      // Skip if we've already seen this exact ID
      if (seen.has(msg.id)) continue;
      
      // If this is a server message with client_message_id, remove any temp messages with that client ID
      if (msg.client_message_id && !msg.id.startsWith('temp-')) {
        seenClientIds.add(msg.client_message_id);
        // Remove any temp messages with this client_message_id
        const filteredResult = result.filter(m => 
          !(m.id.startsWith('temp-') && m.client_message_id === msg.client_message_id)
        );
        result.length = 0;
        result.push(...filteredResult);
      }
      
      // Skip temp messages if we already have a server version with the same client_message_id
      if (msg.id.startsWith('temp-') && msg.client_message_id && seenClientIds.has(msg.client_message_id)) {
        continue;
      }
      
      seen.add(msg.id);
      result.push(msg);
    }
    
    return result;
  };

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (agentId && user?.id && userProfile?.company_id) {
      // Clear channel state when switching to agent mode
      setChannel(null);
      setChannelAgents([]);
      fetchAgent(agentId);
      fetchConversations(agentId);
    } else if (channelId && userProfile?.company_id) {
      // Clear agent state when switching to channel mode
      // Channels require company_id since they're company-specific
      setAgent(null);
      setSelectedConversation(null);
      setConversations([]);
      fetchChannel(channelId);
      fetchChannelMessages(channelId);
      fetchChannelAgents(channelId);
    }
  }, [agentId, channelId, user?.id, userProfile]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Real-time subscriptions for channel messages
  useEffect(() => {
    if (!channelId) return;
    
    console.log('🔍 [DEBUG] Setting up real-time subscription for channel:', channelId);
    
    const channel = supabase
      .channel(`channel-chat-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          console.log('🔍 [DEBUG] Real-time message update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setMessages(prev => {
              const newMessage: Message = {
                id: payload.new.id,
                role: payload.new.role as 'user' | 'assistant',
                content: payload.new.content,
                created_at: payload.new.created_at,
                attachments: (payload.new.attachments as unknown as FileAttachment[]) || [],
                agent_id: payload.new.agent_id,
                is_generating: payload.new.is_generating,
                generation_progress: payload.new.generation_progress,
                rich_content: payload.new.rich_content,
                content_title: payload.new.content_title,
                tool_results: payload.new.tool_results,
                content_type: payload.new.content_type,
                client_message_id: (payload.new as any).client_message_id,
                chain_index: payload.new.chain_index,
                parent_message_id: payload.new.parent_message_id,
                agent_chain: payload.new.agent_chain
              };
              
              // Check if we have a temp message with the same client_message_id
              const hasTempWithSameClientId = prev.some(msg => 
                msg.id.startsWith('temp-') && 
                msg.client_message_id === newMessage.client_message_id
              );
              
              if (hasTempWithSameClientId) {
                // Replace temp message with server message
                const updatedMessages = prev.map(msg => 
                  msg.id.startsWith('temp-') && msg.client_message_id === newMessage.client_message_id
                    ? newMessage
                    : msg
                );
                return dedupeMessages(updatedMessages);
              } else {
                // Avoid duplicates by ID
                if (prev.some(msg => msg.id === newMessage.id)) {
                  return prev;
                }
                return dedupeMessages([...prev, newMessage]);
              }
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => {
              const updatedMessages = prev.map(msg => 
                msg.id === payload.new.id 
                  ? {
                      ...msg,
                      id: payload.new.id,
                      role: payload.new.role as 'user' | 'assistant',
                      content: payload.new.content,
                      created_at: payload.new.created_at,
                      attachments: (payload.new.attachments as unknown as FileAttachment[]) || [],
                      agent_id: payload.new.agent_id,
                      is_generating: payload.new.is_generating,
                      generation_progress: payload.new.generation_progress,
                      rich_content: payload.new.rich_content,
                      content_title: payload.new.content_title,
                      tool_results: payload.new.tool_results,
                      content_type: payload.new.content_type,
                      client_message_id: (payload.new as any).client_message_id,
                      chain_index: payload.new.chain_index,
                      parent_message_id: payload.new.parent_message_id,
                      agent_chain: payload.new.agent_chain
                    }
                  : msg
              );
              return dedupeMessages(updatedMessages);
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔍 [DEBUG] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  // Real-time subscriptions for direct conversation messages
  useEffect(() => {
    if (!selectedConversation) return;
    
    console.log('🔍 [DEBUG] Setting up real-time subscription for conversation:', selectedConversation.id);
    
    const channel = supabase
      .channel(`conversation-messages-${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          console.log('🔍 [DEBUG] Real-time conversation message update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setMessages(prev => {
              const newMessage: Message = {
                id: payload.new.id,
                role: payload.new.role as 'user' | 'assistant',
                content: payload.new.content,
                created_at: payload.new.created_at,
                attachments: (payload.new.attachments as unknown as FileAttachment[]) || [],
                agent_id: payload.new.agent_id,
                is_generating: payload.new.is_generating,
                generation_progress: payload.new.generation_progress,
                rich_content: payload.new.rich_content,
                content_title: payload.new.content_title,
                tool_results: payload.new.tool_results,
                content_type: payload.new.content_type,
                client_message_id: (payload.new as any).client_message_id
              };
              
              // Check if we have a temp message with the same client_message_id
              const hasTempWithSameClientId = prev.some(msg => 
                msg.id.startsWith('temp-') && 
                msg.client_message_id === newMessage.client_message_id
              );
              
              if (hasTempWithSameClientId) {
                // Replace temp message with server message
                const updatedMessages = prev.map(msg => 
                  msg.id.startsWith('temp-') && msg.client_message_id === newMessage.client_message_id
                    ? newMessage
                    : msg
                );
                return dedupeMessages(updatedMessages);
              } else {
                // Avoid duplicates by ID
                if (prev.some(msg => msg.id === newMessage.id)) {
                  return prev;
                }
                return dedupeMessages([...prev, newMessage]);
              }
            });
          } else if (payload.eventType === 'UPDATE') {
            console.log('🔍 [DEBUG] Updating message in real-time:', {
              messageId: payload.new.id,
              is_generating: payload.new.is_generating,
              content_type: payload.new.content_type,
              has_rich_content: !!payload.new.rich_content
            });
            
            setMessages(prev => {
              const updatedMessages = prev.map(msg => 
                msg.id === payload.new.id 
                  ? {
                      ...msg,
                      id: payload.new.id,
                      role: payload.new.role as 'user' | 'assistant',
                      content: payload.new.content,
                      created_at: payload.new.created_at,
                      attachments: (payload.new.attachments as unknown as FileAttachment[]) || [],
                      agent_id: payload.new.agent_id,
                      is_generating: payload.new.is_generating,
                      generation_progress: payload.new.generation_progress,
                      rich_content: payload.new.rich_content,
                      content_title: payload.new.content_title,
                      tool_results: payload.new.tool_results,
                      content_type: payload.new.content_type,
                      client_message_id: (payload.new as any).client_message_id
                    }
                  : msg
              );
              return dedupeMessages(updatedMessages);
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔍 [DEBUG] Cleaning up conversation real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  // Polling fallback for generating messages
  useEffect(() => {
    if (!channelId) return;
    
    const hasGeneratingMessages = messages.some(msg => msg.is_generating);
    
    if (!hasGeneratingMessages) return;
    
    console.log('🔍 [DEBUG] Starting polling for generating messages');
    
    const pollForUpdates = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('channel_id', channelId)
          .is('conversation_id', null)
          .eq('is_generating', true);
          
        if (error) {
          console.error('Polling error:', error);
          return;
        }
        
        if (data && data.length === 0) {
          // No more generating messages, refresh all messages
          await fetchChannelMessages(channelId);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    
    const pollInterval = setInterval(pollForUpdates, 2000);
    
    return () => {
      console.log('🔍 [DEBUG] Clearing polling interval');
      clearInterval(pollInterval);
    };
  }, [channelId, messages]);

  // Polling fallback for generating messages in direct conversations
  useEffect(() => {
    if (!selectedConversation) return;
    
    const hasGeneratingMessages = messages.some(msg => msg.is_generating);
    
    if (!hasGeneratingMessages) return;
    
    console.log('🔍 [DEBUG] Starting polling for generating messages in direct conversation');
    
    const pollForUpdates = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', selectedConversation.id)
          .is('channel_id', null)
          .eq('is_generating', true);
          
        if (error) {
          console.error('Polling error:', error);
          return;
        }
        
        if (data && data.length === 0) {
          // No more generating messages, refresh all messages
          await fetchMessages(selectedConversation.id);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };
    
    const pollInterval = setInterval(pollForUpdates, 2000);
    
    return () => {
      console.log('🔍 [DEBUG] Clearing polling interval for direct conversation');
      clearInterval(pollInterval);
    };
  }, [selectedConversation, messages]);

  // Start/stop presence tracking when entering/leaving chat
  useEffect(() => {
    if (channelId || selectedConversation) {
      startPresenceTracking();
    } else {
      stopPresenceTracking();
    }

    return () => {
      stopPresenceTracking();
    };
  }, [channelId, selectedConversation, startPresenceTracking, stopPresenceTracking]);

  const fetchUserProfile = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchAgent = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAgent(data);
    } catch (error) {
      console.error('Error fetching agent:', error);
    }
  };

  const fetchChannel = async (id: string) => {
    try {
      // Use the access-controlled channel fetch
      const channelData = await getChannelWithAccess(id);
      
      if (!channelData) {
        // User doesn't have access to this channel
        console.warn('User does not have access to channel:', id);
        setChannel(null);
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this channel.",
          variant: "destructive",
        });
        return;
      }
      
      setChannel(channelData);
    } catch (error) {
      console.error('Error fetching channel:', error);
      setChannel(null);
      toast({
        title: "Error",
        description: "Failed to load channel. You may not have permission to access it.",
        variant: "destructive",
      });
    }
  };

  const fetchChannelAgents = async (channelId: string) => {
    try {
      // First get the agent IDs for this channel
      const { data: channelAgentData, error: channelError } = await supabase
        .from('channel_agents')
        .select('agent_id')
        .eq('channel_id', channelId);

      if (channelError) throw channelError;
      
      if (!channelAgentData || channelAgentData.length === 0) {
        setChannelAgents([]);
        return;
      }

      // Then get the actual agent data
      const agentIds = channelAgentData.map(item => item.agent_id);
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name, description, role, nickname, avatar_url, status')
        .in('id', agentIds)
        .eq('status', 'active');

      if (agentsError) throw agentsError;
      
      setChannelAgents(agentsData || []);
    } catch (error) {
      console.error('Error fetching channel agents:', error);
      setChannelAgents([]);
    }
  };

  const fetchConversations = async (agentId: string) => {
    // Guard: Only proceed if user and profile are loaded
    if (!user?.id || !userProfile?.company_id) {
      console.log('Skipping fetchConversations: user or profile not loaded');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .eq('company_id', userProfile.company_id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      const conversations = data || [];
      setConversations(conversations);
      
      // Check localStorage for last selected conversation for this agent
      const lastConvId = localStorage.getItem(`lastConv:${agentId}`);
      let selectedConv = conversations[0]; // Default to most recent
      
      if (lastConvId && conversations.length > 0) {
        const lastConv = conversations.find(c => c.id === lastConvId);
        if (lastConv) {
          selectedConv = lastConv;
        }
      }
      
      if (selectedConv) {
        setSelectedConversation(selectedConv);
        localStorage.setItem(`lastConv:${agentId}`, selectedConv.id);
      } else {
        // Only create new conversation if truly none exists
        await createOrGetConversation(agentId);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .is('channel_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const messages = (data || []).map(msg => ({
        ...msg,
        role: msg.role as 'user' | 'assistant',
        content_type: (msg.content_type as 'text' | 'image_generation' | 'web_research' | 'mixed') || 'text',
        attachments: (msg.attachments as unknown as FileAttachment[]) || [],
        tool_results: msg.tool_results as any,
        client_message_id: (msg as any).client_message_id
      }));
      setMessages(dedupeMessages(messages));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchChannelMessages = async (channelId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', channelId)
        .is('conversation_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const messages = (data || []).map(msg => ({
        ...msg,
        role: msg.role as 'user' | 'assistant',
        content_type: (msg.content_type as 'text' | 'image_generation' | 'web_research' | 'mixed') || 'text',
        attachments: (msg.attachments as unknown as FileAttachment[]) || [],
        tool_results: msg.tool_results as any,
        client_message_id: (msg as any).client_message_id
      }));
      setMessages(dedupeMessages(messages));
    } catch (error) {
      console.error('Error fetching channel messages:', error);
    }
  };

  const createOrGetConversation = async (agentId: string) => {
    // Guard: Only proceed if all required data is available
    if (!user?.id || !userProfile?.company_id) {
      console.log('Skipping createOrGetConversation: missing required data');
      return null;
    }

    // Check if we're already creating a conversation for this agent
    if (creatingConversationRef.current[agentId]) {
      console.log('Conversation creation already in progress for agent:', agentId);
      return null;
    }

    // Set lock for this agent
    creatingConversationRef.current[agentId] = true;

    try {
      // First, try to find an existing conversation
      const { data: existingConv, error: fetchError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('agent_id', agentId)
        .eq('company_id', userProfile.company_id)
        .single();

      if (existingConv && !fetchError) {
        // Conversation exists, use it
        console.log('Found existing conversation:', existingConv.id);
        setConversations(prev => [existingConv, ...prev.filter(c => c.id !== existingConv.id)]);
        setSelectedConversation(existingConv);
        localStorage.setItem(`lastConv:${agentId}`, existingConv.id);
        return existingConv;
      }

      // No existing conversation found, create a new one
      console.log('Creating new conversation for agent:', agentId);
      const { data: newConv, error: createError } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          agent_id: agentId,
          company_id: userProfile.company_id,
          title: `Chat with ${agent?.name || 'Agent'}`
        })
        .select()
        .single();

      if (createError) {
        // If creation fails due to unique constraint, try to fetch again
        if (createError.code === '23505') {
          console.log('Unique constraint violation during creation, fetching existing conversation');
          const { data: existingConv2, error: fetchError2 } = await supabase
            .from('chat_conversations')
            .select('*')
            .eq('user_id', user.id)
            .eq('agent_id', agentId)
            .eq('company_id', userProfile.company_id)
            .single();

          if (fetchError2) throw fetchError2;
          
          setConversations(prev => [existingConv2, ...prev.filter(c => c.id !== existingConv2.id)]);
          setSelectedConversation(existingConv2);
          localStorage.setItem(`lastConv:${agentId}`, existingConv2.id);
          return existingConv2;
        }
        throw createError;
      }
      
      setConversations(prev => [newConv, ...prev.filter(c => c.id !== newConv.id)]);
      setSelectedConversation(newConv);
      setMessages([]);
      localStorage.setItem(`lastConv:${agentId}`, newConv.id);
      return newConv;
    } catch (error) {
      console.error('Error creating/getting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create or get conversation",
        variant: "destructive",
      });
      return null;
    } finally {
      // Release lock for this agent
      creatingConversationRef.current[agentId] = false;
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && uploadedFiles.length === 0) || !user) return;
    
    // CRITICAL: Prioritize channel mode to prevent message misrouting
    if (channelId) {
      await sendChannelMessage();
    }
    // For agent conversations (only when not in channel mode)
    else if (selectedConversation && agent && agentId) {
      await sendAgentMessage();
    }
  };

  const sendAgentMessage = async () => {
    if (!agent || !user) return;
    
    // Ensure we have a conversation before sending
    let conversation = selectedConversation;
    if (!conversation) {
      conversation = await createOrGetConversation(agent.id);
      if (!conversation) {
        console.error('Failed to create or get conversation for agent:', agent.id);
        return;
      }
    }

    const userMessage = newMessage.trim();
    setNewMessage("");
    setLoadingContext({ type: 'conversation', id: conversation.id });

    // Upload files if any
    const attachments = await uploadFiles();
    setUploadedFiles([]);
    console.log('🔍 [DEBUG] Agent message attachments to send:', attachments);

    // Generate unique client message ID for deduplication
    const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).substring(2)}`;

    // Add user message to UI immediately
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
      attachments,
      client_message_id: clientMessageId
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      console.log('🔍 [DEBUG] Sending agent message with payload:', { message: userMessage, agent_id: agent.id, attachments, client_message_id: clientMessageId });
      const { data, error } = await supabase.functions.invoke('chat-with-agent', {
        body: {
          message: userMessage,
          agent_id: agent.id,
          conversation_id: conversation.id,
          user_id: user.id,
          attachments,
          client_message_id: clientMessageId
        }
      });

      if (error) throw error;

      // Check if this was a Google integration response
      if (data.requires_google_integration) {
        // Show Google integration response
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Show success toast for Google integration
        toast({
          title: "Google Workspace Integration",
          description: `Successfully executed ${data.actions_executed} Google actions`,
        });
      } else {
        // Regular OpenAI assistant response
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      }

      // Refresh messages to get the saved conversation
      await fetchMessages(selectedConversation.id);
      
      // Update conversation list
      await fetchConversations(agent.id);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      // Remove the temporary message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
    } finally {
      setLoadingContext(null);
    }
  };

  const sendChannelMessage = async () => {
    if (!channelId || !user) return;

    const userMessage = newMessage.trim();
    setNewMessage("");
    setLoadingContext({ type: 'channel', id: channelId });

    try {
      // Upload files if any
      const attachments = await uploadFiles();
      setUploadedFiles([]);
      console.log('🔍 [DEBUG] Channel message attachments to send:', attachments);

      // Generate unique client message ID for deduplication
      const clientMessageId = `client-${Date.now()}-${Math.random().toString(36).substring(2)}`;

      // Detect ALL agent mentions in order
      const allAgentMentions = detectAllAgentMentions(userMessage);
      console.log('🔍 [DEBUG] All agent mentions detected:', allAgentMentions);

      const firstAgent = allAgentMentions.length > 0 ? allAgentMentions[0] : null;
      const agentChain = allAgentMentions.slice(1).map(m => m.agentId); // Remaining agents
      
      // Store user message with first agent and chain
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          content: userMessage,
          role: 'user',
          channel_id: channelId,
          conversation_id: null,
          message_type: 'channel',
          attachments: attachments as any,
          agent_id: firstAgent?.agentId || null,
          agent_chain: agentChain.length > 0 ? agentChain : null,
          chain_index: firstAgent ? 0 : null,
          mention_type: firstAgent ? 'direct_mention' : null,
          client_message_id: clientMessageId
        });

      if (error) throw error;
      console.log('🔍 [DEBUG] User message stored in channel with attachments:', attachments.length);
      if (agentChain.length > 0) {
        console.log('🔍 [DEBUG] Agent chain will be processed:', agentChain);
      }

      // If an agent is mentioned, process the message with the first agent
      if (firstAgent) {
        try {
          console.log('🔍 [DEBUG] Calling chat-with-agent-channel with payload:', { message: userMessage, agent_id: firstAgent.agentId, channel_id: channelId, attachments });
          const { data, error: agentError } = await supabase.functions.invoke('chat-with-agent-channel', {
            body: {
              message: userMessage,
              agent_id: firstAgent.agentId,
              channel_id: channelId,
              attachments: attachments
            }
          });

          if (agentError) {
            console.error('Agent processing error:', agentError);
            toast({
              title: "Agent Error",
              description: "Failed to process message with agent",
              variant: "destructive",
            });
          }
        } catch (agentError) {
          console.error('Agent processing error:', agentError);
          toast({
            title: "Agent Error", 
            description: "Failed to process message with agent",
            variant: "destructive",
          });
        }
      }

      // Set up fallback fetch if no realtime event received within 1 second
      const fallbackTimeout = setTimeout(async () => {
        console.log('🔍 [DEBUG] Fallback fetch triggered for channel messages');
        await fetchChannelMessages(channelId);
      }, 1000);

      // Clear timeout if realtime event is received (we'll rely on realtime updates)
      // Note: This is a simple approach; in production you might want more sophisticated tracking
    } catch (error) {
      console.error('Error sending channel message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoadingContext(null);
    }
  };

  // Helper function to detect agent mentions in message
  const detectAgentMention = (message: string): { agentId: string; agentName: string } | null => {
    // Look for @mentions in the message, but ignore email addresses
    // Updated regex to check for word boundary or start of string before @
    const mentionRegex = /(?:^|[\s\n\r])@([^@\s\n\r][^@\n\r]*?)(?=\s+[^@]|\s*$|@|[\n\r])/g;
    let match;
    
    console.log('🔍 [DEBUG] Available agents:', channelAgents.map(a => ({ name: a.name, nickname: a.nickname })));
    
    while ((match = mentionRegex.exec(message)) !== null) {
      const mentionName = match[1].trim(); // Remove @ and trim whitespace
      console.log('🔍 [DEBUG] Captured mention text:', `"${mentionName}"`);
      
      // Skip if this looks like an email domain (contains dot and common TLDs)
      if (mentionName.includes('.') && /\.(com|org|net|edu|gov|io|co|uk|de|fr|es|it|ca|au|jp|cn|in|br|mx|ru|nl|se|no|dk|fi|pl|cz|at|ch|be|ie|pt|gr|hu|sk|si|ro|bg|hr|lv|lt|ee|lu|mt|cy)$/i.test(mentionName)) {
        console.log('🔍 [DEBUG] Skipping email-like mention:', mentionName);
        continue;
      }
      
      // Find agent by exact name or nickname match first
      let agent = channelAgents.find(a => 
        (a.nickname && a.nickname.toLowerCase() === mentionName.toLowerCase()) ||
        a.name.toLowerCase() === mentionName.toLowerCase()
      );
      
      // If no exact match, try partial matching (useful for shortened names)
      if (!agent) {
        agent = channelAgents.find(a => 
          (a.nickname && a.nickname.toLowerCase().includes(mentionName.toLowerCase())) ||
          a.name.toLowerCase().includes(mentionName.toLowerCase())
        );
      }
      
      console.log('🔍 [DEBUG] Agent match result:', agent ? { id: agent.id, name: agent.name } : null);
      
      if (agent) {
        return {
          agentId: agent.id,
          agentName: agent.nickname || agent.name
        };
      }
    }

    return null;
  };

  // Helper function to detect ALL agent mentions in order of appearance
  const detectAllAgentMentions = (message: string): Array<{ agentId: string; agentName: string }> => {
    const mentions: Array<{ agentId: string; agentName: string; position: number }> = [];
    const mentionRegex = /(?:^|[\s\n\r])@([^@\s\n\r][^@\n\r]*?)(?=\s+[^@]|\s*$|@|[\n\r])/g;
    let match;
    
    console.log('🔍 [DEBUG] Detecting all agent mentions...');
    
    while ((match = mentionRegex.exec(message)) !== null) {
      const mentionName = match[1].trim();
      
      // Skip email-like mentions
      if (mentionName.includes('.') && /\.(com|org|net|edu|gov|io|co|uk|de|fr|es|it|ca|au|jp|cn|in|br|mx|ru|nl|se|no|dk|fi|pl|cz|at|ch|be|ie|pt|gr|hu|sk|si|ro|bg|hr|lv|lt|ee|lu|mt|cy)$/i.test(mentionName)) {
        continue;
      }
      
      // Find matching agent (exact or partial)
      let agent = channelAgents.find(a => 
        (a.nickname && a.nickname.toLowerCase() === mentionName.toLowerCase()) ||
        a.name.toLowerCase() === mentionName.toLowerCase()
      );
      
      if (!agent) {
        agent = channelAgents.find(a => 
          (a.nickname && a.nickname.toLowerCase().includes(mentionName.toLowerCase())) ||
          a.name.toLowerCase().includes(mentionName.toLowerCase())
        );
      }
      
      if (agent) {
        mentions.push({
          agentId: agent.id,
          agentName: agent.nickname || agent.name,
          position: match.index
        });
      }
    }
    
    // Sort by position and deduplicate
    const sorted = mentions.sort((a, b) => a.position - b.position);
    const unique = sorted.filter((mention, index, arr) => 
      arr.findIndex(m => m.agentId === mention.agentId) === index
    );
    
    console.log('🔍 [DEBUG] Found agent mentions:', unique.map(m => m.agentName));
    return unique.map(m => ({ agentId: m.agentId, agentName: m.agentName }));
  };

  const handleFileUpload = (files: File[]) => {
    setUploadedFiles(files);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleImageGenerated = async (imageUrl: string, prompt: string) => {
    // Add the generated image to the chat as a system message
    const systemMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'assistant',
      content: `Generated image: "${prompt}"`,
      created_at: new Date().toISOString(),
      attachments: [{
        name: 'generated-image.png',
        path: imageUrl,
        size: 0,
        type: 'image/png'
      }],
      content_type: 'image_generation'
    };
    
    setMessages(prev => [...prev, systemMessage]);
    
    toast({
      title: "Image added to chat",
      description: "The generated image has been added to your conversation.",
    });
  };

  const uploadFiles = async (): Promise<FileAttachment[]> => {
    if (uploadedFiles.length === 0) return [];
    
    console.log('🔍 [DEBUG] Starting file upload process for', uploadedFiles.length, 'files');
    const attachments: FileAttachment[] = [];
    
    for (const file of uploadedFiles) {
      try {
        console.log('🔍 [DEBUG] Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${userProfile?.company_id}/${user?.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat-files')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        const attachment = {
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type
        };
        
        attachments.push(attachment);
        console.log('✅ [DEBUG] File uploaded successfully:', attachment);
      } catch (error) {
        console.error('❌ [DEBUG] Error uploading file:', file.name, error);
        toast({
          title: "Upload Error",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }
    
    console.log('🔍 [DEBUG] Upload process complete. Total attachments:', attachments.length);
    return attachments;
  };

  const handleFilePreview = (file: FileAttachment) => {
    setPreviewFile(file);
    setShowPreviewSidebar(true);
    // Close other sidebars when opening document preview
    setIsChannelManagementOpen(false);
    setShowRichTextSidebar(false);
  };

  const handleRichTextExpand = (title: string, content: string, messageId: string) => {
    setRichTextContent({ title, content, messageId });
    setShowRichTextSidebar(true);
    // Close other sidebars when opening rich text editor
    setIsChannelManagementOpen(false);
    setShowPreviewSidebar(false);
  };

  const handleRichTextSave = async (title: string, content: string) => {
    if (!richTextContent?.messageId) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({
          rich_content: {
            title,
            content,
            outline: content.match(/^#+\s*(.+)/gm)?.map(h => h.replace(/^#+\s*/, '')) || [],
            editedAt: new Date().toISOString()
          },
          content_title: title
        })
        .eq('id', richTextContent.messageId);

      if (error) throw error;

      // Update local state
      setRichTextContent(prev => prev ? { ...prev, title, content } : null);

      // Refresh messages
      if (selectedConversation) {
        await fetchMessages(selectedConversation.id);
      } else if (channelId) {
        await fetchChannelMessages(channelId);
      }

    } catch (error) {
      console.error('Error saving rich text:', error);
      throw error;
    }
  };


  // Agent conversation view
  if (agentId && agent) {
    return (
      <div className="flex h-full overflow-x-hidden">
        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden w-full">
          {selectedConversation ? (
            <>
              <ChatHeader
                type="agent"
                agent={agent}
                onSettingsClick={() => {
                  setIsDocumentSidebarOpen(!isDocumentSidebarOpen);
                  // Close other sidebars when toggling document sidebar
                  if (!isDocumentSidebarOpen) {
                    setShowPreviewSidebar(false);
                    setShowRichTextSidebar(false);
                  }
                }}
                isSettingsOpen={isDocumentSidebarOpen}
              />

              <MessageList
                messages={messages}
                isLoading={isLoading}
                agent={agent}
                user={user}
                onFilePreview={handleFilePreview}
                onRichTextExpand={handleRichTextExpand}
                isChannelManagementOpen={false}
                isRichTextSidebarOpen={showRichTextSidebar}
                isDocumentSidebarOpen={isDocumentSidebarOpen}
              />

              <ChatInput
                placeholder={`Message ${agent.name}...`}
                value={newMessage}
                onChange={setNewMessage}
                onSend={sendMessage}
                isLoading={isLoading}
                uploadedFiles={uploadedFiles}
                onFileUpload={handleFileUpload}
                onRemoveFile={removeFile}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Loading conversation...</h3>
                <p className="text-muted-foreground">
                  Setting up your chat with {agent.name}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Agent Documents Sidebar - positioned on the right */}
        {isDocumentSidebarOpen && (
          <div className="hidden md:block shrink-0">
            <AgentDocumentsSidebar
              agentId={agentId}
              isOpen={isDocumentSidebarOpen}
              onClose={() => setIsDocumentSidebarOpen(false)}
            />
          </div>
        )}
        
        {/* Mobile Agent Documents Sidebar - full screen overlay */}
        {isDocumentSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background">
            <AgentDocumentsSidebar
              agentId={agentId}
              isOpen={isDocumentSidebarOpen}
              onClose={() => setIsDocumentSidebarOpen(false)}
            />
          </div>
        )}

        {/* Document Preview Sidebar */}
        {showPreviewSidebar && (
          <div className="hidden md:block shrink-0">
            <DocumentPreviewSidebar
              isOpen={showPreviewSidebar}
              onClose={() => setShowPreviewSidebar(false)}
              file={previewFile}
            />
          </div>
        )}
        
        {/* Mobile Document Preview Sidebar - full screen overlay */}
        {showPreviewSidebar && (
          <div className="md:hidden fixed inset-0 z-50 bg-background">
            <DocumentPreviewSidebar
              isOpen={showPreviewSidebar}
              onClose={() => setShowPreviewSidebar(false)}
              file={previewFile}
            />
          </div>
        )}

        {/* Rich Text Editor Sidebar */}
        <RichTextEditorSidebar
          isOpen={showRichTextSidebar}
          onClose={() => setShowRichTextSidebar(false)}
          title={richTextContent?.title || ''}
          content={richTextContent?.content || ''}
          messageId={richTextContent?.messageId || ''}
          onSave={handleRichTextSave}
        />
        
        {/* Image Generation Modal */}
        <ImageGenerationModal
          open={isImageGenerationOpen}
          onOpenChange={setIsImageGenerationOpen}
          agentId={agentId}
          agentConfig={{
            ai_provider: agent?.ai_provider,
            ai_model: agent?.ai_model
          }}
          onImageGenerated={handleImageGenerated}
        />
      </div>
    );
  }

  // Channel view
  if (channelId && channel) {
    return (
      <div className="flex h-full overflow-x-hidden">
        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden w-full">
          <ChatHeader
            type="channel"
            channel={channel}
            onSettingsClick={() => {
                  setIsChannelManagementOpen(!isChannelManagementOpen);
                  // Close document preview sidebar when opening channel management
                  if (!isChannelManagementOpen) setShowPreviewSidebar(false);
                }}
            isSettingsOpen={isChannelManagementOpen}
          />

          <MessageList
            messages={messages}
            isLoading={isLoading}
            channelAgents={channelAgents}
            user={user}
            onFilePreview={handleFilePreview}
            onRichTextExpand={handleRichTextExpand}
            isChannelManagementOpen={isChannelManagementOpen}
            isRichTextSidebarOpen={showRichTextSidebar}
            isDocumentSidebarOpen={false}
          />

          <ChatInput
            placeholder={`Message #${channel.name}... (type @ to mention agents)`}
            value={newMessage}
            onChange={setNewMessage}
            onSend={sendMessage}
            isLoading={isLoading}
            channelAgents={channelAgents}
            uploadedFiles={uploadedFiles}
            onFileUpload={handleFileUpload}
            onRemoveFile={removeFile}
          />
        </div>

        {/* Channel Management Sidebar - positioned on the right */}
        {isChannelManagementOpen && (
          <div className="hidden md:block shrink-0">
            <ChannelManagementSidebar
              channelId={channelId}
              isOpen={isChannelManagementOpen}
              onClose={() => setIsChannelManagementOpen(false)}
              onChannelDeleted={() => {
                // Navigate back to main dashboard when channel is deleted
                navigate('/client-dashboard');
                toast({
                  title: "Channel deleted",
                  description: "The channel has been successfully deleted.",
                });
              }}
            />
          </div>
        )}
        
        {/* Mobile Channel Management Sidebar - full screen overlay */}
        {isChannelManagementOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background">
            <ChannelManagementSidebar
              channelId={channelId}
              isOpen={isChannelManagementOpen}
              onClose={() => setIsChannelManagementOpen(false)}
              onChannelDeleted={() => {
                // Navigate back to main dashboard when channel is deleted
                navigate('/client-dashboard');
                toast({
                  title: "Channel deleted",
                  description: "The channel has been successfully deleted.",
                });
              }}
            />
          </div>
        )}
        
        {/* Document Preview Sidebar */}
        {showPreviewSidebar && (
          <div className="hidden md:block shrink-0">
            <DocumentPreviewSidebar
              isOpen={showPreviewSidebar}
              onClose={() => setShowPreviewSidebar(false)}
              file={previewFile}
            />
          </div>
        )}
        
        {/* Mobile Document Preview Sidebar - full screen overlay */}
        {showPreviewSidebar && (
          <div className="md:hidden fixed inset-0 z-50 bg-background">
            <DocumentPreviewSidebar
              isOpen={showPreviewSidebar}
              onClose={() => setShowPreviewSidebar(false)}
              file={previewFile}
            />
          </div>
        )}

        {/* Rich Text Editor Sidebar */}
        <RichTextEditorSidebar
          isOpen={showRichTextSidebar}
          onClose={() => setShowRichTextSidebar(false)}
          title={richTextContent?.title || ''}
          content={richTextContent?.content || ''}
          messageId={richTextContent?.messageId || ''}
          onSave={handleRichTextSave}
        />
        
        {/* Image Generation Modal */}
        <ImageGenerationModal
          open={isImageGenerationOpen}
          onOpenChange={setIsImageGenerationOpen}
          agentId={agentId}
          agentConfig={
            // For channels, use the first agent's config or fallback
            channelAgents.length > 0 ? {
              ai_provider: channelAgents[0]?.ai_provider,
              ai_model: channelAgents[0]?.ai_model
            } : undefined
          }
          onImageGenerated={handleImageGenerated}
        />
      </div>
    );
  }

  // Default welcome state
  return (
    <WelcomeDashboard
      onNavigateToChannel={(channelId) => {
        // Navigate to the specific channel
        navigate(`/client-dashboard?channel=${channelId}`);
      }}
      onNavigateToAgent={(agentId) => {
        // Navigate to the specific agent
        navigate(`/client-dashboard?agent=${agentId}`);
      }}
    />
  );
}