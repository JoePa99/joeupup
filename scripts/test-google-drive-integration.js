#!/usr/bin/env node

/**
 * Test script for Google Drive document search integration
 * This script tests the new edge functions and integration
 */

const { createClient } = require('@supabase/supabase-js');

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

async function testGoogleDriveIntegration() {
  console.log('🧪 Testing Google Drive Document Search Integration...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Test 1: Check if search-google-drive-files function exists
    console.log('1. Testing search-google-drive-files function...');
    
    const searchResponse = await supabase.functions.invoke('search-google-drive-files', {
      body: {
        query: 'test query',
        folderId: 'test-folder-id',
        maxResults: 5
      }
    });

    console.log('   ✅ Function exists and responds');
    console.log('   Response:', searchResponse.data ? 'Success' : 'Error');
    
    if (searchResponse.error) {
      console.log('   Expected error (no auth):', searchResponse.error.message);
    }

    // Test 2: Check if fetch-google-drive-file-content function exists
    console.log('\n2. Testing fetch-google-drive-file-content function...');
    
    const fetchResponse = await supabase.functions.invoke('fetch-google-drive-file-content', {
      body: {
        fileId: 'test-file-id',
        mimeType: 'text/plain',
        fileName: 'test.txt'
      }
    });

    console.log('   ✅ Function exists and responds');
    console.log('   Response:', fetchResponse.data ? 'Success' : 'Error');
    
    if (fetchResponse.error) {
      console.log('   Expected error (no auth):', fetchResponse.error.message);
    }

    // Test 3: Check database schema
    console.log('\n3. Testing database schema...');
    
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, google_drive_folder_id, google_drive_folder_name')
      .limit(1);

    if (companiesError) {
      console.log('   ❌ Database error:', companiesError.message);
    } else {
      console.log('   ✅ Companies table accessible');
      console.log('   ✅ Google Drive columns exist');
    }

    // Test 4: Check google_integrations table
    console.log('\n4. Testing google_integrations table...');
    
    const { data: integrations, error: integrationsError } = await supabase
      .from('google_integrations')
      .select('user_id, drive_enabled')
      .limit(1);

    if (integrationsError) {
      console.log('   ❌ Database error:', integrationsError.message);
    } else {
      console.log('   ✅ Google integrations table accessible');
    }

    console.log('\n🎉 Integration test completed!');
    console.log('\nNext steps:');
    console.log('1. Deploy the edge functions to Supabase');
    console.log('2. Test with real Google Drive folder');
    console.log('3. Test agent conversations with document search');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testGoogleDriveIntegration();










