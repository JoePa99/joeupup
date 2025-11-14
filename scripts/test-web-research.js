#!/usr/bin/env node

/**
 * Test Script for Web Research Perplexity Integration
 * 
 * This script tests the end-to-end web research flow to verify that:
 * 1. Agents have the web research tool enabled
 * 2. Intent analyzer correctly routes research queries
 * 3. Perplexity API is called via openai-web-research
 * 4. Results are properly formatted and returned
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testEnvironmentSetup() {
  console.log('🔍 Testing Environment Setup...');
  
  const hasPerplexityKey = !!process.env.PERPLEXITY_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  
  if (!hasPerplexityKey) {
    console.error('❌ PERPLEXITY_API_KEY is missing - web research will fail');
    return false;
  }
  
  if (!hasOpenAIKey) {
    console.error('❌ OPENAI_API_KEY is missing - intent analysis will fail');
    return false;
  }
  
  console.log('✅ Environment variables configured correctly');
  return true;
}

async function testAgentToolConfiguration() {
  console.log('\n🔍 Testing Agent Tool Configuration...');
  
  // Get a test agent
  const { data: agents, error: agentsError } = await supabase
    .from('agents')
    .select('id, name, status')
    .limit(1);
  
  if (agentsError || !agents || agents.length === 0) {
    console.error('❌ No agents found in database');
    return null;
  }
  
  const testAgent = agents[0];
  console.log(`✅ Found test agent: ${testAgent.name} (${testAgent.id})`);
  
  // Check if agent has web research tool
  const { data: agentTools, error: toolsError } = await supabase
    .from('agent_tools')
    .select(`
      id,
      is_enabled,
      tools!inner (
        id,
        name,
        tool_type
      )
    `)
    .eq('agent_id', testAgent.id)
    .eq('tools.name', 'openai_web_research');
  
  if (toolsError) {
    console.error('❌ Error checking agent tools:', toolsError.message);
    return null;
  }
  
  if (!agentTools || agentTools.length === 0) {
    console.error('❌ Agent does not have openai_web_research tool');
    return null;
  }
  
  const webResearchTool = agentTools[0];
  if (!webResearchTool.is_enabled) {
    console.error('❌ Agent has web research tool but it is disabled');
    return null;
  }
  
  console.log(`✅ Agent has web research tool enabled (${webResearchTool.tools.name})`);
  return {
    agentId: testAgent.id,
    agentName: testAgent.name,
    toolId: webResearchTool.tools.id
  };
}

async function testIntentAnalyzer(testAgent) {
  console.log('\n🔍 Testing Intent Analyzer...');
  
  const testQueries = [
    'research latest AI trends',
    'analyze competitor landscape',
    'what are the current market trends in technology',
    'find information about recent developments in AI'
  ];
  
  const results = [];
  
  for (const query of testQueries) {
    console.log(`   Testing query: "${query}"`);
    
    try {
      const { data, error } = await supabase.functions.invoke('intent-analyzer', {
        body: {
          message: query,
          agentId: testAgent.agentId,
          conversationHistory: [],
          attachments: []
        }
      });
      
      if (error) {
        console.error(`   ❌ Intent analysis failed: ${error.message}`);
        results.push({ query, success: false, error: error.message });
        continue;
      }
      
      const hasWebResearchTool = data.tools_required?.some(
        (tool: any) => tool.tool_id === testAgent.toolId
      );
      
      if (hasWebResearchTool) {
        console.log(`   ✅ Correctly routed to web research tool`);
        results.push({ query, success: true, routed: true });
      } else {
        console.log(`   ⚠️  Did not route to web research tool`);
        console.log(`   📋 Action type: ${data.action_type}`);
        console.log(`   📋 Tools required: ${data.tools_required?.length || 0}`);
        results.push({ query, success: false, routed: false, analysis: data });
      }
    } catch (error) {
      console.error(`   ❌ Intent analyzer error: ${error.message}`);
      results.push({ query, success: false, error: error.message });
    }
  }
  
  const successCount = results.filter(r => r.success && r.routed).length;
  console.log(`\n   📊 Intent Analyzer Results: ${successCount}/${testQueries.length} queries correctly routed`);
  
  return results;
}

async function testAgentToolsExecutor(testAgent) {
  console.log('\n🔍 Testing Agent Tools Executor...');
  
  const testQuery = 'research latest developments in artificial intelligence';
  
  try {
    console.log(`   Testing web research tool execution for: "${testQuery}"`);
    
    const { data, error } = await supabase.functions.invoke('agent-tools-executor', {
      body: {
        agentId: testAgent.agentId,
        toolId: testAgent.toolId,
        action: 'research',
        parameters: {
          query: testQuery,
          depth: 'detailed',
          include_sources: true
        }
      }
    });
    
    if (error) {
      console.error(`   ❌ Tool execution failed: ${error.message}`);
      return false;
    }
    
    console.log(`   ✅ Tool execution successful`);
    console.log(`   📋 Success: ${data.success}`);
    console.log(`   📋 Summary: ${data.summary}`);
    console.log(`   📋 Content type: ${data.metadata?.content_type}`);
    console.log(`   📋 Perplexity model: ${data.metadata?.perplexity_model}`);
    console.log(`   📋 Sources found: ${data.metadata?.sources_count || 0}`);
    
    // Check if Perplexity was used
    if (data.metadata?.perplexity_model && data.metadata.perplexity_model.includes('perplexity')) {
      console.log(`   ✅ Confirmed Perplexity API usage`);
      return true;
    } else {
      console.log(`   ⚠️  Perplexity API usage not confirmed in metadata`);
      return false;
    }
    
  } catch (error) {
    console.error(`   ❌ Tool executor error: ${error.message}`);
    return false;
  }
}

async function testChatIntegration(testAgent) {
  console.log('\n🔍 Testing Chat Integration...');
  
  const testQuery = 'research current trends in machine learning';
  
  try {
    console.log(`   Testing end-to-end chat with research query: "${testQuery}"`);
    
    // Create a test conversation
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .insert({
        agent_id: testAgent.agentId,
        title: 'Web Research Test',
        status: 'active'
      })
      .select()
      .single();
    
    if (convError) {
      console.error(`   ❌ Failed to create test conversation: ${convError.message}`);
      return false;
    }
    
    console.log(`   ✅ Created test conversation: ${conversation.id}`);
    
    // Send a research query
    const { data: chatResponse, error: chatError } = await supabase.functions.invoke('chat-with-agent', {
      body: {
        message: testQuery,
        agentId: testAgent.agentId,
        conversationId: conversation.id
      }
    });
    
    if (chatError) {
      console.error(`   ❌ Chat processing failed: ${chatError.message}`);
      return false;
    }
    
    console.log(`   ✅ Chat processing successful`);
    console.log(`   📋 Response received: ${chatResponse.response ? 'Yes' : 'No'}`);
    console.log(`   📋 Analysis type: ${chatResponse.analysis?.action_type}`);
    console.log(`   📋 Content type: ${chatResponse.content_type}`);
    
    // Check if web research was used
    if (chatResponse.content_type === 'web_research') {
      console.log(`   ✅ Web research content type confirmed`);
      return true;
    } else {
      console.log(`   ⚠️  Web research content type not confirmed`);
      return false;
    }
    
  } catch (error) {
    console.error(`   ❌ Chat integration error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Web Research Perplexity Integration Test Suite');
  console.log('================================================\n');
  
  try {
    // Test 1: Environment Setup
    const envOk = await testEnvironmentSetup();
    if (!envOk) {
      console.log('\n❌ Environment setup failed - stopping tests');
      return;
    }
    
    // Test 2: Agent Tool Configuration
    const testAgent = await testAgentToolConfiguration();
    if (!testAgent) {
      console.log('\n❌ Agent tool configuration failed - stopping tests');
      return;
    }
    
    // Test 3: Intent Analyzer
    const intentResults = await testIntentAnalyzer(testAgent);
    const intentSuccess = intentResults.filter(r => r.success && r.routed).length > 0;
    
    // Test 4: Agent Tools Executor
    const executorSuccess = await testAgentToolsExecutor(testAgent);
    
    // Test 5: Chat Integration
    const chatSuccess = await testChatIntegration(testAgent);
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    console.log(`Environment Setup: ${envOk ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Agent Configuration: ${testAgent ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Intent Analyzer: ${intentSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Tools Executor: ${executorSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Chat Integration: ${chatSuccess ? '✅ PASS' : '❌ FAIL'}`);
    
    const allTestsPassed = envOk && testAgent && intentSuccess && executorSuccess && chatSuccess;
    
    if (allTestsPassed) {
      console.log('\n🎉 All tests passed! Web research with Perplexity is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Check the logs above for details.');
      console.log('\n🔧 Troubleshooting steps:');
      console.log('   1. Run the diagnostic script: node scripts/diagnose-web-research.js');
      console.log('   2. Apply the migration if needed');
      console.log('   3. Check environment variables');
      console.log('   4. Verify Perplexity API key is valid');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run the test suite
main();
