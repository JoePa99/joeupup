import React from 'react';
import { BellIcon, AtSymbolIcon, ChatBubbleLeftRightIcon, HashtagIcon, Cog6ToothIcon, CpuChipIcon, DocumentTextIcon, BookOpenIcon, ExclamationTriangleIcon, UserPlusIcon, UserMinusIcon, LinkIcon, ExclamationCircleIcon, RssIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { Bell, Mail, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useNotificationSettings } from '@/hooks/useNotifications';
import { NotificationType, getNotificationTitle, getNotificationMessage } from '@/lib/notifications';
import { useToast } from '@/hooks/use-toast';

// Get icon for notification type
function getNotificationTypeIcon(type: NotificationType) {
  switch (type) {
    case 'mention':
      return AtSymbolIcon;
    case 'channel_message':
      return ChatBubbleLeftRightIcon;
    case 'channel_created':
      return HashtagIcon;
    case 'channel_updated':
      return Cog6ToothIcon;
    case 'agent_response':
      return CpuChipIcon;
    case 'document_shared':
      return DocumentTextIcon;
    case 'playbook_updated':
      return BookOpenIcon;
    case 'system_alert':
      return ExclamationTriangleIcon;
    case 'member_added':
      return UserPlusIcon;
    case 'member_removed':
      return UserMinusIcon;
    case 'integration_connected':
      return LinkIcon;
    case 'integration_error':
      return ExclamationCircleIcon;
    case 'webhook_received':
      return RssIcon;
    default:
      return BellIcon;
  }
}

// Get priority label for notification type
function getPriorityLabel(type: NotificationType): { label: string; color: string } {
  switch (type) {
    case 'mention':
    case 'system_alert':
    case 'integration_error':
      return { label: 'High', color: 'bg-red-100 text-red-800' };
    case 'agent_response':
    case 'channel_message':
    case 'document_shared':
    case 'playbook_updated':
      return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
    default:
      return { label: 'Low', color: 'bg-gray-100 text-gray-800' };
  }
}

// Get description for notification type
function getNotificationDescription(type: NotificationType): string {
  switch (type) {
    case 'mention':
      return 'When someone mentions you in a message';
    case 'channel_message':
      return 'New messages in channels you\'re a member of';
    case 'channel_created':
      return 'When you\'re added to a new channel';
    case 'channel_updated':
      return 'When channel settings are updated';
    case 'agent_response':
      return 'When AI agents respond to messages';
    case 'document_shared':
      return 'When documents are shared in channels';
    case 'playbook_updated':
      return 'When playbooks are updated';
    case 'system_alert':
      return 'Important system-wide notifications';
    case 'member_added':
      return 'When new members join channels';
    case 'member_removed':
      return 'When members leave channels';
    case 'integration_connected':
      return 'When integrations are connected';
    case 'integration_error':
      return 'When integration errors occur';
    case 'webhook_received':
      return 'When webhooks are received';
    default:
      return 'General notifications';
  }
}

// All notification types grouped by category
const notificationCategories = {
  'Communication': [
    'mention' as NotificationType,
    'channel_message' as NotificationType,
    'agent_response' as NotificationType,
  ],
  'Channel Activity': [
    'channel_created' as NotificationType,
    'channel_updated' as NotificationType,
    'member_added' as NotificationType,
    'member_removed' as NotificationType,
  ],
  'Content & Documents': [
    'document_shared' as NotificationType,
    'playbook_updated' as NotificationType,
  ],
  'System & Integrations': [
    'system_alert' as NotificationType,
    'integration_connected' as NotificationType,
    'integration_error' as NotificationType,
    'webhook_received' as NotificationType,
  ],
};

interface NotificationTypeSettingProps {
  type: NotificationType;
  setting: any;
  onUpdate: (type: NotificationType, updates: any) => void;
}

function NotificationTypeSetting({ type, setting, onUpdate }: NotificationTypeSettingProps) {
  const Icon = getNotificationTypeIcon(type);
  const priority = getPriorityLabel(type);
  const description = getNotificationDescription(type);
  
  const currentSetting = setting || {
    enabled: true,
    email_enabled: false,
  };

  return (
    <div className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-start space-x-3 flex-1">
        <div className="p-2 bg-gray-100 rounded-lg">
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-medium text-sm text-gray-900">
              {getNotificationTitle(type, {})}
            </h4>
            <Badge className={`text-xs ${priority.color}`}>
              {priority.label}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {description}
          </p>
          
          {/* Delivery method controls */}
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <Bell className="h-3 w-3 text-gray-400" />
              <span className="text-gray-500">In-app</span>
            </div>
            {currentSetting.email_enabled && (
              <div className="flex items-center space-x-1">
                <Mail className="h-3 w-3 text-blue-500" />
                <span className="text-blue-600">Email</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col space-y-3 ml-4">
        {/* Main toggle */}
        <div className="flex items-center space-x-2">
          <Switch
            checked={currentSetting.enabled}
            onCheckedChange={(enabled) => onUpdate(type, { ...currentSetting, enabled })}
          />
          <Label className="text-sm">Enabled</Label>
        </div>
        
        {/* Email toggle */}
        <div className="flex items-center space-x-2">
          <Switch
            checked={currentSetting.email_enabled && currentSetting.enabled}
            disabled={!currentSetting.enabled}
            onCheckedChange={(email_enabled) => onUpdate(type, { ...currentSetting, email_enabled })}
          />
          <Mail className="h-3 w-3 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

export function NotificationSettings() {
  const { toast } = useToast();
  const { settings, loading, updateSetting, enableAll, disableAll } = useNotificationSettings();

  const handleUpdate = async (type: NotificationType, updates: any) => {
    try {
      await updateSetting(type, updates);
      toast({
        title: "Settings updated",
        description: `Notification preferences for ${type} have been updated.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update notification settings.",
        variant: "destructive",
      });
    }
  };

  const handleEnableAll = async () => {
    try {
      await enableAll();
      toast({
        title: "All notifications enabled",
        description: "All notification types have been enabled.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to enable all notifications.",
        variant: "destructive",
      });
    }
  };

  const handleDisableAll = async () => {
    try {
      await disableAll();
      toast({
        title: "All notifications disabled",
        description: "All notification types have been disabled.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disable all notifications.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="shadow-none border border-gray-200">
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Notification Settings</span>
            </CardTitle>
            <CardDescription>
              Manage how and when you receive notifications
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={handleEnableAll}>
              Enable All
            </Button>
            <Button variant="outline" size="sm" onClick={handleDisableAll}>
              Disable All
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Delivery Methods Legend */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-sm text-gray-900 mb-3">Delivery Methods</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-gray-600" />
              <span className="text-gray-700">In-app notifications</span>
            </div>
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <span className="text-gray-700">Email notifications</span>
            </div>
          </div>
        </div>

        {/* Notification Categories */}
        {Object.entries(notificationCategories).map(([category, types]) => (
          <div key={category}>
            <h3 className="font-semibold text-lg text-gray-900 mb-4 flex items-center space-x-2">
              <span>{category}</span>
              <Badge variant="outline" className="text-xs">
                {types.length} types
              </Badge>
            </h3>
            
            <div className="space-y-3">
              {types.map((type) => (
                <NotificationTypeSetting
                  key={type}
                  type={type}
                  setting={settings[type]}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
            
            <Separator className="mt-6" />
          </div>
        ))}

        {/* Global Settings */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-sm text-blue-900 mb-1">
                Important Notice
              </h4>
              <p className="text-sm text-blue-800">
                High-priority notifications (mentions, system alerts, and integration errors) 
                are recommended to remain enabled to ensure you don't miss critical updates.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
