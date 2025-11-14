/**
 * Quick backfill script to fix existing agents
 */

// You'll need to replace these with your actual values
const SUPABASE_URL = 'https://chaeznzfvbgrpzvxwvyu.supabase.co';
const SUPABASE_SERVICE_KEY = 'your-service-role-key-here'; // Replace with actual key

async function quickBackfill() {
  console.log('🔧 Running quick backfill for agents...');
  
  try {
    // First, let's do a dry run to see what needs to be fixed
    console.log('Step 1: Dry run to see what agents need fixing...');
    const dryRunResponse = await fetch(`${SUPABASE_URL}/functions/v1/backfill-agent-openai`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dry_run: true,
        limit: 5
      })
    });

    const dryRunResult = await dryRunResponse.json();
    console.log('Dry run result:', JSON.stringify(dryRunResult, null, 2));

    if (dryRunResult.data && dryRunResult.data.processed > 0) {
      console.log(`\nStep 2: Found ${dryRunResult.data.processed} agents that need fixing. Running actual backfill...`);
      
      const backfillResponse = await fetch(`${SUPABASE_URL}/functions/v1/backfill-agent-openai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dry_run: false,
          limit: 5
        })
      });

      const backfillResult = await backfillResponse.json();
      console.log('Backfill result:', JSON.stringify(backfillResult, null, 2));
    } else {
      console.log('✅ No agents need fixing - all are already configured!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Instructions for the user
console.log(`
📋 INSTRUCTIONS:
1. Replace 'your-service-role-key-here' with your actual Supabase service role key
2. Run: node scripts/quick-backfill.js

To get your service role key:
1. Go to your Supabase dashboard
2. Navigate to Settings > API
3. Copy the "service_role" key (not the anon key)
`);

quickBackfill();
