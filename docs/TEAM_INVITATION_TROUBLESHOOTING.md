# Team Invitation Email Troubleshooting Guide

## Issue: 400 Bad Request when sending team invitations

### Most Common Causes

1. **Missing Supabase Edge Function Secrets**
   - The `send-email` edge function requires environment variables that must be set separately in Supabase

2. **Missing RESEND_API_KEY**
   - The edge function needs the Resend API key to send emails

3. **Authentication Issues**
   - The edge function requires the user to be authenticated

## Solution Steps

### 1. Set Supabase Edge Function Secrets

You need to set the following secrets for the `send-email` edge function:

```bash
# Set the Resend API key
supabase secrets set RESEND_API_KEY=your_actual_resend_api_key

# Set the from email address (optional, has default)
supabase secrets set RESEND_FROM_EMAIL="Knowledge Engine <noreply@yourdomain.com>"

# Verify secrets are set
supabase secrets list
```

### 2. Alternative: Set via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **send-email**
3. Go to the **Settings** tab
4. Add the environment variables:
   - `RESEND_API_KEY`: Your Resend API key
   - `RESEND_FROM_EMAIL`: Your sender email address

### 3. Verify Resend API Key

Make sure your Resend API key is valid:
1. Go to https://resend.com/api-keys
2. Create a new API key if needed
3. Make sure the domain is verified in Resend

### 4. Check Function Logs

After setting the secrets, check the edge function logs to see more details:

```bash
supabase functions logs send-email
```

Or in the Supabase dashboard:
1. Go to **Edge Functions** → **send-email**
2. Click on the **Logs** tab
3. Look for any error messages

### 5. Test the Function

After setting the secrets, try sending an invitation again. The console logs will now show:
- Environment check results
- Authentication status
- Detailed error messages if something fails

## Expected Console Output

When the invitation works correctly, you should see:

```
Environment check: { hasSupabaseUrl: true, hasSupabaseAnonKey: true, hasResendApiKey: true, hasAuthHeader: true }
User authenticated: <user-id>
Email request: { type: 'team_invitation', hasData: true }
```

## Common Error Messages

### "RESEND_API_KEY environment variable is not set"
- **Solution**: Set the RESEND_API_KEY secret as described above

### "Unauthorized: No user found"
- **Solution**: Make sure you're logged in and the session is valid

### "Missing required data for team_invitation"
- **Solution**: Check that all required fields are being passed (inviterName, companyName, invitationUrl, role)

### "Tags should only contain ASCII letters, numbers, underscores, or dashes"
- **Issue**: Company names with spaces or special characters in email tags
- **Solution**: This has been fixed automatically - tag values are now sanitized to replace invalid characters with underscores
- **Example**: "Creme Digital" becomes "Creme_Digital" in tags

### "Resend API error: ..."
- **Solution**: Check your Resend account and API key validity
- **Note**: Check the edge function logs for detailed error information from Resend

## Additional Resources

- [Supabase Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Resend Documentation](https://resend.com/docs)
- [Resend API Keys](https://resend.com/api-keys)

