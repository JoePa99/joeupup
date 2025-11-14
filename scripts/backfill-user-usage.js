import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function backfillUserUsage() {
  console.log('🚀 Starting user usage backfill...\n');

  try {
    // Step 1: Verify tables exist
    console.log('📊 Step 1: Verifying database tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('user_usage')
      .select('id')
      .limit(1);

    if (tablesError && tablesError.code === '42P01') {
      console.error('❌ Error: user_usage table does not exist.');
      console.error('   Please run the database migrations first:');
      console.error('   supabase db push\n');
      process.exit(1);
    }

    // Step 2: Get all users with companies
    console.log('👥 Step 2: Fetching users from profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, company_id, companies!inner(id, plan_id, subscription_plans(message_limit_per_seat))')
      .not('company_id', 'is', null);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    console.log(`   Found ${profiles.length} users with companies\n`);

    // Step 3: Check existing usage records
    console.log('🔍 Step 3: Checking existing usage records...');
    const { data: existingUsage, error: usageError } = await supabase
      .from('user_usage')
      .select('user_id')
      .gte('period_end', new Date().toISOString());

    if (usageError) {
      throw new Error(`Failed to fetch existing usage: ${usageError.message}`);
    }

    const existingUserIds = new Set(existingUsage.map(u => u.user_id));
    console.log(`   Found ${existingUserIds.size} users with active usage records\n`);

    // Step 4: Initialize usage for users without records
    const usersToInitialize = profiles.filter(p => !existingUserIds.has(p.id));
    console.log(`📝 Step 4: Initializing usage for ${usersToInitialize.length} users...\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const profile of usersToInitialize) {
      try {
        // Get message limit from subscription plan, default to 50 if not set
        let messageLimit = 50;
        
        if (profile.companies?.subscription_plans?.message_limit_per_seat) {
          messageLimit = profile.companies.subscription_plans.message_limit_per_seat;
        }

        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        // Call the database function to initialize usage
        const { data, error } = await supabase.rpc('initialize_user_usage', {
          p_user_id: profile.id,
          p_company_id: profile.company_id,
          p_message_limit: messageLimit,
          p_period_start: periodStart.toISOString(),
          p_period_end: periodEnd.toISOString()
        });

        if (error) {
          throw error;
        }

        const userName = profile.first_name 
          ? `${profile.first_name} ${profile.last_name || ''}`
          : profile.email;

        console.log(`   ✅ Initialized usage for ${userName} (${messageLimit} messages/month)`);
        successCount++;
      } catch (err) {
        console.error(`   ❌ Failed for user ${profile.email}: ${err.message}`);
        errorCount++;
        errors.push({ email: profile.email, error: err.message });
      }
    }

    // Step 5: Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully initialized: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log(`⏭️  Skipped (already exists): ${existingUserIds.size} users`);
    console.log(`📈 Total users processed: ${profiles.length} users`);
    console.log('='.repeat(60) + '\n');

    if (errors.length > 0) {
      console.log('❌ Errors details:');
      errors.forEach(({ email, error }) => {
        console.log(`   - ${email}: ${error}`);
      });
      console.log('');
    }

    // Step 6: Verify results
    console.log('🔍 Step 6: Verifying results...');
    const { data: finalCount, error: countError } = await supabase
      .from('user_usage')
      .select('id', { count: 'exact', head: true })
      .gte('period_end', new Date().toISOString());

    if (!countError) {
      console.log(`   Total active usage records in database: ${finalCount}\n`);
    }

    console.log('✨ Backfill complete!\n');

    if (successCount > 0) {
      console.log('💡 Next steps:');
      console.log('   1. Verify the usage indicator appears in your sidebar');
      console.log('   2. Check /usage page for detailed usage information');
      console.log('   3. Update Stripe product/price IDs in subscription_plans table\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillUserUsage();






























