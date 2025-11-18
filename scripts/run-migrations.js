import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing environment variables');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nTo get your service role key:');
  console.error('1. Go to: https://supabase.com/dashboard/project/mzqlkhysicqtrahllkng/settings/api');
  console.error('2. Copy the "service_role" key (NOT the anon key)');
  console.error('3. Add to .env: SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigrations() {
  const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

  // Get all migration files and sort them
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);
  console.log('\nRunning migrations in order...\n');

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    try {
      console.log(`Running: ${file}...`);

      // Execute the SQL
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // Try direct query if RPC doesn't exist
        const { error: directError } = await supabase.from('_').select('*').limit(0);

        if (directError?.message?.includes('not found')) {
          console.error(`  ⚠️  Cannot execute - need to use Supabase CLI or dashboard`);
          console.error(`  Error: ${error.message}`);
          failCount++;
          continue;
        }
      }

      console.log(`  ✓ Success`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
      failCount++;

      // Stop on critical errors
      if (error.message.includes('does not exist') || error.message.includes('already exists')) {
        console.log('\n⚠️  Migration dependency issue detected.');
        console.log('Please use Supabase CLI or dashboard to run migrations.');
        break;
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Migrations completed: ${successCount} succeeded, ${failCount} failed`);
  console.log(`${'='.repeat(50)}\n`);

  if (failCount > 0) {
    console.log('⚠️  Some migrations failed. Recommended approach:');
    console.log('\n1. Use Supabase CLI:');
    console.log('   npx supabase link --project-ref mzqlkhysicqtrahllkng');
    console.log('   npx supabase db push');
    console.log('\n2. Or use Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/mzqlkhysicqtrahllkng/sql');
  }
}

runMigrations().catch(console.error);
