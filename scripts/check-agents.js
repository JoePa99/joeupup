/**
 * Diagnostic script to check agent OpenAI configuration status
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://chaeznzfvbgrpzvxwvyu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYWV6bnpmdmJncnB6dnh3dnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwMjY4MzEsImV4cCI6MjA1MTYwMjgzMX0.LfBqJ8QvJ8QvJ8QvJ8QvJ8QvJ8QvJ8QvJ8QvJ8QvJ8Q'; // This should be safe to use

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAgents() {
  console.log('🔍 Checking agent OpenAI configuration status...\n');

  try {
    // Check template agents (should have OpenAI config)
    console.log('📋 Template Agents (is_default = true):');
    const { data: templateAgents, error: templateError } = await supabase
      .from('agents')
      .select('id, name, assistant_id, vector_store_id, company_id')
      .eq('is_default', true)
      .limit(5);

    if (templateError) {
      console.error('Error fetching template agents:', templateError.message);
    } else {
      templateAgents?.forEach(agent => {
        const hasAssistant = !!agent.assistant_id;
        const hasVectorStore = !!agent.vector_store_id;
        console.log(`  • ${agent.name}: Assistant=${hasAssistant ? '✅' : '❌'}, VectorStore=${hasVectorStore ? '✅' : '❌'}`);
      });
    }

    console.log('\n🏢 Company Agents (company_id IS NOT NULL):');
    const { data: companyAgents, error: companyError } = await supabase
      .from('agents')
      .select('id, name, assistant_id, vector_store_id, companies(name)')
      .not('company_id', 'is', null)
      .limit(10);

    if (companyError) {
      console.error('Error fetching company agents:', companyError.message);
    } else {
      let missingConfigCount = 0;
      companyAgents?.forEach(agent => {
        const hasAssistant = !!agent.assistant_id;
        const hasVectorStore = !!agent.vector_store_id;
        const isConfigured = hasAssistant && hasVectorStore;
        
        if (!isConfigured) {
          missingConfigCount++;
          console.log(`  ❌ ${agent.name} at ${agent.companies.name}: Assistant=${hasAssistant ? '✅' : '❌'}, VectorStore=${hasVectorStore ? '✅' : '❌'}`);
        } else {
          console.log(`  ✅ ${agent.name} at ${agent.companies.name}: Fully configured`);
        }
      });

      console.log(`\n📊 Summary: ${missingConfigCount} company agents need OpenAI configuration`);
      
      if (missingConfigCount > 0) {
        console.log('\n🔧 To fix these agents, you need to:');
        console.log('1. Get your Supabase service role key from the dashboard');
        console.log('2. Replace the key in scripts/quick-backfill.js');
        console.log('3. Run: node scripts/quick-backfill.js');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAgents();
