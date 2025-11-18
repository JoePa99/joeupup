# Database Migration Instructions

## Problem Summary

You're trying to run new migrations (from November 2025), but your database is missing the base schema created by earlier migrations. Specifically, the `app_role` enum type is created in migration `20250815080118_c4579fdd-b0c5-4355-ab0e-2bfa41d50357.sql` but hasn't been applied to your database yet.

## Error Message
```
Error: Failed to run sql query: ERROR: 42704: type "app_role" does not exist
```

## Migration Order

Your database needs ALL 117 migrations applied in chronological order. The migrations are already properly named with timestamps, so they'll run in the correct sequence automatically.

### Critical New Migrations (Run AFTER all existing migrations):
1. `20251117000001_add_consultant_role.sql`
2. `20251117000002_create_consultant_workspaces.sql`
3. `20251117000003_create_agent_documents.sql`
4. `20251117000004_create_context_retrievals.sql`
5. `20251117000005_create_query_expansion_cache.sql`
6. `20251117000006_create_context_injection_config.sql`
7. `20251117000007_modify_companies_table.sql`
8. `20251117000008_modify_agents_table.sql`
9. `20251117000009_modify_onboarding_sessions.sql`
10. `20251117000010_create_vector_search_functions.sql`

---

## Solution 1: Supabase CLI (Recommended)

### Prerequisites
- Internet connection to download Supabase CLI
- Your Supabase project credentials

### Steps

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   # Or use npx for one-time use
   ```

2. **Link to your project**:
   ```bash
   npx supabase link --project-ref chaeznzfvbgrpzvxwvyu
   ```
   You'll be prompted for your database password.

3. **Push all migrations**:
   ```bash
   npx supabase db push
   ```
   This will:
   - Detect which migrations have not been run
   - Execute them in chronological order
   - Create all tables, types, functions, and policies

4. **Verify success**:
   ```bash
   npx supabase db diff
   ```
   Should show "No schema changes detected"

---

## Solution 2: Supabase Dashboard (Manual)

### Best for: When CLI doesn't work due to network/environment issues

1. **Navigate to SQL Editor**:
   - Go to: https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/sql/new

2. **Run migrations in order**:
   - Start with oldest: `20250106150000_provision_openai_for_company_agents.sql`
   - Copy content of each migration file
   - Paste into SQL editor
   - Click "Run"
   - Move to next migration

3. **Verify each step**:
   - Check for errors before proceeding
   - If error occurs, fix dependencies first

### Pro tip for dashboard method:
Create a new query for each migration and save them as snippets for future reference.

---

## Solution 3: Direct Database Connection (Advanced)

### Prerequisites
- PostgreSQL client (`psql`) installed
- Database connection string with password

### Get your connection string:
1. Go to: https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/settings/database
2. Copy the connection string under "Connection string"
3. Format: `postgresql://postgres:[YOUR-PASSWORD]@db.chaeznzfvbgrpzvxwvyu.supabase.co:5432/postgres`

### Run migrations:
```bash
# Set your database URL
export DATABASE_URL="your_connection_string_here"

# Run all migrations in order
for file in supabase/migrations/*.sql; do
  echo "Running: $file"
  psql $DATABASE_URL -f "$file"
  if [ $? -ne 0 ]; then
    echo "Error in $file"
    exit 1
  fi
done
```

---

## Solution 4: Using Migration Script (If you have service role key)

### Get Service Role Key:
1. Go to: https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/settings/api
2. Copy the `service_role` key (NOT the anon key)
3. Add to `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

### Run the script:
```bash
node scripts/run-migrations.js
```

**Note**: This method has limitations due to Supabase security policies and may not work for all migration types.

---

## Verifying Migration Success

After running migrations, verify they were applied:

### Option 1: Check in Supabase Dashboard
1. Go to Table Editor: https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/editor
2. Verify tables exist:
   - `companies`
   - `profiles`
   - `agents`
   - `consultant_workspaces` (new)
   - `agent_documents` (new)
   - `context_retrievals` (new)
   - etc.

### Option 2: Check with SQL
Run this in SQL Editor:
```sql
-- Check if app_role enum exists
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'app_role';

-- Should return: admin, moderator, user, platform-admin, consultant

-- Check if consultant_workspaces table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'consultant_workspaces'
);
-- Should return: true
```

---

## Troubleshooting

### Error: "relation already exists"
- Migration was partially applied
- Check which tables exist
- Modify migration to be idempotent or skip

### Error: "type already exists"
- Same as above
- Use `CREATE TYPE IF NOT EXISTS` (PostgreSQL 15+)
- Or wrap in DO block with existence check

### Error: "must be owner of type"
- Database user permissions issue
- Use service role or database owner credentials

### Network timeout
- Use dashboard method instead
- Or run from environment with better connectivity

---

## Project Configuration Note

Your `.env` file shows project ID: `chaeznzfvbgrpzvxwvyu`
Your `supabase/config.toml` shows: `burikvqttbmhahtjnplq`

**These don't match!** Make sure you're targeting the correct project. Update `config.toml` if needed:

```toml
project_id = "chaeznzfvbgrpzvxwvyu"
```

---

## Quick Reference

**Current Status**: Database is missing all migrations
**Total Migrations**: 117 files
**Oldest Migration**: 20250106150000
**Newest Migration**: 20251117000010

**Recommended Path**: Use Supabase CLI (`npx supabase link` → `npx supabase db push`)

---

## Need Help?

If you continue to have issues:
1. Check Supabase project health: https://status.supabase.com/
2. Verify project ID and credentials
3. Ensure database is not paused (free tier auto-pauses after 7 days inactivity)
4. Contact Supabase support or check their Discord

---

**Last Updated**: 2025-11-18
**Project**: chaeznzfvbgrpzvxwvyu
**Database**: PostgreSQL 15
