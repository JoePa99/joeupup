# Copy & Paste Migration Instructions

## Step 1: Open the SQL File

Open the file: **`ALL_MIGRATIONS.sql`**

This file contains all 117 migrations in the correct order (11,312 lines of SQL).

## Step 2: Copy Everything

Select all the content in `ALL_MIGRATIONS.sql` and copy it.

```bash
# Or use this command to copy to clipboard (if you have xclip):
cat ALL_MIGRATIONS.sql | xclip -selection clipboard
```

## Step 3: Go to Supabase SQL Editor

Open: **https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/sql/new**

## Step 4: Paste and Run

1. Paste all the SQL into the editor
2. Click **"RUN"** button
3. Wait for it to complete (might take a minute or two)

## Done!

This will create:
- ✅ The `app_role` enum type (with admin, moderator, user, platform-admin, consultant)
- ✅ All tables (companies, profiles, agents, consultant_workspaces, etc.)
- ✅ All functions and triggers
- ✅ All RLS policies
- ✅ Everything needed for your app

---

## If SQL Editor Times Out or Fails

The file might be too large for the SQL editor. If it fails, I can split it into smaller chunks. Let me know and I'll create 10-15 smaller files you can run one at a time.

---

## After Running

Verify it worked by running this in SQL editor:

```sql
SELECT enumlabel FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'app_role'
ORDER BY enumsortorder;
```

Should return: admin, moderator, user, platform-admin, consultant
