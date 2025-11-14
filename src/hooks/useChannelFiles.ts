import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ChannelFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  messageId: string;
}

export function useChannelFiles(channelId: string) {
  const [files, setFiles] = useState<ChannelFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!channelId || !user) return;

    const fetchChannelFiles = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all messages for this channel that have attachments
        const { data: messages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id, attachments, created_at, user_id')
          .eq('channel_id', channelId)
          .not('attachments', 'is', null)
          .order('created_at', { ascending: false });

        if (messagesError) throw messagesError;

        // Get unique user IDs to fetch profile info
        const userIds = [...new Set(messages?.map(m => m.user_id).filter(Boolean))];
        
        // Fetch profile info for all users
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', userIds);

        // Create a map for quick lookup
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        // Extract files from attachments
        const allFiles: ChannelFile[] = [];
        
        messages.forEach(message => {
          if (message.attachments && Array.isArray(message.attachments)) {
            const userProfile = profileMap.get(message.user_id);
            message.attachments.forEach((attachment: any) => {
              allFiles.push({
                id: `${message.id}-${attachment.path}`, // Unique ID combining message and file path
                name: attachment.name,
                path: attachment.path,
                size: attachment.size,
                type: attachment.type,
                uploadedBy: userProfile?.email || 'Unknown',
                uploadedAt: message.created_at,
                messageId: message.id
              });
            });
          }
        });

        setFiles(allFiles);
      } catch (err) {
        console.error('Error fetching channel files:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch files');
      } finally {
        setIsLoading(false);
      }
    };

    fetchChannelFiles();
  }, [channelId, user]);

  const getFileUrl = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error('Error getting file URL:', err);
      throw err;
    }
  };

  const downloadFile = async (file: ChannelFile) => {
    try {
      const url = await getFileUrl(file.path);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading file:', err);
      throw err;
    }
  };

  return {
    files,
    isLoading,
    error,
    getFileUrl,
    downloadFile
  };
}
