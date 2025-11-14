# Usage Tracking Setup Guide

This guide will help you set up the usage tracking and billing features that power the sidebar usage indicator.

## Prerequisites

- Supabase CLI installed and configured
- Database password for your Supabase project
- Service role key in your `.env` file

## Step 1: Apply Database Migrations

The usage tracking system requires two migrations to be applied:

```bash
supabase db push
```

When prompted, enter your Supabase database password.

### What this creates:
- `subscription_plans` table - Subscription plan configurations
- `user_usage` table - Current usage tracking per user
- `usage_history` table - Historical usage records
- Database functions for usage calculations
- RLS policies for secure access

## Step 2: Verify Tables Were Created

Check that the tables and functions exist:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_usage', 'subscription_plans', 'usage_history');

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_user_current_usage', 'get_company_usage_stats', 'initialize_user_usage');
```

## Step 3: Deploy Edge Function

Deploy the `get-usage-stats` edge function:

```bash
supabase functions deploy get-usage-stats
```

## Step 4: Configure Environment Variables

Ensure your `.env` file has:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Step 5: Backfill Existing Users

Run the backfill script to initialize usage records for all existing users:

```bash
node scripts/backfill-user-usage.js
```

This script will:
- ✅ Find all users with companies
- ✅ Check for existing usage records
- ✅ Initialize usage for users without records
- ✅ Set appropriate message limits based on subscription plans
- ✅ Provide a detailed summary

### Expected Output:
```
🚀 Starting user usage backfill...

📊 Step 1: Verifying database tables...
👥 Step 2: Fetching users from profiles...
   Found 15 users with companies

🔍 Step 3: Checking existing usage records...
   Found 0 users with active usage records

📝 Step 4: Initializing usage for 15 users...
   ✅ Initialized usage for John Doe (50 messages/month)
   ✅ Initialized usage for Jane Smith (50 messages/month)
   ...

✨ Backfill complete!
```

## Step 6: Update Stripe Product IDs (Required for Production)

The migrations insert placeholder Stripe IDs. Update them with your actual Stripe Product and Price IDs:

```sql
-- Update Starter plan
UPDATE subscription_plans 
SET 
    stripe_price_id = 'price_xxxxxxxxxxxxx',
    stripe_product_id = 'prod_xxxxxxxxxxxxx'
WHERE slug = 'starter';

-- Update Professional plan
UPDATE subscription_plans 
SET 
    stripe_price_id = 'price_xxxxxxxxxxxxx',
    stripe_product_id = 'prod_xxxxxxxxxxxxx'
WHERE slug = 'professional';

-- Update Enterprise plan
UPDATE subscription_plans 
SET 
    stripe_price_id = 'price_xxxxxxxxxxxxx',
    stripe_product_id = 'prod_xxxxxxxxxxxxx'
WHERE slug = 'enterprise';
```

## Step 7: Verify in the Application

1. **Sidebar Usage Indicator**: The usage indicator should now appear in the sidebar footer
2. **Usage Page**: Navigate to `/usage` to see detailed usage statistics
3. **Real-time Updates**: Usage updates automatically as users send messages

## Troubleshooting

### "Unable to load usage data" in sidebar

**Cause**: No usage record exists for the current user

**Fix**: 
```bash
# Run the backfill script
node scripts/backfill-user-usage.js
```

### "user_usage table does not exist"

**Cause**: Migrations haven't been applied

**Fix**:
```bash
supabase db push
```

### "Failed to fetch usage stats" error

**Cause**: Edge function not deployed or environment variables missing

**Fix**:
```bash
# Deploy the edge function
supabase functions deploy get-usage-stats

# Verify environment variables
cat .env | grep SUPABASE
```

### Users can't send messages (limit exceeded)

**Cause**: Usage tracking triggers are enforcing limits

**Fix**: 
1. Check company subscription status is 'active' or 'trialing'
2. Verify user hasn't exceeded their message limit
3. Reset usage for testing:
```sql
UPDATE user_usage 
SET messages_used = 0 
WHERE user_id = 'user_id_here';
```

## Schema Overview

### Subscription Plans
- **Starter**: $59/month, 50 messages per seat, max 5 seats
- **Professional**: $299/month, 250 messages per seat, max 25 seats  
- **Enterprise**: $1,199/month, 1000 messages per seat, unlimited seats

### Usage Tracking Flow
1. User sends a message → `chat_messages` insert
2. Trigger checks usage limit before insert
3. Trigger increments usage counter after insert
4. Frontend displays usage via `UsageIndicator` component
5. Real-time subscriptions keep UI updated

### Database Functions
- `initialize_user_usage()` - Create usage record for new user
- `get_user_current_usage()` - Get current usage stats
- `get_company_usage_stats()` - Get company-wide usage (admin only)
- `reset_monthly_usage()` - Archive and reset monthly usage
- `check_user_message_limit()` - Trigger to enforce limits
- `increment_user_message_usage()` - Trigger to increment counters

## Next Steps

After setup is complete:

1. **Set up Stripe Webhook**: Configure webhook endpoint at `/functions/v1/stripe-webhook`
2. **Test Message Sending**: Verify usage increments correctly
3. **Test Billing Flow**: Create checkout session and manage subscriptions
4. **Monitor Usage**: Use admin dashboard to track company usage

## Support

If you encounter issues:
1. Check Supabase logs: `supabase functions logs get-usage-stats`
2. Verify RLS policies allow access
3. Check browser console for error messages
4. Verify database functions exist and are executable






























