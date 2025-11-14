# Email Workflows Implementation

This document describes the complete email workflow system implemented for the Knowledge Engine application, including welcome emails for different onboarding paths and team invitation emails.

## Overview

The email system implements the following workflows:
1. **Welcome Emails** - Sent when users complete onboarding (custom or self-service)
2. **Team Invitation Emails** - Sent when team members are invited
3. **Admin Notification Emails** - Sent to admins for custom onboarding requests (already existed)

## Architecture

```
Frontend (React) → Supabase Edge Function → Resend API → Email Delivery
                           ↓
                   Database (team_invitations)
```

## 1. Welcome Email System

### Features
- **Custom Onboarding Welcome Email**: Includes timeline of consultation process, premium service details
- **Self-Service Onboarding Welcome Email**: Confirms knowledge base creation and active AI agents
- **Generic Welcome Email**: For standard user onboarding

### Implementation

#### Email Templates
Location: `src/lib/email-service.ts` and `supabase/functions/send-email/index.ts`

The welcome email template adapts based on `onboardingType`:
- `custom` - Shows premium consultation service timeline
- `self_service` - Shows quick start features
- Default - Shows standard features

#### Integration Points

**ConsultationForm** (`src/components/onboarding/ConsultationForm.tsx`):
```typescript
// After consultation request is submitted
await supabase.functions.invoke('send-email', {
  body: {
    type: 'welcome',
    data: {
      recipientEmail: formData.contactEmail,
      recipientName: recipientName,
      companyName: company?.name || 'Your Company',
      loginUrl: `${window.location.origin}/dashboard`,
      onboardingType: 'custom'
    }
  }
});
```

**SelfServiceForm** (`src/components/onboarding/SelfServiceForm.tsx`):
```typescript
// After self-service onboarding is finalized
await supabase.functions.invoke('send-email', {
  body: {
    type: 'welcome',
    data: {
      recipientEmail: profile?.email || user?.email,
      recipientName: recipientName,
      companyName: company?.name || 'Your Company',
      loginUrl: `${window.location.origin}/client-dashboard`,
      onboardingType: 'self_service'
    }
  }
});
```

### Email Design

**Custom Onboarding Welcome Email**:
- Premium service badge
- 4-step timeline showing:
  1. Initial Consultation (24-48 hours)
  2. Research & Analysis (1-2 weeks)
  3. Knowledge Base Delivery
  4. AI Agent Deployment
- Call-to-action: "Access Your Dashboard"

**Self-Service Welcome Email**:
- Quick start badge
- Three feature highlights:
  - ✅ Knowledge Base Created
  - 🤖 AI Agents Active
  - 📚 Enhanced Learning
- Call-to-action: "Get Started Now"

## 2. Team Invitation System

### Features
- Generate unique invitation tokens
- 7-day invitation expiration
- Personal messages from inviter
- Role-based invitations (admin, moderator, user)
- Invitation acceptance for both new and existing users
- Email notifications with beautiful design

### Database Schema

**Table: `team_invitations`**
```sql
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  invited_by UUID NOT NULL REFERENCES profiles(id),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL (user, moderator, admin),
  personal_message TEXT,
  invitation_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL (pending, accepted, expired, cancelled),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES profiles(id)
);
```

### Workflow

#### 1. Sending Invitations

**Location**: `src/pages/InviteTeamMembers.tsx`

**Process**:
1. User fills in invitation form (first name, last name, email, role, optional message)
2. System checks:
   - Email doesn't already exist in the company
   - No pending invitation exists for this email
3. Creates invitation record with unique token
4. Sends invitation email via edge function
5. Email includes personalized invitation link: `/accept-invitation?token=UNIQUE_TOKEN`

**Code Example**:
```typescript
// Generate unique token
const invitationToken = crypto.randomUUID();

// Create invitation record
await supabase.from('team_invitations').insert({
  company_id: userProfile.company_id,
  invited_by: user.id,
  email: values.email,
  first_name: values.firstName,
  last_name: values.lastName,
  role: values.role,
  personal_message: values.message || null,
  invitation_token: invitationToken,
  status: 'pending',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
});

// Send invitation email
await supabase.functions.invoke('send-email', {
  body: {
    type: 'team_invitation',
    data: {
      recipientEmail: values.email,
      recipientName: `${values.firstName} ${values.lastName}`,
      inviterName: inviterName,
      companyName: company?.name || 'the team',
      invitationUrl: invitationUrl,
      personalMessage: values.message || undefined,
      role: values.role
    }
  }
});
```

#### 2. Accepting Invitations

**Location**: `src/pages/AcceptInvitation.tsx`

**Process for New Users**:
1. User clicks invitation link
2. System loads invitation details
3. Verifies invitation is valid (not expired, not already accepted)
4. User creates password
5. System creates Supabase auth account
6. Updates profile with company_id and role
7. Marks invitation as accepted
8. Redirects to dashboard

**Process for Existing Users**:
1. User clicks invitation link
2. System detects user is already logged in
3. Verifies email matches invitation
4. Updates user's company_id and role
5. Marks invitation as accepted
6. Redirects to dashboard

### Email Design

**Team Invitation Email**:
- Invitation header with company name
- Invitation card showing:
  - Inviter name
  - Company name
  - Role badge
- Personal message (if provided)
- Feature highlights:
  - 🤖 AI-Powered Agents
  - 💬 Smart Collaboration
  - 📚 Knowledge Base
- Call-to-action: "Accept Invitation & Join Team"
- Expiration notice (7 days)

### Security Features

1. **Token-Based Authentication**: Unique UUIDs for each invitation
2. **Expiration**: Automatic expiration after 7 days
3. **Email Verification**: Ensures invited email matches accepting user
4. **Status Tracking**: Prevents double acceptance
5. **Row Level Security**: RLS policies ensure users can only access appropriate invitations

## 3. Edge Function Updates

**Location**: `supabase/functions/send-email/index.ts`

### Added Email Types

1. **welcome** (enhanced):
   - Supports `onboardingType` parameter
   - Dynamic content based on onboarding path
   - Personalized timeline for custom onboarding

2. **team_invitation** (new):
   - Beautiful invitation design
   - Personal message support
   - Role badge display
   - Feature highlights

### Request Interface

```typescript
interface EmailRequest {
  type: 'notification' | 'welcome' | 'password_reset' | 'admin_onboarding_request' | 'team_invitation';
  data: {
    recipientEmail: string;
    recipientName: string;
    // Welcome email data
    companyName?: string;
    loginUrl?: string;
    onboardingType?: 'custom' | 'self_service';
    // Team invitation data
    inviterName?: string;
    invitationUrl?: string;
    personalMessage?: string;
    role?: string;
  };
}
```

## Testing the System

### 1. Testing Welcome Emails

**Custom Onboarding**:
1. Go to `/onboarding`
2. Fill in company information
3. Select "Consulting Service Onboarding"
4. Complete consultation form
5. Check email for custom onboarding welcome message

**Self-Service Onboarding**:
1. Go to `/onboarding`
2. Fill in company information
3. Select "Self-Service Onboarding"
4. Complete website analysis and knowledge base creation
5. Check email for self-service welcome message

### 2. Testing Team Invitations

**Sending Invitation**:
1. Go to `/invite-team-members`
2. Fill in team member details
3. Add optional personal message
4. Submit invitation
5. Check email for invitation

**Accepting Invitation (New User)**:
1. Click invitation link in email
2. Verify invitation details displayed correctly
3. Create password
4. Submit account creation
5. Verify redirected to dashboard
6. Verify user is linked to correct company with correct role

**Accepting Invitation (Existing User)**:
1. Log in to account
2. Click invitation link
3. Verify invitation details
4. Accept invitation
5. Verify company and role updated
6. Verify redirected to dashboard

## Database Migrations

**File**: `supabase/migrations/20251002120000_create_team_invitations.sql`

Run migration:
```bash
supabase db push
```

Or manually apply:
```bash
psql -h your-host -U your-user -d your-db -f supabase/migrations/20251002120000_create_team_invitations.sql
```

## Environment Variables

Ensure these are set in your Supabase project:

```bash
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=Knowledge Engine <noreply@yourdomain.com>
```

## Deployment Checklist

- [ ] Run database migration for `team_invitations` table
- [ ] Deploy updated `send-email` edge function
- [ ] Verify `RESEND_API_KEY` environment variable is set
- [ ] Verify `RESEND_FROM_EMAIL` environment variable is set
- [ ] Test welcome email for custom onboarding
- [ ] Test welcome email for self-service onboarding
- [ ] Test team invitation sending
- [ ] Test team invitation acceptance (new user)
- [ ] Test team invitation acceptance (existing user)
- [ ] Verify invitation expiration works correctly
- [ ] Verify email design renders correctly in major email clients

## File Changes Summary

### New Files
- `supabase/migrations/20251002120000_create_team_invitations.sql` - Database schema
- `src/pages/AcceptInvitation.tsx` - Invitation acceptance page
- `docs/EMAIL_WORKFLOWS_IMPLEMENTATION.md` - This documentation

### Modified Files
- `src/lib/email-service.ts` - Added team invitation template and helpers
- `src/components/onboarding/ConsultationForm.tsx` - Added welcome email trigger
- `src/components/onboarding/SelfServiceForm.tsx` - Added welcome email trigger
- `src/pages/InviteTeamMembers.tsx` - Implemented complete invitation workflow
- `supabase/functions/send-email/index.ts` - Added team_invitation support
- `src/App.tsx` - Added `/accept-invitation` route

## Troubleshooting

### Emails Not Sending

1. **Check Resend API Key**:
   ```bash
   supabase secrets list
   ```

2. **Check Edge Function Logs**:
   ```bash
   supabase functions logs send-email
   ```

3. **Verify Email Service**:
   - Go to Resend dashboard
   - Check delivery logs
   - Verify domain is verified

### Invitation Not Working

1. **Check Database**:
   ```sql
   SELECT * FROM team_invitations WHERE invitation_token = 'TOKEN';
   ```

2. **Verify Token in URL**:
   - Ensure token parameter is present
   - Check token hasn't expired

3. **Check Browser Console**:
   - Look for JavaScript errors
   - Check network requests

### User Not Added to Company

1. **Check Profile Update**:
   ```sql
   SELECT id, email, company_id, role FROM profiles WHERE email = 'user@email.com';
   ```

2. **Verify Invitation Status**:
   ```sql
   SELECT status, accepted_at, accepted_by FROM team_invitations WHERE email = 'user@email.com';
   ```

## Future Enhancements

Potential improvements for the email system:

1. **Resend Invitations**: Allow admins to resend expired invitations
2. **Bulk Invitations**: Invite multiple team members at once
3. **Custom Email Templates**: Allow companies to customize email branding
4. **Invitation Reminders**: Send reminder emails before expiration
5. **Invitation Analytics**: Track invitation open rates and acceptance rates
6. **Email Preferences**: Allow users to customize which emails they receive
7. **Multi-language Support**: Send emails in user's preferred language

## Support

For issues or questions:
1. Check this documentation first
2. Review edge function logs
3. Check Resend dashboard for email delivery status
4. Review database records for invitation status

## Changelog

### Version 1.0.0 (October 2, 2025)
- Initial implementation of email workflows
- Added welcome emails for custom and self-service onboarding
- Implemented complete team invitation system
- Created database schema for team invitations
- Added invitation acceptance page
- Updated send-email edge function with new templates

