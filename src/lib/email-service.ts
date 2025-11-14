import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailOptions {
  to: EmailRecipient | EmailRecipient[];
  from?: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface NotificationEmailData {
  recipientName: string;
  senderName: string;
  channelName: string;
  messagePreview: string;
  jumpUrl: string;
  notificationType: 'mention' | 'channel_message' | 'agent_response' | 'channel_created';
}

export interface WelcomeEmailData {
  recipientName: string;
  companyName: string;
  loginUrl: string;
  onboardingType?: 'custom' | 'self_service';
}

export interface TeamInvitationEmailData {
  recipientName: string;
  inviterName: string;
  companyName: string;
  invitationUrl: string;
  personalMessage?: string;
  role: string;
}

export interface PasswordResetEmailData {
  recipientName: string;
  resetUrl: string;
  expiresIn: string;
}

export interface AdminOnboardingRequestEmailData {
  requesterName: string;
  requesterEmail: string;
  companyName: string;
  requestDetails: string;
  requestDate: string;
  adminDashboardUrl: string;
}

/**
 * Email templates for different notification types
 */
export const emailTemplates = {
  mention: (data: NotificationEmailData): EmailTemplate => ({
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

  channel_message: (data: NotificationEmailData): EmailTemplate => ({
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

  agent_response: (data: NotificationEmailData): EmailTemplate => ({
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

  channel_created: (data: NotificationEmailData): EmailTemplate => ({
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

  welcome: (data: WelcomeEmailData): EmailTemplate => {
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

  team_invitation: (data: TeamInvitationEmailData): EmailTemplate => ({
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

  password_reset: (data: PasswordResetEmailData): EmailTemplate => ({
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

  admin_onboarding_request: (data: AdminOnboardingRequestEmailData): EmailTemplate => ({
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
  })
};

/**
 * Send an email using Resend
 */
export async function sendEmail(
  template: EmailTemplate,
  options: EmailOptions
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    const result = await resend.emails.send({
      from: options.from || process.env.RESEND_FROM_EMAIL || 'Variable <noreply@yourdomain.com>',
      to: Array.isArray(options.to) ? options.to.map(r => r.email) : [options.to.email],
      subject: template.subject,
      html: template.html,
      text: template.text,
      reply_to: options.replyTo,
      tags: options.tags
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Email sending error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Send a notification email
 */
export async function sendNotificationEmail(
  type: keyof typeof emailTemplates,
  data: any,
  recipientEmail: string,
  recipientName: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const template = emailTemplates[type](data);
  
  return sendEmail(template, {
    to: { email: recipientEmail, name: recipientName },
    tags: [
      { name: 'type', value: 'notification' },
      { name: 'notification_type', value: type }
    ]
  });
}

/**
 * Send a welcome email
 */
export async function sendWelcomeEmail(
  data: WelcomeEmailData,
  recipientEmail: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const template = emailTemplates.welcome(data);
  
  return sendEmail(template, {
    to: { email: recipientEmail, name: data.recipientName },
    tags: [
      { name: 'type', value: 'welcome' }
    ]
  });
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  data: PasswordResetEmailData,
  recipientEmail: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const template = emailTemplates.password_reset(data);
  
  return sendEmail(template, {
    to: { email: recipientEmail, name: data.recipientName },
    tags: [
      { name: 'type', value: 'password_reset' }
    ]
  });
}

/**
 * Send an admin onboarding request email
 */
export async function sendAdminOnboardingRequestEmail(
  data: AdminOnboardingRequestEmailData,
  adminEmail: string,
  adminName: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const template = emailTemplates.admin_onboarding_request(data);
  
  return sendEmail(template, {
    to: { email: adminEmail, name: adminName },
    tags: [
      { name: 'type', value: 'admin_notification' },
      { name: 'category', value: 'onboarding_request' }
    ]
  });
}

/**
 * Send a team invitation email
 */
export async function sendTeamInvitationEmail(
  data: TeamInvitationEmailData,
  recipientEmail: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const template = emailTemplates.team_invitation(data);
  
  return sendEmail(template, {
    to: { email: recipientEmail, name: data.recipientName },
    tags: [
      { name: 'type', value: 'team_invitation' },
      { name: 'company', value: data.companyName }
    ]
  });
}
