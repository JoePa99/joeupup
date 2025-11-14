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

async function diagnoseUsageTracking() {
  console.log('🔍 Usage Tracking Diagnostic Tool\n');
  console.log('='.repeat(60));
  
  const results = {
    tables: { status: '⏳', details: [] },
    functions: { status: '⏳', details: [] },
    usageRecords: { status: '⏳', details: [] },
    subscriptionPlans: { status: '⏳', details: [] },
    edgeFunction: { status: '⏳', details: [] }
  };

  // Check 1: Tables exist
  console.log('\n📋 Checking Database Tables...');
  try {
    const tables = ['user_usage', 'usage_history', 'subscription_plans'];
    let allTablesExist = true;
    
    for (const tableName of tables) {
      const { error } = await supabase.from(tableName).select('id').limit(1);
      
      if (error && error.code === '42P01') {
        console.log(`   ❌ Table '${tableName}' does not exist`);
        results.tables.details.push(`Missing: ${tableName}`);
        allTablesExist = false;
      } else if (error) {
        console.log(`   ⚠️  Table '${tableName}' - Error: ${error.message}`);
        results.tables.details.push(`Error accessing: ${tableName}`);
      } else {
        console.log(`   ✅ Table '${tableName}' exists`);
      }
    }
    
    results.tables.status = allTablesExist ? '✅' : '❌';
  } catch (err) {
    console.log(`   ❌ Error checking tables: ${err.message}`);
    results.tables.status = '❌';
  }

  // Check 2: Database Functions exist
  console.log('\n⚙️  Checking Database Functions...');
  try {
    const functions = [
      'initialize_user_usage',
      'get_user_current_usage',
      'get_company_usage_stats',
      'reset_monthly_usage'
    ];
    
    let allFunctionsExist = true;
    
    for (const funcName of functions) {
      const { data, error } = await supabase
        .rpc(funcName, funcName === 'get_user_current_usage' ? { p_user_id: '00000000-0000-0000-0000-000000000000' } : 
             funcName === 'get_company_usage_stats' ? { p_company_id: '00000000-0000-0000-0000-000000000000' } :
             funcName === 'reset_monthly_usage' ? { p_company_id: '00000000-0000-0000-0000-000000000000' } : {});
      
      // Function exists if we get any response (even an error response is ok, we're just checking existence)
      if (error && error.code === '42883') {
        console.log(`   ❌ Function '${funcName}' does not exist`);
        results.functions.details.push(`Missing: ${funcName}`);
        allFunctionsExist = false;
      } else {
        console.log(`   ✅ Function '${funcName}' exists`);
      }
    }
    
    results.functions.status = allFunctionsExist ? '✅' : '❌';
  } catch (err) {
    console.log(`   ⚠️  Error checking functions: ${err.message}`);
    results.functions.status = '⚠️';
  }

  // Check 3: Usage Records
  console.log('\n📊 Checking User Usage Records...');
  try {
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('company_id', 'is', null);
    
    const { count: usageRecords } = await supabase
      .from('user_usage')
      .select('*', { count: 'exact', head: true })
      .gte('period_end', new Date().toISOString());
    
    console.log(`   Total users with companies: ${totalUsers || 0}`);
    console.log(`   Active usage records: ${usageRecords || 0}`);
    
    if (usageRecords === 0 && totalUsers > 0) {
      console.log(`   ⚠️  ${totalUsers} users need usage records initialized`);
      results.usageRecords.status = '⚠️';
      results.usageRecords.details.push(`${totalUsers} users need initialization`);
    } else if (usageRecords < totalUsers) {
      console.log(`   ⚠️  ${totalUsers - usageRecords} users missing usage records`);
      results.usageRecords.status = '⚠️';
      results.usageRecords.details.push(`${totalUsers - usageRecords} users missing records`);
    } else {
      console.log(`   ✅ All users have usage records`);
      results.usageRecords.status = '✅';
    }
  } catch (err) {
    console.log(`   ❌ Error checking usage records: ${err.message}`);
    results.usageRecords.status = '❌';
  }

  // Check 4: Subscription Plans
  console.log('\n💳 Checking Subscription Plans...');
  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    
    if (error) {
      throw error;
    }
    
    console.log(`   Found ${plans.length} active subscription plans:`);
    
    let hasPlaceholders = false;
    plans.forEach(plan => {
      const isPlaceholder = plan.stripe_price_id.includes('placeholder');
      console.log(`   ${isPlaceholder ? '⚠️' : '✅'} ${plan.name} - $${(plan.price_monthly / 100).toFixed(2)}/month - ${plan.message_limit_per_seat} msgs/seat`);
      if (isPlaceholder) {
        hasPlaceholders = true;
      }
    });
    
    if (hasPlaceholders) {
      console.log(`   ⚠️  Some plans have placeholder Stripe IDs`);
      results.subscriptionPlans.status = '⚠️';
      results.subscriptionPlans.details.push('Update Stripe IDs');
    } else {
      results.subscriptionPlans.status = '✅';
    }
  } catch (err) {
    console.log(`   ❌ Error checking subscription plans: ${err.message}`);
    results.subscriptionPlans.status = '❌';
  }

  // Check 5: Edge Function
  console.log('\n🔗 Checking Edge Function...');
  try {
    // Try to call the edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/get-usage-stats?scope=user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 404) {
      console.log(`   ❌ Edge function 'get-usage-stats' not deployed`);
      results.edgeFunction.status = '❌';
      results.edgeFunction.details.push('Function not deployed');
    } else {
      console.log(`   ✅ Edge function 'get-usage-stats' is accessible`);
      results.edgeFunction.status = '✅';
    }
  } catch (err) {
    console.log(`   ⚠️  Could not verify edge function: ${err.message}`);
    results.edgeFunction.status = '⚠️';
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 Diagnostic Summary');
  console.log('='.repeat(60));
  console.log(`${results.tables.status} Database Tables`);
  if (results.tables.details.length > 0) {
    results.tables.details.forEach(d => console.log(`     ${d}`));
  }
  
  console.log(`${results.functions.status} Database Functions`);
  if (results.functions.details.length > 0) {
    results.functions.details.forEach(d => console.log(`     ${d}`));
  }
  
  console.log(`${results.usageRecords.status} User Usage Records`);
  if (results.usageRecords.details.length > 0) {
    results.usageRecords.details.forEach(d => console.log(`     ${d}`));
  }
  
  console.log(`${results.subscriptionPlans.status} Subscription Plans`);
  if (results.subscriptionPlans.details.length > 0) {
    results.subscriptionPlans.details.forEach(d => console.log(`     ${d}`));
  }
  
  console.log(`${results.edgeFunction.status} Edge Function`);
  if (results.edgeFunction.details.length > 0) {
    results.edgeFunction.details.forEach(d => console.log(`     ${d}`));
  }
  
  console.log('='.repeat(60));

  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (results.tables.status === '❌') {
    console.log('   1. Run database migrations: supabase db push');
  }
  
  if (results.functions.status === '❌') {
    console.log('   2. Ensure migrations include function definitions');
  }
  
  if (results.usageRecords.status === '⚠️' || results.usageRecords.status === '❌') {
    console.log('   3. Initialize user usage records: node scripts/backfill-user-usage.js');
  }
  
  if (results.subscriptionPlans.status === '⚠️') {
    console.log('   4. Update Stripe product/price IDs in subscription_plans table');
  }
  
  if (results.edgeFunction.status === '❌') {
    console.log('   5. Deploy edge function: supabase functions deploy get-usage-stats');
  }
  
  console.log('\n   See USAGE_SETUP_GUIDE.md for detailed instructions\n');
}

// Run the diagnostic
diagnoseUsageTracking();






























