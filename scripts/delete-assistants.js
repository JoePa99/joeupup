import fetch from 'node-fetch';

// Configuration - update these values
const SUPABASE_URL = 'https://chaeznzfvbgrpzvxwvyu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYWV6bnpmdmJncnB6dnh3dnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxOTIwMTUsImV4cCI6MjA3MDc2ODAxNX0.tninczi1BMTk6G6knEMN8QKPMaAbFZjRkxg71CINcTY';
const USER_ID = '00000000-0000-0000-0000-000000000000'; // Using a placeholder UUID for testing
const COMPANY_ID = null; // Optional: if you want to delete assistants for a specific company only

async function deleteAllAssistants() {
  try {
    console.log('🚀 Starting deletion of all OpenAI assistants...');
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-all-assistants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        user_id: USER_ID,
        company_id: COMPANY_ID
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log('📊 Summary:', result.summary);
      
      if (result.results.successful.length > 0) {
        console.log('✅ Successfully deleted assistants:', result.results.successful.length);
      }
      
      if (result.results.failed.length > 0) {
        console.log('❌ Failed deletions:', result.results.failed.length);
        result.results.failed.forEach(failure => {
          console.log(`  - Agent: ${failure.name} (${failure.agent_id})`);
          console.log(`    Error: ${failure.error}`);
        });
      }
    } else {
      console.error('❌ Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Network or other error:', error.message);
  }
}

// Run the function
deleteAllAssistants();
