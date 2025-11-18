/**
 * Direct Database Migration Script
 *
 * This script connects directly to PostgreSQL and runs all migrations in order.
 *
 * Setup:
 * 1. npm install pg dotenv
 * 2. Add to .env: DATABASE_URL=your_postgres_connection_string
 * 3. Run: node scripts/migrate-database.js
 */

import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
dotenv.config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env\n');
  console.error('📝 To get your connection string:');
  console.error('1. Go to: https://supabase.com/dashboard/project/chaeznzfvbgrpzvxwvyu/settings/database');
  console.error('2. Scroll to "Connection string" section');
  console.error('3. Select "URI" tab');
  console.error('4. Copy the connection string (it will have [YOUR-PASSWORD] placeholder)');
  console.error('5. Replace [YOUR-PASSWORD] with your actual database password');
  console.error('6. Add to .env: DATABASE_URL=postgresql://postgres:your-password@db.chaeznzfvbgrpzvxwvyu.supabase.co:5432/postgres\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase
});

async function runMigrations() {
  const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🗄️  Running ${files.length} migrations against database...`);
  console.log(`${'='.repeat(70)}\n`);

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to database\n');

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf-8');

      process.stdout.write(`[${String(i + 1).padStart(3, ' ')}/${files.length}] ${file.padEnd(70, ' ')} `);

      try {
        await client.query(sql);
        console.log('✅');
        successCount++;
      } catch (error) {
        const errCode = error.code;
        const errMsg = error.message;

        // Check if it's a benign "already exists" error
        if (errCode === '42P07' || // relation already exists
            errCode === '42710' || // object already exists
            errCode === '42P06' || // schema already exists
            errMsg.includes('already exists') ||
            errMsg.includes('duplicate')) {
          console.log('⏭️  (exists)');
          skipCount++;
        } else {
          console.log('❌');
          console.error(`   Error: ${errMsg.split('\n')[0]}`);
          failCount++;

          // Critical errors should stop execution
          if (errCode === '42704' || // undefined object
              errCode === '42703' || // undefined column
              errCode === '42P01') { // undefined table
            console.error(`\n⚠️  Critical dependency error. Stopping migrations.`);
            break;
          }
        }
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Results:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Failed:  ${failCount}`);
    console.log(`${'='.repeat(70)}\n`);

    if (failCount > 0) {
      console.log('⚠️  Some migrations failed. Check errors above.\n');
      process.exit(1);
    } else {
      console.log('🎉 All migrations completed!\n');
    }

  } catch (error) {
    console.error('\n❌ Database connection error:', error.message);
    console.error('\n💡 Tips:');
    console.error('   - Verify DATABASE_URL is correct');
    console.error('   - Check that your database password is correct');
    console.error('   - Ensure your IP is allowed (Supabase: Settings > Database > Connection Pooling)\n');
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigrations();
