import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  type: 'notification' | 'welcome' | 'password_reset' | 'admin_onboarding_request' | 'team_invitation' | 'consultation_document_request';
  data: {
    // Notification email data
    notificationType?: 'mention' | 'channel_message' | 'agent_response' | 'channel_created' | 'channel_updated' | 'document_shared' | 'playbook_updated' | 'system_alert' | 'member_added' | 'member_removed' | 'integration_connected' | 'integration_error' | 'webhook_received';
    recipientEmail: string;
    recipientName: string;
    senderName?: string;
    channelName?: string;
    messagePreview?: string;
    jumpUrl?: string;
    documentName?: string;
    alertTitle?: string;
    message?: string;
    memberName?: string;
    integrationName?: string;
    errorMessage?: string;
    webhookSource?: string;
    
    // Welcome email data
    companyName?: string;
    loginUrl?: string;
    onboardingType?: 'custom' | 'self_service';
    
    // Password reset data
    resetUrl?: string;
    expiresIn?: string;
    
    // Admin onboarding request data
    requesterName?: string;
    requesterEmail?: string;
    requestDetails?: string;
    requestDate?: string;
    adminDashboardUrl?: string;
    
    // Team invitation data
    inviterName?: string;
    invitationUrl?: string;
    personalMessage?: string;
    role?: string;
    
    // Consultation document request data
    documentsRequested?: string[];
    requestDate?: string;
  };
}

// Email templates (simplified for Edge Function)
const emailTemplates = {
  mention: (data: any) => ({
    subject: `You were mentioned by ${data.senderName} in #${data.channelName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You were mentioned</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .message-preview { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>You were mentioned!</h1>
            <p>${data.senderName} mentioned you in #${data.channelName}</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <p>You were mentioned in a message:</p>
            <div class="message-preview">
              <strong>${data.senderName}:</strong> "${data.messagePreview}"
            </div>
            <a href="${data.jumpUrl}" class="button">View Message</a>
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `You were mentioned by ${data.senderName} in #${data.channelName}\n\nMessage: "${data.messagePreview}"\n\nView message: ${data.jumpUrl}`
  }),

  channel_message: (data: any) => ({
    subject: `New message in #${data.channelName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New message</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .message-preview { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 20px 0; }
            .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>New message in #${data.channelName}</h1>
            <p>${data.senderName} sent a message</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <p>There's a new message in #${data.channelName}:</p>
            <div class="message-preview">
              <strong>${data.senderName}:</strong> "${data.messagePreview}"
            </div>
            <a href="${data.jumpUrl}" class="button">View Message</a>
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `New message in #${data.channelName}\n\n${data.senderName}: "${data.messagePreview}"\n\nView message: ${data.jumpUrl}`
  }),

  agent_response: (data: any) => ({
    subject: `AI Agent responded in #${data.channelName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>AI Agent Response</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .message-preview { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #059669; margin: 20px 0; }
            .button { display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🤖 AI Agent Response</h1>
            <p>An AI agent responded in #${data.channelName}</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <p>An AI agent has responded in #${data.channelName}:</p>
            <div class="message-preview">
              <strong>AI Agent:</strong> "${data.messagePreview}"
            </div>
            <a href="${data.jumpUrl}" class="button">View Response</a>
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `AI Agent responded in #${data.channelName}\n\nAI Agent: "${data.messagePreview}"\n\nView response: ${data.jumpUrl}`
  }),

  channel_created: (data: any) => ({
    subject: `You were added to #${data.channelName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Added to channel</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to #${data.channelName}!</h1>
            <p>You were added by ${data.senderName}</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <p>You've been added to a new channel: <strong>#${data.channelName}</strong></p>
            <p>Start collaborating with your team!</p>
            <a href="${data.jumpUrl}" class="button">Join Channel</a>
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `You were added to #${data.channelName}\n\nYou were added by ${data.senderName}. Join the channel: ${data.jumpUrl}`
  }),

  channel_updated: (data: any) => ({
    subject: `#${data.channelName} was updated`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Channel Updated</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Channel Settings Updated</h1>
            <p>#${data.channelName} was updated by ${data.senderName}</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <p>The settings for <strong>#${data.channelName}</strong> have been updated.</p>
            <a href="${data.jumpUrl}" class="button">View Channel</a>
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `#${data.channelName} was updated\n\n${data.senderName} updated the channel settings.\n\nView channel: ${data.jumpUrl}`
  }),

  document_shared: (data: any) => ({
    subject: `Document shared: ${data.documentName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Shared</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .document-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📄 Document Shared</h1>
            <p>${data.senderName} shared a document</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <div class="document-box">
              <strong>${data.documentName}</strong>
            </div>
            <p>${data.senderName} shared this document with your team.</p>
            <a href="${data.jumpUrl}" class="button">View Document</a>
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `Document Shared: ${data.documentName}\n\n${data.senderName} shared this document with your team.\n\nView document: ${data.jumpUrl}`
  }),

  playbook_updated: (data: any) => ({
    subject: `Playbook updated`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Playbook Updated</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📖 Playbook Updated</h1>
            <p>Company playbook has been updated</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <p>${data.senderName} updated the company playbook.</p>
            <p>Review the latest changes to stay aligned with company processes and best practices.</p>
            <a href="${data.jumpUrl}" class="button">View Playbook</a>
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `Playbook Updated\n\n${data.senderName} updated the company playbook.\n\nView playbook: ${data.jumpUrl}`
  }),

  system_alert: (data: any) => ({
    subject: `System Alert: ${data.alertTitle || 'Important Notice'}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>System Alert</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .alert-box { background: #fee2e2; border: 2px solid #ef4444; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>⚠️ System Alert</h1>
            <p>Important system notification</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <div class="alert-box">
              <strong>${data.alertTitle || 'System Notice'}</strong><br>
              <p style="margin: 10px 0 0 0;">${data.messagePreview || data.message}</p>
            </div>
            ${data.jumpUrl ? `<a href="${data.jumpUrl}" class="button">View Details</a>` : ''}
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an important system notification.</p>
          </div>
        </body>
      </html>
    `,
    text: `System Alert: ${data.alertTitle || 'Important Notice'}\n\n${data.messagePreview || data.message}\n\n${data.jumpUrl ? 'View details: ' + data.jumpUrl : ''}`
  }),

  member_added: (data: any) => ({
    subject: `${data.memberName} joined #${data.channelName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Member</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>👋 New Member</h1>
            <p>${data.memberName} joined #${data.channelName}</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <p><strong>${data.memberName}</strong> has joined <strong>#${data.channelName}</strong>.</p>
            <a href="${data.jumpUrl}" class="button">View Channel</a>
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `${data.memberName} joined #${data.channelName}\n\nView channel: ${data.jumpUrl}`
  }),

  member_removed: (data: any) => ({
    subject: `You were removed from #${data.channelName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Removed from Channel</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Channel Access Changed</h1>
            <p>You were removed from #${data.channelName}</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <p>You have been removed from <strong>#${data.channelName}</strong>.</p>
            <p>If you believe this was done in error, please contact your team administrator.</p>
            ${data.jumpUrl ? `<a href="${data.jumpUrl}" class="button">View Channels</a>` : ''}
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `You were removed from #${data.channelName}\n\n${data.jumpUrl ? 'View channels: ' + data.jumpUrl : ''}`
  }),

  integration_connected: (data: any) => ({
    subject: `${data.integrationName} connected successfully`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Integration Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .success-box { background: #d1fae5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>✅ Integration Connected</h1>
            <p>${data.integrationName} is now connected</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <div class="success-box">
              <strong>${data.integrationName}</strong> has been successfully connected to your account.
            </div>
            <p>You can now use this integration with Variable.</p>
            ${data.jumpUrl ? `<a href="${data.jumpUrl}" class="button">View Integrations</a>` : ''}
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `${data.integrationName} connected successfully\n\n${data.integrationName} has been connected to your account.\n\n${data.jumpUrl ? 'View integrations: ' + data.jumpUrl : ''}`
  }),

  integration_error: (data: any) => ({
    subject: `Integration Error: ${data.integrationName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Integration Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .error-box { background: #fee2e2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>⚠️ Integration Error</h1>
            <p>${data.integrationName} encountered an error</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <div class="error-box">
              <strong>Error with ${data.integrationName}</strong><br>
              <p style="margin: 10px 0 0 0;">${data.errorMessage || 'An error occurred with this integration.'}</p>
            </div>
            <p>Please check your integration settings and try reconnecting.</p>
            ${data.jumpUrl ? `<a href="${data.jumpUrl}" class="button">Fix Integration</a>` : ''}
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `Integration Error: ${data.integrationName}\n\n${data.errorMessage || 'An error occurred with this integration.'}\n\n${data.jumpUrl ? 'Fix integration: ' + data.jumpUrl : ''}`
  }),

  webhook_received: (data: any) => ({
    subject: `Webhook received from ${data.webhookSource}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Webhook Received</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .webhook-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔗 Webhook Received</h1>
            <p>New webhook from ${data.webhookSource}</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <div class="webhook-box">
              <strong>Source:</strong> ${data.webhookSource}<br>
              ${data.messagePreview ? `<p style="margin: 10px 0 0 0;">${data.messagePreview}</p>` : ''}
            </div>
            ${data.jumpUrl ? `<a href="${data.jumpUrl}" class="button">View Details</a>` : ''}
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. You can manage your email preferences in your account settings.</p>
          </div>
        </body>
      </html>
    `,
    text: `Webhook received from ${data.webhookSource}\n\n${data.messagePreview || 'A webhook was received from an external service.'}\n\n${data.jumpUrl ? 'View details: ' + data.jumpUrl : ''}`
  }),

  welcome: (data: any) => {
    const isCustomOnboarding = data.onboardingType === 'custom';
    const isSelfService = data.onboardingType === 'self_service';
    
    return {
      subject: `Welcome to Variable!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Variable</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; text-align: center; }
              .content { background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              .features { margin: 30px 0; }
              .feature { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
              .highlight-box { background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .timeline { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .timeline-item { display: flex; gap: 15px; margin-bottom: 15px; }
              .timeline-icon { width: 40px; height: 40px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🎉 Welcome to Variable!</h1>
              <p>Your AI-powered collaboration platform</p>
            </div>
            <div class="content">
              <p>Hi ${data.recipientName},</p>
              <p>Welcome to Variable! You're now part of <strong>${data.companyName}</strong> and ${isCustomOnboarding ? 'have chosen our premium consulting service' : isSelfService ? 'are ready to start with self-service onboarding' : 'ready to start collaborating with your team'}.</p>
              
              ${isCustomOnboarding ? `
                <div class="highlight-box">
                  <h3 style="margin-top: 0;">✨ Premium Consulting Service Selected</h3>
                  <p style="margin-bottom: 0;">Our expert team will conduct comprehensive research on your business to create a detailed 70+ page knowledge base. You'll receive personalized guidance throughout the process.</p>
                </div>
                
                <div class="timeline">
                  <h3 style="margin-top: 0;">What Happens Next:</h3>
                  <div class="timeline-item">
                    <div class="timeline-icon">1</div>
                    <div>
                      <strong>Initial Consultation (24-48 hours)</strong><br>
                      <span style="color: #666;">Our team will contact you to schedule a detailed consultation and understand your business needs.</span>
                    </div>
                  </div>
                  <div class="timeline-item">
                    <div class="timeline-icon">2</div>
                    <div>
                      <strong>Research & Analysis (1-2 weeks)</strong><br>
                      <span style="color: #666;">We'll conduct comprehensive research including market analysis, competitor research, and business strategy review.</span>
                    </div>
                  </div>
                  <div class="timeline-item">
                    <div class="timeline-icon">3</div>
                    <div>
                      <strong>Knowledge Base Delivery</strong><br>
                      <span style="color: #666;">Receive your custom 70+ page knowledge base with mission, vision, SWOT analysis, and detailed business insights.</span>
                    </div>
                  </div>
                  <div class="timeline-item">
                    <div class="timeline-icon">4</div>
                    <div>
                      <strong>AI Agent Deployment</strong><br>
                      <span style="color: #666;">Your AI agents will be deployed with validated knowledge and ready to assist your team.</span>
                    </div>
                  </div>
                </div>
              ` : isSelfService ? `
                <div class="highlight-box">
                  <h3 style="margin-top: 0;">🚀 Quick Start with Self-Service</h3>
                  <p style="margin-bottom: 0;">You're all set! Your knowledge base has been created from your website analysis and uploaded documents. Your AI agents are ready to use.</p>
                </div>
                
                <div class="features">
                  <div class="feature">
                    <strong>✅ Knowledge Base Created</strong><br>
                    Your business information has been analyzed and processed
                  </div>
                  <div class="feature">
                    <strong>🤖 AI Agents Active</strong><br>
                    Your intelligent assistants are ready to help your team
                  </div>
                  <div class="feature">
                    <strong>📚 Enhanced Learning</strong><br>
                    Continue to upload documents to improve agent knowledge
                  </div>
                </div>
              ` : `
                <div class="features">
                  <div class="feature">
                    <strong>🤖 AI-Powered Agents</strong><br>
                    Get instant help from intelligent AI assistants
                  </div>
                  <div class="feature">
                    <strong>💬 Smart Channels</strong><br>
                    Organize conversations with @mentions and notifications
                  </div>
                  <div class="feature">
                    <strong>📚 Knowledge Base</strong><br>
                    Share and discover documents with your team
                  </div>
                </div>
              `}
              
              <a href="${data.loginUrl}" class="button">${isCustomOnboarding ? 'Access Your Dashboard' : 'Get Started Now'}</a>
              <p>Best regards,<br>The Variable Team</p>
            </div>
            <div class="footer">
              <p>Need help? Contact our support team or check out our documentation.</p>
            </div>
          </body>
        </html>
      `,
      text: `Welcome to Variable!\n\nHi ${data.recipientName},\n\nWelcome to Variable! You're now part of ${data.companyName}.${isCustomOnboarding ? '\n\nOur expert team will contact you within 24-48 hours to begin your custom onboarding process.' : isSelfService ? '\n\nYour knowledge base is ready and your AI agents are active!' : ''}\n\nGet started: ${data.loginUrl}\n\nBest regards,\nThe Variable Team`
    };
  },

  password_reset: (data: any) => ({
    subject: `Reset your Variable password`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔐 Password Reset</h1>
            <p>Reset your Variable password</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            <p>We received a request to reset your password for your Variable account.</p>
            <a href="${data.resetUrl}" class="button">Reset Password</a>
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in ${data.expiresIn}. If you didn't request this reset, please ignore this email.
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${data.resetUrl}</p>
            <p>Best regards,<br>The Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </body>
      </html>
    `,
    text: `Password Reset Request\n\nHi ${data.recipientName},\n\nWe received a request to reset your password.\n\nReset your password: ${data.resetUrl}\n\nThis link expires in ${data.expiresIn}.\n\nBest regards,\nThe Variable Team`
  }),

  team_invitation: (data: any) => ({
    subject: `${data.inviterName} invited you to join ${data.companyName} on Variable`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .invitation-card { background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #10b981; }
            .role-badge { background: #d1fae5; color: #065f46; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; margin: 10px 0; }
            .personal-message { background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; font-style: italic; }
            .features { margin: 25px 0; }
            .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; display: flex; align-items: start; gap: 15px; }
            .feature-icon { width: 40px; height: 40px; background: #d1fae5; color: #059669; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>👋 You're Invited!</h1>
            <p>Join your team on Variable</p>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            
            <div class="invitation-card">
              <p style="margin-top: 0;"><strong>${data.inviterName}</strong> has invited you to join <strong>${data.companyName}</strong> on Variable.</p>
              <div class="role-badge">${data.role.charAt(0).toUpperCase() + data.role.slice(1)} Role</div>
            </div>
            
            ${data.personalMessage ? `
              <div class="personal-message">
                <strong>Personal Message from ${data.inviterName}:</strong><br><br>
                "${data.personalMessage}"
              </div>
            ` : ''}
            
            <p>Variable is an AI-powered collaboration platform that helps teams work smarter with intelligent assistants, smart channels, and a comprehensive knowledge base.</p>
            
            <div class="features">
              <div class="feature">
                <div class="feature-icon">🤖</div>
                <div>
                  <strong>AI-Powered Agents</strong><br>
                  <span style="color: #666; font-size: 14px;">Get instant answers and assistance from intelligent AI agents</span>
                </div>
              </div>
              <div class="feature">
                <div class="feature-icon">💬</div>
                <div>
                  <strong>Smart Collaboration</strong><br>
                  <span style="color: #666; font-size: 14px;">Communicate with your team using channels and mentions</span>
                </div>
              </div>
              <div class="feature">
                <div class="feature-icon">📚</div>
                <div>
                  <strong>Knowledge Base</strong><br>
                  <span style="color: #666; font-size: 14px;">Access and share company documents and information</span>
                </div>
              </div>
            </div>
            
            <center>
              <a href="${data.invitationUrl}" class="button">Accept Invitation & Join Team</a>
            </center>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">This invitation link will expire in 7 days. If you have any questions, feel free to reach out to ${data.inviterName} or our support team.</p>
            
            <p>Best regards,<br>The Variable Team</p>
          </div>
          <div class="footer">
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `,
    text: `You're Invited to Join ${data.companyName}!\n\nHi ${data.recipientName},\n\n${data.inviterName} has invited you to join ${data.companyName} on Variable as a ${data.role}.\n\n${data.personalMessage ? `Personal message: "${data.personalMessage}"\n\n` : ''}Accept your invitation: ${data.invitationUrl}\n\nThis link expires in 7 days.\n\nBest regards,\nThe Variable Team`
  }),

  admin_onboarding_request: (data: any) => ({
    subject: `New Custom Onboarding Request - ${data.companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Onboarding Request</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .request-details { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
            .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .info-item { background: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb; }
            .info-label { font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .info-value { color: #111827; font-size: 14px; margin-top: 4px; }
            .priority-badge { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚀 New Onboarding Request</h1>
            <p>A new custom onboarding request has been submitted</p>
          </div>
          <div class="content">
            <div class="priority-badge">⚠️ Action Required</div>
            <p>Hello Admin,</p>
            <p>A new custom onboarding request has been submitted and requires your attention.</p>
            
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Company</div>
                <div class="info-value">${data.companyName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Request Date</div>
                <div class="info-value">${data.requestDate}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Requester Name</div>
                <div class="info-value">${data.requesterName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${data.requesterEmail}</div>
              </div>
            </div>

            <div class="request-details">
              <h3 style="margin-top: 0; color: #374151;">Request Details</h3>
              <p style="margin-bottom: 0; white-space: pre-wrap;">${data.requestDetails}</p>
            </div>

            <a href="${data.adminDashboardUrl}" class="button">Review in Admin Dashboard</a>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Review the onboarding request details</li>
              <li>Contact the requester if additional information is needed</li>
              <li>Set up the custom onboarding process</li>
              <li>Notify the requester once onboarding is complete</li>
            </ul>
            
            <p>Best regards,<br>Variable System</p>
          </div>
          <div class="footer">
            <p>This is an automated notification from the Variable admin system.</p>
          </div>
        </body>
      </html>
    `,
    text: `New Custom Onboarding Request\n\nCompany: ${data.companyName}\nRequester: ${data.requesterName} (${data.requesterEmail})\nDate: ${data.requestDate}\n\nRequest Details:\n${data.requestDetails}\n\nReview in Admin Dashboard: ${data.adminDashboardUrl}\n\nBest regards,\nVariable System`
  }),

  consultation_document_request: (data: any) => ({
    subject: `Document Request from Admin Team - ${data.companyName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Request</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .request-details { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .documents-list { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .documents-list ul { margin: 0; padding-left: 20px; }
            .priority-badge { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📄 Document Request</h1>
            <p>Your admin team has requested documents</p>
          </div>
          <div class="content">
            <div class="priority-badge">📋 Action Required</div>
            <p>Hi ${data.recipientName},</p>
            <p>Your admin team has requested specific documents for your consultation process.</p>
            
            <div class="request-details">
              <h3 style="margin-top: 0; color: #374151;">Request Details</h3>
              <p><strong>From:</strong> ${data.requesterName}</p>
              <p><strong>Date:</strong> ${data.requestDate}</p>
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap; background: #f9fafb; padding: 10px; border-radius: 4px; margin: 10px 0;">${data.message}</p>
            </div>

            ${data.documentsRequested && data.documentsRequested.length > 0 ? `
              <div class="documents-list">
                <h3 style="margin-top: 0; color: #92400e;">📋 Requested Documents:</h3>
                <ul>
                  ${data.documentsRequested.map((doc: string) => `<li>${doc}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            <a href="${data.jumpUrl}" class="button">View Consultation & Upload Documents</a>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Review the requested documents list</li>
              <li>Upload the documents through your consultation dashboard</li>
              <li>Contact your admin team if you have any questions</li>
            </ul>
            
            <p>Best regards,<br>Your Variable Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification from your consultation system.</p>
          </div>
        </body>
      </html>
    `,
    text: `Document Request from Admin Team\n\nHi ${data.recipientName},\n\nYour admin team has requested documents for your consultation process.\n\nFrom: ${data.requesterName}\nDate: ${data.requestDate}\n\nMessage:\n${data.message}\n\n${data.documentsRequested && data.documentsRequested.length > 0 ? `Requested Documents:\n${data.documentsRequested.map((doc: string) => `- ${doc}`).join('\n')}\n\n` : ''}View consultation: ${data.jumpUrl}\n\nBest regards,\nYour Variable Team`
  })
};

// Sanitize tag values to only contain ASCII letters, numbers, underscores, or dashes
function sanitizeTagValue(value: string): string {
  // Replace spaces and other invalid characters with underscores
  // Only allow: letters, numbers, underscores, and dashes
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Send email using Resend API
async function sendEmail(
  template: { subject: string; html: string; text: string },
  recipientEmail: string,
  recipientName: string,
  tags: Array<{ name: string; value: string }> = []
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Variable <noreply@yourdomain.com>';

    // Sanitize tag values to meet Resend's requirements
    const sanitizedTags = tags.map(tag => ({
      name: sanitizeTagValue(tag.name),
      value: sanitizeTagValue(tag.value)
    }));

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: template.subject,
        html: template.html,
        text: template.text,
        tags: sanitizedTags
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Resend API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      throw new Error(`Resend API error: ${errorData.message || response.statusText}`);
    }

    const result = await response.json();
    console.log('Email sent successfully:', { messageId: result.id, to: recipientEmail });
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Email sending error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check for required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseAnonKey: !!supabaseAnonKey,
      hasResendApiKey: !!resendApiKey,
      hasAuthHeader: !!req.headers.get('Authorization')
    });
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured');
    }
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      console.error('Auth error:', userError);
      throw new Error(`Unauthorized: ${userError.message}`);
    }
    if (!user) {
      throw new Error('Unauthorized: No user found');
    }
    
    console.log('User authenticated:', user.id);

    const { type, data }: EmailRequest = await req.json();
    console.log('Email request:', { type, hasData: !!data });

    if (!data.recipientEmail || !data.recipientName) {
      throw new Error('Recipient email and name are required');
    }

    let template;
    let tags: Array<{ name: string; value: string }> = [];

    switch (type) {
      case 'notification':
        if (!data.notificationType) {
          throw new Error('Notification type is required');
        }
        
        template = emailTemplates[data.notificationType](data);
        tags = [
          { name: 'type', value: 'notification' },
          { name: 'notification_type', value: data.notificationType }
        ];
        break;

      case 'welcome':
        template = emailTemplates.welcome(data);
        tags = [{ name: 'type', value: 'welcome' }];
        break;

      case 'password_reset':
        template = emailTemplates.password_reset(data);
        tags = [{ name: 'type', value: 'password_reset' }];
        break;

      case 'admin_onboarding_request':
        if (!data.requesterName || !data.requesterEmail || !data.companyName || !data.requestDetails) {
          throw new Error('Missing required data for admin_onboarding_request');
        }
        
        template = emailTemplates.admin_onboarding_request(data);
        tags = [
          { name: 'type', value: 'admin_notification' },
          { name: 'category', value: 'onboarding_request' }
        ];
        break;

      case 'team_invitation':
        if (!data.inviterName || !data.companyName || !data.invitationUrl || !data.role) {
          throw new Error('Missing required data for team_invitation');
        }
        
        template = emailTemplates.team_invitation(data);
        tags = [
          { name: 'type', value: 'team_invitation' },
          { name: 'company', value: data.companyName }
        ];
        break;

      case 'consultation_document_request':
        if (!data.recipientEmail || !data.recipientName || !data.requesterName || !data.message) {
          throw new Error('Missing required data for consultation_document_request');
        }
        
        template = emailTemplates.consultation_document_request(data);
        tags = [
          { name: 'type', value: 'consultation_document_request' },
          { name: 'company', value: data.companyName || 'unknown' }
        ];
        break;

      default:
        throw new Error(`Unsupported email type: ${type}`);
    }

    const result = await sendEmail(template, data.recipientEmail, data.recipientName, tags);

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.messageId 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Send email error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error message:', errorMessage);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
