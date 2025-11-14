# Resend Email Integration

This document outlines the complete Resend email integration for transactional emails in the Knowledge Engine application.

## Overview

The email integration provides:
- **Transactional emails** for notifications, welcome messages, and password resets
- **HTML email templates** with responsive design
- **User preferences** for email notification settings
- **Edge Function integration** for server-side email sending
- **Test utilities** for verifying email delivery

## Architecture

```
Frontend (React) → Supabase Edge Function → Resend API → Email Delivery
```

### Components

1. **Email Service** (`src/lib/email-service.ts`)
   - Resend client initialization
   - Email template definitions
   - Email sending functions

2. **Edge Function** (`supabase/functions/send-email/index.ts`)
   - Server-side email sending
   - Template rendering
   - Error handling

3. **Notification Processor** (`supabase/functions/notification-processor/index.ts`)
   - Integrated email sending for notifications
   - User preference checking
   - Email data preparation

4. **UI Components**
   - `src/components/ui/email-settings.tsx` - Email configuration
   - `src/components/test/EmailIntegrationTest.tsx` - Testing utilities

## Setup Instructions

### 1. Environment Variables

Add the following environment variables:

```bash
# Resend Configuration
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=Knowledge Engine <noreply@yourdomain.com>

# Application Configuration
VITE_APP_URL=http://localhost:3000
```

### 2. Resend Account Setup

1. Create a Resend account at [resend.com](https://resend.com)
2. Verify your domain in the Resend dashboard
3. Generate an API key
4. Add the API key to your environment variables

### 3. Deploy Edge Functions

```bash
# Deploy the send-email function
supabase functions deploy send-email

# Deploy the updated notification-processor function
supabase functions deploy notification-processor
```

### 4. Database Setup

The email integration uses the existing notification system tables:

- `user_notification_settings` - Email preferences
- `notifications` - Notification records
- `profiles` - User email addresses

## Email Templates

### Available Templates

1. **Mention Notification**
   - Triggered when user is mentioned in a message
   - Includes message preview and jump link

2. **Channel Message**
   - Triggered for new messages in channels
   - Includes sender name and message preview

3. **Agent Response**
   - Triggered when AI agents respond
   - Includes agent response preview

4. **Channel Created**
   - Triggered when user is added to new channel
   - Includes channel name and creator info

5. **Welcome Email**
   - Triggered for new user onboarding
   - Includes company info and features

6. **Password Reset**
   - Triggered for password reset requests
   - Includes secure reset link

7. **Admin Onboarding Request**
   - Triggered when custom onboarding is requested
   - Includes detailed request information and admin dashboard link

### Template Features

- **Responsive design** - Works on desktop and mobile
- **Brand consistency** - Matches application design
- **Accessibility** - Proper contrast and screen reader support
- **Fallback content** - Plain text versions included

## Usage

### Sending Emails

#### From Frontend (Client-side)

```typescript
import { sendNotificationEmail } from '@/lib/email-service';

// Send a mention notification email
await sendNotificationEmail(
  'mention',
  {
    recipientName: 'John Doe',
    senderName: 'Jane Smith',
    channelName: 'general',
    messagePreview: 'Hey @john, can you review this?',
    jumpUrl: 'https://app.example.com/channels/general?message=123'
  },
  'john@example.com',
  'John Doe'
);
```

#### From Edge Function (Server-side)

```typescript
// Call the send-email Edge Function
const { error } = await supabase.functions.invoke('send-email', {
  body: {
    type: 'notification',
    data: {
      notificationType: 'mention',
      recipientEmail: 'user@example.com',
      recipientName: 'User Name',
      senderName: 'Sender Name',
      channelName: 'channel-name',
      messagePreview: 'Message preview...',
      jumpUrl: 'https://app.example.com/channels/123'
    }
  }
});
```

### User Preferences

Users can manage email preferences through:

1. **Notification Settings** - Toggle email notifications per type
2. **Email Settings** - Global email configuration
3. **Test Email** - Send test emails to verify configuration

## Testing

### Test Component

Use the `EmailIntegrationTest` component to test email delivery:

```typescript
import { EmailIntegrationTest } from '@/components/test/EmailIntegrationTest';

// In your test page
<EmailIntegrationTest />
```

### Manual Testing

1. **Test Individual Types**
   - Send test emails for each notification type
   - Verify email content and formatting
   - Check email delivery status

2. **Test User Preferences**
   - Enable/disable email notifications
   - Verify emails are sent only when enabled
   - Test different notification types

3. **Test Edge Cases**
   - Invalid email addresses
   - Missing user preferences
   - Network errors

## Configuration

### Resend Settings

In your Resend dashboard:

1. **Domain Verification**
   - Add your domain
   - Configure DNS records
   - Verify domain status

2. **API Keys**
   - Generate API key
   - Set appropriate permissions
   - Monitor usage

3. **Webhooks** (Optional)
   - Configure delivery status webhooks
   - Monitor email delivery
   - Handle bounces and complaints

### Application Settings

```typescript
// Email configuration
const emailConfig = {
  fromEmail: 'Knowledge Engine <noreply@yourdomain.com>',
  replyTo: 'support@yourdomain.com',
  tags: [
    { name: 'app', value: 'knowledge-engine' },
    { name: 'environment', value: process.env.NODE_ENV }
  ]
};
```

## Monitoring

### Email Delivery

Monitor email delivery through:

1. **Resend Dashboard**
   - Delivery rates
   - Bounce rates
   - Complaint rates

2. **Application Logs**
   - Edge Function logs
   - Error tracking
   - Performance metrics

3. **User Feedback**
   - Email preference changes
   - Support requests
   - User engagement

### Error Handling

The integration includes comprehensive error handling:

```typescript
// Error types
- Invalid email addresses
- Missing environment variables
- Resend API errors
- Network timeouts
- User preference errors
```

## Security

### Data Protection

- **Email addresses** are stored securely in Supabase
- **API keys** are stored as environment variables
- **User preferences** are protected by RLS policies

### Rate Limiting

- **Resend limits** - Respect Resend API rate limits
- **Application limits** - Implement user-level rate limiting
- **Edge Function limits** - Monitor function execution limits

## Troubleshooting

### Common Issues

1. **Emails not sending**
   - Check RESEND_API_KEY environment variable
   - Verify domain is verified in Resend
   - Check Edge Function logs

2. **Emails going to spam**
   - Verify domain reputation
   - Check email content
   - Configure SPF/DKIM records

3. **Template rendering issues**
   - Check HTML syntax
   - Verify template variables
   - Test with different email clients

### Debug Mode

Enable debug logging:

```typescript
// In Edge Function
console.log('Email sending request:', {
  type,
  data,
  timestamp: new Date().toISOString()
});
```

## Performance

### Optimization

1. **Template Caching**
   - Templates are defined statically
   - No runtime template compilation

2. **Batch Processing**
   - Multiple emails can be sent in sequence
   - Rate limiting prevents API overload

3. **Error Recovery**
   - Failed emails are logged
   - No retry mechanism (to prevent spam)

### Metrics

Monitor these metrics:

- **Email delivery rate** - Percentage of successful deliveries
- **Template rendering time** - Time to generate email content
- **API response time** - Resend API response times
- **User engagement** - Email open and click rates

## Future Enhancements

### Planned Features

1. **Email Analytics**
   - Open tracking
   - Click tracking
   - Engagement metrics

2. **Advanced Templates**
   - Dynamic content
   - A/B testing
   - Personalization

3. **Email Scheduling**
   - Delayed sending
   - Time zone optimization
   - Digest emails

4. **Multi-language Support**
   - Localized templates
   - Language preferences
   - RTL support

## Support

### Documentation

- [Resend Documentation](https://resend.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Email Best Practices](https://resend.com/docs/send-with-best-practices)

### Contact

For issues with the email integration:

1. Check the troubleshooting section
2. Review Edge Function logs
3. Test with the EmailIntegrationTest component
4. Contact the development team

## Changelog

### v1.1.0 (Admin Onboarding Email)
- Added admin onboarding request email template
- Integrated with consultation form submission
- Admin email notification system
- Enhanced test utilities

### v1.0.0 (Initial Release)
- Basic email integration with Resend
- HTML email templates
- User preference management
- Test utilities
- Edge Function integration
