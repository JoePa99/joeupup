# Quick Fix: Usage Tracking in Sidebar

## Problem
The sidebar shows "Unable to load usage data" because the usage tracking system hasn't been set up yet.

## Solution Overview
You need to complete 4 steps to fix this:

1. ✅ Create `.env` file with credentials
2. ✅ Apply database migrations  
3. ✅ Deploy edge function
4. ✅ Initialize user usage records

---

## Step 1: Create .env File

Create a `.env` file in your project root (if you don't have one already) with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Where to find these:**
- Go to: https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/settings/api
- Copy the Project URL → `VITE_SUPABASE_URL`
- Copy the anon/public key → `VITE_SUPABASE_ANON_KEY`  
- Copy the service_role key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Apply Database Migrations

Open your terminal and run:

```powershell
supabase db push
```

**What this does:**
- Creates `user_usage` table to track message usage
- Creates `subscription_plans` table with pricing tiers
- Creates `usage_history` table for historical data
- Adds database functions for usage calculations
- Sets up Row Level Security (RLS) policies

**Expected output:**
```
Applying migration 20250110150000_add_stripe_and_usage_tracking.sql...
Applying migration 20250110150001_usage_tracking_triggers.sql...
Finished supabase db push.
```

---

## Step 3: Deploy Edge Function

Deploy the API endpoint that serves usage data:

```powershell
supabase functions deploy get-usage-stats
```

**Expected output:**
```
Deploying function get-usage-stats...
Deployed function get-usage-stats successfully!
```

---

## Step 4: Initialize User Usage Records

Run the backfill script to create usage records for all existing users:

```powershell
node scripts/backfill-user-usage.js
```

**What this does:**
- Finds all users with companies
- Creates a usage record for each user
- Sets initial message limits based on subscription plan
- Provides a summary of initialized users

**Expected output:**
```
🚀 Starting user usage backfill...

✅ Initialized usage for John Doe (50 messages/month)
✅ Initialized usage for Jane Smith (50 messages/month)

✨ Backfill complete!
Successfully initialized: 15 users
```

---

## Verify It Works

1. **Refresh your application** (hard refresh: Ctrl+Shift+R)
2. **Check the sidebar** - You should now see the usage indicator at the bottom
3. **Navigate to `/usage`** - View detailed usage statistics
4. **Send a test message** - Watch the usage counter increment

---

## Troubleshooting

### "No such file or directory: .env"
Create the `.env` file in your project root with your Supabase credentials (see Step 1)

### "user_usage table does not exist"
The migrations haven't been applied. Run: `supabase db push`

### "Failed to fetch usage stats"
The edge function isn't deployed. Run: `supabase functions deploy get-usage-stats`

### Still showing "Unable to load usage data"
1. Check browser console for errors (F12 → Console)
2. Run diagnostic: `node scripts/diagnose-usage-tracking.js`
3. Verify your user has a usage record:
   ```sql
   SELECT * FROM user_usage WHERE user_id = 'your-user-id';
   ```

### "Subscription is not active"
The usage tracking enforces subscription limits. To test without a subscription:
1. Set company subscription_status to 'active':
   ```sql
   UPDATE companies 
   SET subscription_status = 'active' 
   WHERE id = 'your-company-id';
   ```

---

## Quick Diagnostic

Run this to check your setup status:

```powershell
node scripts/diagnose-usage-tracking.js
```

This will show you:
- ✅ Which tables exist
- ✅ Which functions are available
- ✅ How many users have usage records
- ✅ Subscription plan configuration
- ✅ Edge function deployment status

---

## What Happens Next?

Once set up, the usage tracking system:

1. **Tracks every message** - Increments counter when users send messages
2. **Enforces limits** - Prevents sending when limit is reached
3. **Updates in real-time** - Sidebar indicator updates automatically
4. **Resets monthly** - Usage resets at the end of each billing period
5. **Archives history** - Previous usage is saved to `usage_history` table

---

## Default Subscription Plans

After migration, you'll have 3 plans:

| Plan | Price/Month | Messages/Seat | Max Seats |
|------|-------------|---------------|-----------|
| Starter | $59 | 50 | 5 |
| Professional | $299 | 250 | 25 |
| Enterprise | $1,199 | 1,000 | Unlimited |

**Note:** These have placeholder Stripe IDs. Update them in the `subscription_plans` table with your actual Stripe Product/Price IDs before going live.

---

## Need Help?

1. Check `USAGE_SETUP_GUIDE.md` for detailed documentation
2. Run `node scripts/diagnose-usage-tracking.js` for diagnostics
3. Check Supabase logs: `supabase functions logs get-usage-stats`
4. Verify RLS policies allow your user to read `user_usage` table

---

## Files Created

- ✅ `scripts/backfill-user-usage.js` - Initialize user usage records
- ✅ `scripts/diagnose-usage-tracking.js` - Diagnostic tool
- ✅ `scripts/setup-usage-tracking.ps1` - Automated setup (Windows)
- ✅ `scripts/setup-usage-tracking.sh` - Automated setup (Mac/Linux)
- ✅ `USAGE_SETUP_GUIDE.md` - Complete documentation
- ✅ `QUICK_FIX_USAGE_TRACKING.md` - This file






























