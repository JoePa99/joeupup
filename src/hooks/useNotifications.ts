import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { NotificationType } from '@/lib/notifications';
import { toast as sonnerToast } from 'sonner';

interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read?: boolean;
  read_at?: string | null;
  created_at?: string;
  agent_id?: string;
  channel_id?: string;
  data?: any;
}

export interface UseNotificationsReturn {
  notifications: NotificationData[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch notifications with read status from join with notification_reads
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          title,
          message,
          data,
          agent_id,
          channel_id,
          created_at,
          notification_reads!left(read_at)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notificationsError) throw notificationsError;

      // Transform the data to include is_read and read_at
      const transformedNotifications = (notificationsData || []).map((notification: any) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        agent_id: notification.agent_id,
        channel_id: notification.channel_id,
        created_at: notification.created_at,
        is_read: notification.notification_reads && notification.notification_reads.length > 0,
        read_at: notification.notification_reads?.[0]?.read_at || null,
      }));

      setNotifications(transformedNotifications);
      
      // Count unread notifications
      const unread = transformedNotifications.filter(n => !n.is_read).length;
      setUnreadCount(unread);

    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err.message);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.id) return;

    try {
      // Insert into notification_reads table
      const { error } = await supabase
        .from('notification_reads')
        .upsert({
          notification_id: notificationId,
          user_id: user.id,
          read_at: new Date().toISOString()
        }, {
          onConflict: 'notification_id,user_id'
        });

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, is_read: true, read_at: new Date().toISOString() }
          : notification
      ));

      setUnreadCount(prev => Math.max(0, prev - 1));

    } catch (err: any) {
      console.error('Error marking notification as read:', err);
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    }
  }, [user?.id, toast]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      
      if (unreadNotifications.length === 0) return;

      // Insert read records for all unread notifications
      const readRecords = unreadNotifications.map(n => ({
        notification_id: n.id,
        user_id: user.id,
        read_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('notification_reads')
        .upsert(readRecords, {
          onConflict: 'notification_id,user_id'
        });

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        is_read: true,
        read_at: new Date().toISOString()
      })));

      setUnreadCount(0);

      toast({
        title: "Success",
        description: "All notifications marked as read",
      });

    } catch (err: any) {
      console.error('Error marking all notifications as read:', err);
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    }
  }, [user?.id, notifications, toast]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user?.id) return;

    try {
      const deletedNotification = notifications.find(n => n.id === notificationId);
      
      // Delete from database (cascade will delete notification_reads too)
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

    } catch (err: any) {
      console.error('Error deleting notification:', err);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    }
  }, [user?.id, notifications, toast]);

  const refreshNotifications = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          
          const newNotification = payload.new as any;
          
          // Add to notifications list
          setNotifications(prev => [{
            id: newNotification.id,
            type: newNotification.type,
            title: newNotification.title,
            message: newNotification.message,
            data: newNotification.data,
            agent_id: newNotification.agent_id,
            channel_id: newNotification.channel_id,
            created_at: newNotification.created_at,
            is_read: false,
            read_at: null,
          }, ...prev]);
          
          setUnreadCount(prev => prev + 1);

          // Show toast notification for agent responses
          if (newNotification.type === 'agent_response') {
            sonnerToast(newNotification.title, {
              description: newNotification.message,
              duration: 5000,
              action: {
                label: 'View',
                onClick: () => {
                  // Let the notification center handle navigation
                  // User can click on the notification in the center
                }
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  };
}

export function useNotificationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Convert array to object keyed by notification_type
      const settingsMap: Record<string, any> = {};
      data?.forEach(setting => {
        settingsMap[setting.notification_type] = {
          enabled: setting.enabled,
          email_enabled: setting.email_enabled,
        };
      });

      setSettings(settingsMap);
    } catch (err: any) {
      console.error('Error fetching notification settings:', err);
      toast({
        title: "Error",
        description: "Failed to load notification settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  const updateSetting = useCallback(async (
    notificationType: NotificationType,
    updates: { enabled?: boolean; email_enabled?: boolean }
  ) => {
    if (!user?.id) return;

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('user_notification_settings')
        .update(updates)
        .eq('user_id', user.id)
        .eq('notification_type', notificationType);

      if (error) throw error;

      // Update local state
      setSettings(prev => ({
        ...prev,
        [notificationType]: {
          ...prev[notificationType],
          ...updates,
        },
      }));
    } catch (err: any) {
      console.error('Error updating notification setting:', err);
      throw err;
    }
  }, [user?.id]);

  const enableAll = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase
        .from('user_notification_settings')
        .update({ enabled: true })
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setSettings(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = { ...updated[key], enabled: true };
        });
        return updated;
      });
    } catch (err: any) {
      console.error('Error enabling all notifications:', err);
      throw err;
    }
  }, [user?.id]);

  const disableAll = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { error } = await supabase
        .from('user_notification_settings')
        .update({ enabled: false })
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setSettings(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = { ...updated[key], enabled: false };
        });
        return updated;
      });
    } catch (err: any) {
      console.error('Error disabling all notifications:', err);
      throw err;
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    updateSetting,
    enableAll,
    disableAll,
    refreshSettings: fetchSettings,
  };
}