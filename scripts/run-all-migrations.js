import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Error: VITE_SUPABASE_URL not found in .env');
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in .env');
  console.error('\n📝 To get your service role key:');
  console.error('1. Go to: https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/settings/api');
  console.error('2. Copy the "service_role" secret key (NOT the anon key)');
  console.error('3. Add to .env file: SUPABASE_SERVICE_ROLE_KEY=your_key_here\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runMigrations() {
  const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

  // Get all SQL files sorted by name (timestamp)
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Found ${files.length} migration files`);
  console.log(`${'='.repeat(60)}\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`[${i + 1}/${files.length}] Running: ${file}`);

    try {
      // Execute raw SQL using the REST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ sql })
      });

      if (!response.ok) {
        // Try alternative method: direct SQL execution
        const { data, error } = await supabase.rpc('exec', { sql });

        if (error) {
          // Last resort: try to execute via pg connection (won't work with JS client)
          console.log(`  ⚠️  Cannot execute via RPC, trying direct execution...`);

          // Split SQL into individual statements and try executing them
          const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

          let stmtSuccess = 0;
          for (const stmt of statements) {
            try {
              const { error: stmtError } = await supabase.rpc('exec', { sql: stmt });
              if (stmtError) {
                throw stmtError;
              }
              stmtSuccess++;
            } catch (e) {
              // Check if it's a "already exists" error
              if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
                console.log(`  ℹ️  Skipping (already exists): ${e.message.substring(0, 80)}`);
                skippedCount++;
                continue;
              }
              throw e;
            }
          }

          if (stmtSuccess > 0) {
            console.log(`  ✅ Executed ${stmtSuccess} statements`);
            successCount++;
            continue;
          }

          throw error;
        }
      }

      console.log(`  ✅ Success`);
      successCount++;

    } catch (error) {
      const errMsg = error.message || error.toString();

      // Check if it's just a "already exists" warning
      if (errMsg.includes('already exists') || errMsg.includes('duplicate')) {
        console.log(`  ⏭️  Skipped (already exists)`);
        skippedCount++;
      } else {
        console.error(`  ❌ Failed: ${errMsg.substring(0, 100)}`);
        failCount++;

        // Ask if we should continue
        console.log(`\n⚠️  Migration failed. This might cause subsequent migrations to fail.`);
        console.log(`Continue anyway? (Ctrl+C to stop)\n`);

        // Wait a bit to allow user to cancel
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Migration Summary:`);
  console.log(`   ✅ Succeeded: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`${'='.repeat(60)}\n`);

  if (failCount > 0) {
    console.log('⚠️  Some migrations failed. You may need to:');
    console.log('   1. Check the Supabase logs for detailed errors');
    console.log('   2. Run failed migrations manually via Dashboard SQL editor');
    console.log('   3. Verify database permissions\n');
    process.exit(1);
  } else {
    console.log('🎉 All migrations completed successfully!\n');
  }
}

runMigrations().catch(err => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
