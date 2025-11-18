#!/usr/bin/env node

/**
 * Migration script to apply missing database tables
 * This will create the notifications, consultation_requests, and playbook_sections tables
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Checking migration file...');
const migrationPath = path.join(__dirname, 'supabase/migrations/20251118200031_fix_missing_dashboard_tables.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Error: Migration file not found at', migrationPath);
  process.exit(1);
}

console.log('✅ Migration file found\n');

console.log('⚠️  IMPORTANT: This migration requires elevated database permissions.');
console.log('   The VITE_SUPABASE_PUBLISHABLE_KEY (anon key) may not have sufficient permissions.\n');

console.log('Please apply this migration using ONE of the following methods:\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 Option 1: Via Supabase Dashboard (RECOMMENDED)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  1. Go to https://supabase.com/dashboard/project/mzqlkhysicqtrahllkng/sql');
console.log('  2. Click "New query" button');
console.log('  3. Copy the entire contents from:');
console.log('     📄 supabase/migrations/20251118200031_fix_missing_dashboard_tables.sql');
console.log('  4. Paste into the SQL editor');
console.log('  5. Click "Run" (or press Ctrl/Cmd + Enter)');
console.log('  6. Wait for success confirmation\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚡ Option 2: Using Supabase CLI');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Run these commands:');
console.log('  $ supabase link --project-ref mzqlkhysicqtrahllkng');
console.log('  $ supabase db push\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📦 What this migration will create:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  ✅ notifications table');
console.log('  ✅ notification_reads table');
console.log('  ✅ user_presence table');
console.log('  ✅ consultation_requests table');
console.log('  ✅ playbook_sections table');
console.log('  ✅ All necessary RLS policies');
console.log('  ✅ Indexes for performance');
console.log('  ✅ Triggers for automatic updates\n');

console.log('🎯 After applying, refresh your dashboard - all errors should be resolved!');
