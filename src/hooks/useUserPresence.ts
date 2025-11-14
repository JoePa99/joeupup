import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseUserPresenceOptions {
  channelId?: string;
  conversationId?: string;
  agentId?: string;
}

export function useUserPresence({ channelId, conversationId, agentId }: UseUserPresenceOptions) {
  const { user } = useAuth();
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef<boolean>(false);

  // Function to update user presence
  const updatePresence = useCallback(async (isActive: boolean = true) => {
    if (!user?.id) return;

    try {
      if (isActive) {
        // Update user presence in database - mark as active
        const { error } = await supabase.rpc('update_user_presence', {
          p_user_id: user.id,
          p_channel_id: channelId || null,
          p_conversation_id: conversationId || null
        });

        if (error) {
          console.error('Error updating user presence:', error);
        } else {
          console.log(`User ${user.id} marked as active in ${channelId ? `channel ${channelId}` : conversationId ? `conversation ${conversationId}` : 'app'}`);
        }
      } else {
        // Mark user as away
        const { error } = await supabase.rpc('mark_user_away', {
          p_user_id: user.id,
          p_channel_id: channelId || null,
          p_conversation_id: conversationId || null
        });

        if (error) {
          console.error('Error marking user as away:', error);
        } else {
          console.log(`User ${user.id} marked as away from ${channelId ? `channel ${channelId}` : conversationId ? `conversation ${conversationId}` : 'app'}`);
        }
      }
      
      isActiveRef.current = isActive;
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }, [user?.id, channelId, conversationId]);

  // Function to start presence tracking
  const startPresenceTracking = useCallback(() => {
    if (!user?.id || presenceIntervalRef.current) return;

    // Initial presence update
    updatePresence(true);

    // Set up interval to keep presence active (every 2 minutes)
    presenceIntervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        updatePresence(true);
      }
    }, 2 * 60 * 1000); // 2 minutes
  }, [user?.id, updatePresence]);

  // Function to stop presence tracking
  const stopPresenceTracking = useCallback(() => {
    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current);
      presenceIntervalRef.current = null;
    }
    
    // Mark user as away
    updatePresence(false);
  }, [updatePresence]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence(false);
      } else {
        updatePresence(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updatePresence]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      updatePresence(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [updatePresence]);

  // Handle focus/blur events
  useEffect(() => {
    const handleFocus = () => {
      if (isActiveRef.current) {
        updatePresence(true);
      }
    };

    const handleBlur = () => {
      updatePresence(false);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [updatePresence]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPresenceTracking();
    };
  }, [stopPresenceTracking]);

  return {
    startPresenceTracking,
    stopPresenceTracking,
    updatePresence,
    isActive: isActiveRef.current
  };
}
