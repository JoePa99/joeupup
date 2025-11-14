import React, { useState } from 'react';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface EmailSettingsProps {
  className?: string;
}

const EmailSettings = ({ className }: EmailSettingsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleToggleEmails = async (enabled: boolean) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // For now, just update local state
      // In the future, this would call the backend to update notification preferences
      setEmailEnabled(enabled);
      
      console.log(`Email notifications ${enabled ? 'enabled' : 'disabled'} for user ${user.id}`);
      
      toast({
        title: "Email Settings Updated",
        description: `Email notifications have been ${enabled ? 'enabled' : 'disabled'}`,
      });
      
    } catch (error) {
      console.error('Error updating email settings:', error);
      toast({
        title: "Error",
        description: "Failed to update email settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>
          Manage your email notification preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email-notifications">
              Email Notifications
            </Label>
            <div className="text-sm text-muted-foreground">
              Receive notifications via email
            </div>
          </div>
          <Switch
            id="email-notifications"
            checked={emailEnabled}
            onCheckedChange={handleToggleEmails}
            disabled={loading}
          />
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            When enabled, you'll receive email notifications for:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Agent responses</li>
            <li>System alerts</li>
            <li>Integration updates</li>
            <li>Mentions in channels</li>
          </ul>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Updating settings...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailSettings;