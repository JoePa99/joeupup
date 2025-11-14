import React, { useState } from 'react';
import { Mail, Send, TestTube, CheckCircle, XCircle, AlertCircle, User, Hash, Bot } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TestResult {
  success: boolean;
  message: string;
  messageId?: string;
}

export function EmailIntegrationTest() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const [testData, setTestData] = useState({
    recipientEmail: '',
    recipientName: 'Test User',
    senderName: user?.user_metadata?.full_name || 'Test Sender',
    channelName: 'test-channel',
    messagePreview: 'This is a test email to verify the email integration is working correctly.',
    jumpUrl: window.location.origin
  });

  const testEmailTypes = [
    {
      type: 'mention',
      label: 'Mention Notification',
      description: 'Test email when user is mentioned',
      icon: User,
      color: 'bg-blue-100 text-blue-800'
    },
    {
      type: 'channel_message',
      label: 'Channel Message',
      description: 'Test email for new channel messages',
      icon: Hash,
      color: 'bg-purple-100 text-purple-800'
    },
    {
      type: 'agent_response',
      label: 'Agent Response',
      description: 'Test email for AI agent responses',
      icon: Bot,
      color: 'bg-green-100 text-green-800'
    },
    {
      type: 'channel_created',
      label: 'Channel Created',
      description: 'Test email when added to new channel',
      icon: Hash,
      color: 'bg-orange-100 text-orange-800'
    },
    {
      type: 'admin_onboarding_request',
      label: 'Admin Onboarding Request',
      description: 'Test email for custom onboarding requests',
      icon: Mail,
      color: 'bg-amber-100 text-amber-800'
    }
  ];

  const sendTestEmail = async (emailType: string) => {
    if (!testData.recipientEmail) {
      toast({
        title: "Email required",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setTestResults(prev => ({ ...prev, [emailType]: { success: false, message: 'Sending...' } }));

    try {
      let requestBody;
      
      if (emailType === 'admin_onboarding_request') {
        requestBody = {
          type: 'admin_onboarding_request',
          data: {
            recipientEmail: testData.recipientEmail,
            recipientName: testData.recipientName,
            requesterName: 'Test Requester',
            requesterEmail: 'test@example.com',
            companyName: 'Test Company',
            requestDetails: 'This is a test onboarding request to verify the email integration is working correctly.\n\nCompany: Test Company\nContact: Test Requester (test@example.com)\nIndustry: Technology\nCompany Size: 10-50 employees\n\nBusiness Background:\nWe are a technology company looking to implement AI-powered solutions.\n\nGoals & Objectives:\n- Improve customer service\n- Automate routine tasks\n- Increase efficiency\n\nCurrent Challenges:\n- Manual processes\n- Limited automation\n- High response times\n\nTarget Market:\nSmall to medium businesses\n\nCompetitive Landscape:\nCompeting with established players in the market\n\nPreferred Meeting Times:\nWeekdays 9 AM - 5 PM EST\n\nAdditional Notes:\nThis is a test request for email integration verification.',
            requestDate: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            adminDashboardUrl: `${window.location.origin}/admin/onboarding`
          }
        };
      } else {
        requestBody = {
          type: 'notification',
          data: {
            notificationType: emailType,
            recipientEmail: testData.recipientEmail,
            recipientName: testData.recipientName,
            senderName: testData.senderName,
            channelName: testData.channelName,
            messagePreview: testData.messagePreview,
            jumpUrl: testData.jumpUrl
          }
        };
      }

      const { error } = await supabase.functions.invoke('send-email', {
        body: requestBody
      });

      if (error) {
        throw error;
      }

      setTestResults(prev => ({
        ...prev,
        [emailType]: {
          success: true,
          message: 'Email sent successfully! Check your inbox.'
        }
      }));

      toast({
        title: "Test email sent",
        description: `${emailType} test email has been sent successfully.`,
      });
    } catch (error) {
      console.error(`Error sending ${emailType} test email:`, error);
      setTestResults(prev => ({
        ...prev,
        [emailType]: {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to send email'
        }
      }));

      toast({
        title: "Error",
        description: `Failed to send ${emailType} test email.`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendAllTestEmails = async () => {
    if (!testData.recipientEmail) {
      toast({
        title: "Email required",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setTestResults({});

    for (const emailType of testEmailTypes) {
      await sendTestEmail(emailType.type);
      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="h-5 w-5" />
            <span>Email Integration Test</span>
          </CardTitle>
          <CardDescription>
            Test the Resend email integration with different notification types
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Test Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="recipient-email">Recipient Email *</Label>
                <Input
                  id="recipient-email"
                  type="email"
                  placeholder="test@example.com"
                  value={testData.recipientEmail}
                  onChange={(e) => setTestData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="recipient-name">Recipient Name</Label>
                <Input
                  id="recipient-name"
                  placeholder="Test User"
                  value={testData.recipientName}
                  onChange={(e) => setTestData(prev => ({ ...prev, recipientName: e.target.value }))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="sender-name">Sender Name</Label>
                <Input
                  id="sender-name"
                  placeholder="Test Sender"
                  value={testData.senderName}
                  onChange={(e) => setTestData(prev => ({ ...prev, senderName: e.target.value }))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  placeholder="test-channel"
                  value={testData.channelName}
                  onChange={(e) => setTestData(prev => ({ ...prev, channelName: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="message-preview">Message Preview</Label>
              <Textarea
                id="message-preview"
                placeholder="Test message content..."
                value={testData.messagePreview}
                onChange={(e) => setTestData(prev => ({ ...prev, messagePreview: e.target.value }))}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Test Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={sendAllTestEmails}
              disabled={isLoading || !testData.recipientEmail}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <TestTube className="h-4 w-4 mr-2 animate-spin" />
                  Sending All Tests...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send All Test Emails
                </>
              )}
            </Button>
          </div>

          <Separator />

          {/* Individual Test Types */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Individual Test Types</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testEmailTypes.map((emailType) => {
                const Icon = emailType.icon;
                const result = testResults[emailType.type];
                
                return (
                  <div key={emailType.type} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{emailType.label}</h4>
                          <p className="text-xs text-muted-foreground">{emailType.description}</p>
                        </div>
                      </div>
                      <Badge className={emailType.color}>
                        {emailType.type}
                      </Badge>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendTestEmail(emailType.type)}
                      disabled={isLoading || !testData.recipientEmail}
                      className="w-full"
                    >
                      <Mail className="h-3 w-3 mr-2" />
                      Test {emailType.label}
                    </Button>
                    
                    {result && (
                      <div className={`flex items-start space-x-2 mt-3 p-2 rounded text-xs ${
                        result.success 
                          ? 'bg-green-50 text-green-800' 
                          : 'bg-red-50 text-red-800'
                      }`}>
                        {result.success ? (
                          <CheckCircle className="h-3 w-3 mt-0.5" />
                        ) : (
                          <XCircle className="h-3 w-3 mt-0.5" />
                        )}
                        <span>{result.message}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm text-blue-900 mb-1">
                  Configuration Requirements
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• RESEND_API_KEY environment variable must be set</li>
                  <li>• RESEND_FROM_EMAIL environment variable must be set</li>
                  <li>• send-email Edge Function must be deployed</li>
                  <li>• Email domain must be verified in Resend</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
