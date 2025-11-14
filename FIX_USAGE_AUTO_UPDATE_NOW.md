# Fix Usage Auto-Update - Action Required

## Current Status

✅ **Code is Fixed** - The stale closure issue in `useUsage.ts` has been resolved
❌ **Infrastructure Missing** - Database tables and functions not set up yet

## Why It's Not Working

Your console shows no "Usage updated:" logs because the usage tracking system needs to be initialized. Here's what's missing:

1. Database tables (`user_usage`, `subscription_plans`, `usage_history`)
2. Database functions (`get_user_current_usage`, etc.)
3. Database triggers (to increment usage when messages are sent)
4. Edge function deployment (`get-usage-stats`)
5. User usage records initialization

## Quick Fix (Follow These Steps)

### Step 1: Apply Database Migrations

Run this command (you'll be prompted for your database password):

```powershell
supabase db push
```

**What to expect:**
- You'll be asked for your Supabase database password
- It will apply two migrations:
  - `20250110150000_add_stripe_and_usage_tracking.sql`
  - `20250110150001_usage_tracking_triggers.sql`

**Success looks like:**
```
Applying migration 20250110150000_add_stripe_and_usage_tracking.sql...
Applying migration 20250110150001_usage_tracking_triggers.sql...
Finished supabase db push.
```

### Step 2: Deploy Edge Function

```powershell
supabase functions deploy get-usage-stats
```

**Success looks like:**
```
Deploying function get-usage-stats...
Deployed successfully!
```

### Step 3: Initialize User Usage Records

First, verify your `.env` file has these variables (without the VITE_ prefix for Node scripts):

```env
VITE_SUPABASE_URL=https://chaeznzfvbgrpzvxwvyu.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Then run:

```powershell
node scripts/backfill-user-usage.js
```

**Success looks like:**
```
🚀 Starting user usage backfill...
✅ Initialized usage for user@example.com (50 messages/month)
✨ Backfill complete!
```

### Step 4: Refresh Your Application

After completing steps 1-3:

1. Hard refresh your browser (Ctrl + Shift + R)
2. Open the sidebar
3. Send a test message
4. Check the browser console - you should now see:
   - ✅ "Usage subscription status: SUBSCRIBED"
   - ✅ "Usage updated: { ... }" (when you send a message)
   - ✅ Usage indicator updates automatically

## Troubleshooting

### "Missing environment variables" Error

Your `.env` file might not have the service role key. Add this line:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Get it from: https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/settings/api

### "user_usage table does not exist"

Step 1 (migrations) wasn't completed successfully. Check the error message and ensure your database password is correct.

### Still No "Usage updated:" Logs

1. Check if the subscription is active in console: Look for "Usage subscription status: SUBSCRIBED"
2. Verify user has a usage record:
   ```sql
   SELECT * FROM user_usage WHERE user_id = 'e64e46cf-bfc7-49fd-9990-53bd767be3c6';
   ```
3. Check if triggers are firing:
   ```sql
   SELECT * FROM chat_messages WHERE conversation_id = '5469cead-52ef-426f-acdd-ccf32ae63be8' ORDER BY created_at DESC LIMIT 5;
   ```

### Database Connection Issues

If you get connection errors, try using the direct connection string from your Supabase dashboard instead of the pooler URL.

## What Happens After Setup

Once set up correctly, here's the flow:

1. **User sends message** → INSERT into `chat_messages`
2. **Database trigger fires** → `increment_user_message_usage()` 
3. **Usage counter increments** → UPDATE `user_usage` table
4. **Postgres notifies** → Real-time subscription receives event
5. **Hook refetches** → `fetchUsage()` called with fresh closure
6. **UI updates** → Sidebar indicator shows new count

## Need Help?

If you encounter issues:

1. Check the detailed guide: `USAGE_SETUP_GUIDE.md`
2. Run diagnostic: `node scripts/diagnose-usage-tracking.js` (after fixing .env)
3. Check Supabase logs: `supabase functions logs get-usage-stats`
4. Verify database structure in Supabase dashboard → Table Editor

---

**Remember:** The code fix is already done. You just need to set up the infrastructure!






























