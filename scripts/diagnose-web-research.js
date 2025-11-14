#!/usr/bin/env node

/**
 * Database Diagnostic Script for Web Research Tool Configuration
 * 
 * This script checks the current state of web research tools in the database
 * and identifies any configuration issues that might prevent Perplexity integration.
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

async function checkEnvironmentVariables() {
  console.log('🔍 Checking Environment Variables...');
  
  const hasPerplexityKey = !!process.env.PERPLEXITY_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  
  console.log(`   PERPLEXITY_API_KEY: ${hasPerplexityKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   OPENAI_API_KEY: ${hasOpenAIKey ? '✅ Configured' : '❌ Missing'}`);
  
  if (!hasPerplexityKey) {
    console.log('   ⚠️  PERPLEXITY_API_KEY is required for web research functionality');
  }
  
  return { hasPerplexityKey, hasOpenAIKey };
}

async function checkToolsTable() {
  console.log('\n🔍 Checking Tools Table...');
  
  const { data: tools, error } = await supabase
    .from('tools')
    .select('id, name, display_name, tool_type, description')
    .eq('name', 'openai_web_research');
  
  if (error) {
    console.error('   ❌ Error querying tools table:', error.message);
    return { exists: false, tool: null };
  }
  
  if (tools && tools.length > 0) {
    const tool = tools[0];
    console.log('   ✅ openai_web_research tool exists:');
    console.log(`      ID: ${tool.id}`);
    console.log(`      Name: ${tool.name}`);
    console.log(`      Display Name: ${tool.display_name}`);
    console.log(`      Type: ${tool.tool_type}`);
    console.log(`      Description: ${tool.description}`);
    return { exists: true, tool };
  } else {
    console.log('   ❌ openai_web_research tool not found in tools table');
    return { exists: false, tool: null };
  }
}

async function checkAgentTools() {
  console.log('\n🔍 Checking Agent Tools Configuration...');
  
  // First get the tool ID
  const { data: webResearchTool } = await supabase
    .from('tools')
    .select('id')
    .eq('name', 'openai_web_research')
    .single();
  
  if (!webResearchTool) {
    console.log('   ⚠️  Cannot check agent tools - openai_web_research tool not found');
    return { agentsWithTool: 0, totalAgents: 0, agentsWithoutTool: [] };
  }
  
  // Get all agents
  const { data: allAgents, error: agentsError } = await supabase
    .from('agents')
    .select('id, name, company_id, status');
  
  if (agentsError) {
    console.error('   ❌ Error querying agents:', agentsError.message);
    return { agentsWithTool: 0, totalAgents: 0, agentsWithoutTool: [] };
  }
  
  const totalAgents = allAgents?.length || 0;
  console.log(`   Total agents: ${totalAgents}`);
  
  // Check which agents have the web research tool enabled
  const { data: agentTools, error: agentToolsError } = await supabase
    .from('agent_tools')
    .select(`
      agent_id,
      is_enabled,
      agents!inner (
        id,
        name,
        company_id,
        status
      )
    `)
    .eq('tool_id', webResearchTool.id);
  
  if (agentToolsError) {
    console.error('   ❌ Error querying agent_tools:', agentToolsError.message);
    return { agentsWithTool: 0, totalAgents, agentsWithoutTool: [] };
  }
  
  const agentsWithTool = agentTools?.filter(at => at.is_enabled).length || 0;
  const agentsWithToolDisabled = agentTools?.filter(at => !at.is_enabled).length || 0;
  const agentsWithoutTool = totalAgents - (agentTools?.length || 0);
  
  console.log(`   Agents with web research tool enabled: ${agentsWithTool}`);
  console.log(`   Agents with web research tool disabled: ${agentsWithToolDisabled}`);
  console.log(`   Agents without web research tool: ${agentsWithoutTool}`);
  
  // Show details for agents without the tool
  if (agentsWithoutTool > 0) {
    const agentIdsWithTool = new Set(agentTools?.map(at => at.agent_id) || []);
    const agentsWithoutToolList = allAgents?.filter(agent => !agentIdsWithTool.has(agent.id)) || [];
    
    console.log('\n   📋 Agents missing web research tool:');
    agentsWithoutToolList.forEach(agent => {
      console.log(`      - ${agent.name} (ID: ${agent.id}, Status: ${agent.status})`);
    });
  }
  
  return {
    agentsWithTool,
    totalAgents,
    agentsWithoutTool: agentsWithoutToolList || [],
    toolId: webResearchTool.id
  };
}

async function checkRecentToolUsage() {
  console.log('\n🔍 Checking Recent Tool Usage...');
  
  const { data: recentUsage, error } = await supabase
    .from('chat_messages')
    .select('id, content, tool_results, content_type, created_at')
    .eq('content_type', 'web_research')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('   ❌ Error querying recent tool usage:', error.message);
    return;
  }
  
  if (recentUsage && recentUsage.length > 0) {
    console.log(`   ✅ Found ${recentUsage.length} recent web research messages:`);
    recentUsage.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString();
      console.log(`      - ${date}: ${msg.content?.substring(0, 50)}...`);
    });
  } else {
    console.log('   ⚠️  No recent web research usage found');
  }
}

async function generateRecommendations(envCheck, toolCheck, agentCheck) {
  console.log('\n📋 Recommendations:');
  
  const recommendations = [];
  
  if (!envCheck.hasPerplexityKey) {
    recommendations.push('Add PERPLEXITY_API_KEY to your environment variables');
  }
  
  if (!toolCheck.exists) {
    recommendations.push('Run the migration to create the openai_web_research tool');
  }
  
  if (agentCheck.agentsWithoutTool > 0) {
    recommendations.push(`Add web research tool to ${agentCheck.agentsWithoutTool} agents missing it`);
  }
  
  if (agentCheck.agentsWithTool === 0 && agentCheck.totalAgents > 0) {
    recommendations.push('Enable web research tool for all existing agents');
  }
  
  if (recommendations.length === 0) {
    console.log('   ✅ Configuration looks good! Web research should be working.');
  } else {
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  }
  
  return recommendations;
}

async function main() {
  console.log('🔍 Web Research Tool Diagnostic Report');
  console.log('=====================================\n');
  
  try {
    const envCheck = await checkEnvironmentVariables();
    const toolCheck = await checkToolsTable();
    const agentCheck = await checkAgentTools();
    await checkRecentToolUsage();
    
    const recommendations = await generateRecommendations(envCheck, toolCheck, agentCheck);
    
    console.log('\n📊 Summary:');
    console.log(`   Environment: ${envCheck.hasPerplexityKey ? 'Ready' : 'Needs PERPLEXITY_API_KEY'}`);
    console.log(`   Tool exists: ${toolCheck.exists ? 'Yes' : 'No'}`);
    console.log(`   Agent coverage: ${agentCheck.agentsWithTool}/${agentCheck.totalAgents} agents have tool enabled`);
    
    if (recommendations.length > 0) {
      console.log('\n🚀 Next steps:');
      console.log('   1. Fix the issues listed above');
      console.log('   2. Run this diagnostic again to verify');
      console.log('   3. Test web research with a query like "research latest AI trends"');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    process.exit(1);
  }
}

// Run the diagnostic
main();
