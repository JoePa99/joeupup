import React from 'react';
import { Bell, Check, CheckCheck, Trash2, AtSign, MessageSquare, Hash, Settings as SettingsIcon, Bot, FileText, BookOpen, AlertTriangle, UserPlus, UserMinus, Link, AlertCircle, Webhook } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationData, NotificationType } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// Get icon for notification type
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'mention':
      return AtSign;
    case 'channel_message':
      return MessageSquare;
    case 'channel_created':
      return Hash;
    case 'channel_updated':
      return SettingsIcon;
    case 'agent_response':
      return Bot;
    case 'document_shared':
      return FileText;
    case 'playbook_updated':
      return BookOpen;
    case 'system_alert':
      return AlertTriangle;
    case 'member_added':
      return UserPlus;
    case 'member_removed':
      return UserMinus;
    case 'integration_connected':
      return Link;
    case 'integration_error':
      return AlertCircle;
    case 'webhook_received':
      return Webhook;
    default:
      return Bell;
  }
}

// Get color for notification type
function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'mention':
      return 'text-blue-600 bg-blue-50';
    case 'channel_message':
      return 'text-green-600 bg-green-50';
    case 'channel_created':
      return 'text-purple-600 bg-purple-50';
    case 'channel_updated':
      return 'text-orange-600 bg-orange-50';
    case 'agent_response':
      return 'text-indigo-600 bg-indigo-50';
    case 'document_shared':
      return 'text-gray-600 bg-gray-50';
    case 'playbook_updated':
      return 'text-teal-600 bg-teal-50';
    case 'system_alert':
      return 'text-red-600 bg-red-50';
    case 'member_added':
      return 'text-emerald-600 bg-emerald-50';
    case 'member_removed':
      return 'text-rose-600 bg-rose-50';
    case 'integration_connected':
      return 'text-cyan-600 bg-cyan-50';
    case 'integration_error':
      return 'text-red-600 bg-red-50';
    case 'webhook_received':
      return 'text-violet-600 bg-violet-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    is_read?: boolean;
    read_at?: string | null;
  };
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (notification: any) => void;
}

function NotificationItem({ notification, onMarkAsRead, onDelete, onNavigate }: NotificationItemProps) {
  const Icon = getNotificationIcon(notification.type as NotificationType);
  const colorClasses = getNotificationColor(notification.type as NotificationType);
  
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    onNavigate(notification);
  };

  return (
    <div className={cn(
      "group relative border-l-4 transition-all duration-200 hover:bg-gray-50 cursor-pointer",
      notification.is_read ? "border-l-gray-200 opacity-60" : "border-l-blue-500 bg-blue-50/30"
    )}>
      <div className="p-4" onClick={handleClick}>
        <div className="flex items-start space-x-3">
          {/* Icon */}
          <div className={cn("p-2 rounded-full", colorClasses)}>
            <Icon className="h-4 w-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 truncate">
                {notification.title}
              </p>
              <div className="flex items-center space-x-1">
                {!notification.is_read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(notification.read_at || new Date()), { addSuffix: true })}
                </span>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {notification.message}
            </p>

            {/* Channel/Context info - simplified */}
            <div className="flex items-center mt-2 space-x-2">
              <Badge variant="outline" className="text-xs">
                {notification.type}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center space-x-1">
          {!notification.is_read && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAsRead(notification.id);
                    }}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mark as read</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

interface NotificationCenterProps {
  children?: React.ReactNode;
}

export function NotificationCenter({ children }: NotificationCenterProps) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();

  const handleNavigate = (notification: NotificationData) => {
    // Debug logging to understand notification structure
    console.log('🔍 [NOTIFICATION] Full notification object:', notification);
    console.log('🔍 [NOTIFICATION] Type:', notification.type);
    console.log('🔍 [NOTIFICATION] Agent ID:', notification.agent_id);
    console.log('🔍 [NOTIFICATION] Channel ID:', notification.channel_id);
    console.log('🔍 [NOTIFICATION] Data:', notification.data);
    console.log('🔍 [NOTIFICATION] Jump URL:', notification.data?.jump_url);

    // Navigate based on notification data
    if (notification.data?.jump_url && notification.data.jump_url !== null) {
      // Use the jump_url from notification data
      const url = notification.data.jump_url as string;
      console.log('🔍 [NOTIFICATION] Using jump_url:', url);
      if (url.startsWith('/')) {
        navigate(url);
      } else {
        window.open(url, '_blank');
      }
    } else if (notification.type === 'agent_response') {
      // For agent responses, always go to client dashboard
      // Try to get agent_id from notification.agent_id first, then from message
      const agentId = notification.agent_id;
      if (agentId) {
        console.log('🔍 [NOTIFICATION] Agent response - using agent_id:', agentId);
        navigate(`/client-dashboard?agent=${agentId}`);
      } else {
        // Fallback: try to get agent_id from the message if we have message_id
        console.log('🔍 [NOTIFICATION] Agent response - no agent_id, redirecting to client dashboard');
        navigate('/client-dashboard');
      }
    } else if (notification.agent_id) {
      // Navigate to client dashboard with agent parameter for any agent-related notifications
      console.log('🔍 [NOTIFICATION] Using agent_id navigation:', notification.agent_id);
      navigate(`/client-dashboard?agent=${notification.agent_id}`);
    } else if (notification.channel_id) {
      // Navigate to channel
      console.log('🔍 [NOTIFICATION] Using channel_id navigation:', notification.channel_id);
      navigate(`/channels/${notification.channel_id}`);
    } else {
      // Default navigation
      console.log('🔍 [NOTIFICATION] Using default navigation to /dashboard');
      navigate('/dashboard');
    }
  };

  const trigger = children || (
    <Button variant="ghost" size="sm" className="relative">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 bg-white " align="end" side="right" sideOffset={22}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Stay updated with mentions, messages, and activity
              </p>
            </div>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount} unread
              </Badge>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshNotifications}
            disabled={loading}
          >
            Refresh
          </Button>
          
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="text-blue-600 hover:text-blue-700"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 px-4">
            <p className="text-red-600 text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={refreshNotifications} className="mt-2">
              Try again
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">No notifications yet</p>
            <p className="text-gray-400 text-xs mt-1">
              You'll see mentions, messages, and activity here
            </p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Simplified notification badge component for use in navbar/sidebar
interface NotificationBadgeProps {
  className?: string;
}

export function NotificationBadge({ className }: NotificationBadgeProps) {
  const { unreadCount } = useNotifications();

  return (
    <NotificationCenter>
      <Button variant="ghost" size="sm" className={cn("relative", className)}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>
    </NotificationCenter>
  );
}
