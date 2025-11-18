# 🚀 Run Database Migrations (NO CLI NEEDED)

## Quick Start

### Step 1: Get Your Database Password

1. Go to: **https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/settings/database**
2. Find the "Database Password" section
3. Click "Reset Database Password" if you don't have it, or use your existing password
4. **Copy the password** (you'll need it in the next step)

### Step 2: Add Database URL to .env

Add this line to your `.env` file (replace `YOUR-PASSWORD-HERE` with the actual password):

```bash
DATABASE_URL=postgresql://postgres.chaeznzfvbgrpzvxwvyu:YOUR-PASSWORD-HERE@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Full example .env file:**
```bash
VITE_SUPABASE_PROJECT_ID="chaeznzfvbgrpzvxwvyu"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://chaeznzfvbgrpzvxwvyu.supabase.co"
VITE_GOOGLE_CLIENT_ID="319352434470-r28thsev17e48nhcn1nrkcgiuc8d0us2.apps.googleusercontent.com"
VITE_QUICKBOOKS_CLIENT_ID="your_quickbooks_client_id_here"
DATABASE_URL=postgresql://postgres.chaeznzfvbgrpzvxwvyu:YOUR-PASSWORD-HERE@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

### Step 3: Run the Migration Script

```bash
npm run db:migrate
```

That's it! The script will:
- ✅ Connect directly to your PostgreSQL database
- ✅ Run all 117 migrations in chronological order
- ✅ Skip migrations that are already applied
- ✅ Show progress for each migration
- ✅ Create the `app_role` enum type and everything else needed

---

## What This Does

The migration script will create ALL database schema including:

### Core Tables
- `companies` - Company/workspace data
- `profiles` - User profiles
- `agents` - AI agents
- `chat_messages` - Conversation history
- `documents` - Document storage
- And ~50+ more tables...

### New Tables (Your 10 November Migrations)
- `consultant_workspaces` - Multi-client consultant management
- `agent_documents` - Agent knowledge base
- `context_retrievals` - Context injection tracking
- `query_expansion_cache` - Query optimization
- `context_injection_config` - Context system configuration

### Enums & Types
- `app_role` - User roles (admin, moderator, user, platform-admin, **consultant**)
- `company_plan` - Subscription plans
- `agent_status` - Agent states
- And many more...

### Functions & Triggers
- RLS (Row Level Security) policies
- Helper functions
- Automated triggers
- Vector search capabilities

---

## Troubleshooting

### Error: "DATABASE_URL not found"
- Make sure you added it to `.env` file
- Verify the file is in the root directory (`/home/user/joeupup/.env`)

### Error: "password authentication failed"
- Your database password is incorrect
- Reset it in Supabase Dashboard > Settings > Database
- Update the DATABASE_URL in .env with new password

### Error: "connection timeout"
- Your IP might not be allowed
- Go to: Settings > Database > Connection Pooling
- Check if "Connection Pooler" is enabled
- Or try using Session mode connection string instead

### Error: "relation already exists"
- This is NORMAL - the script will skip and continue
- It means that migration was already applied

### Error: "type app_role does not exist" STILL happening
- This means the base migration didn't run
- Check the script output - did it skip migration `20250815080118_c4579fdd-b0c5-4355-ab0e-2bfa41d50357.sql`?
- If yes, that migration creates app_role
- Try running that specific migration manually in Dashboard

---

## Alternative: Manual Dashboard Method

If the script doesn't work for any reason, you can run migrations manually:

### Step 1: Go to SQL Editor
https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/sql/new

### Step 2: Run migrations one by one

Start with the oldest and work your way to newest:

1. **20250815080118_c4579fdd-b0c5-4355-ab0e-2bfa41d50357.sql** ← Creates app_role enum (CRITICAL)
2. Then continue with the rest in chronological order
3. End with the 10 new November migrations

Copy the contents of each file, paste into SQL editor, click RUN.

---

## Verify Success

After migrations complete, verify in SQL editor:

```sql
-- Check app_role enum exists with all values
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'app_role'
ORDER BY enumsortorder;

-- Should return: admin, moderator, user, platform-admin, consultant
```

```sql
-- Check consultant_workspaces table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'consultant_workspaces'
);

-- Should return: true
```

---

## Need Help?

If you're still having issues:

1. Check the script output for specific error messages
2. Verify your database connection string is correct
3. Make sure your database password is correct
4. Try the manual Dashboard method as a backup

**Your database connection info:**
- Project: chaeznzfvbgrpzvxwvyu
- Region: US West 1 (aws-0-us-west-1)
- Connection pooler: Port 6543
- Direct connection: Port 5432

---

**Next Steps After Migration:**
Once all migrations are complete, your database will be fully set up and you can start using all the new consultant and context injection features!
