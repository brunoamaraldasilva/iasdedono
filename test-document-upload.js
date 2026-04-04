#!/usr/bin/env node

/**
 * Integration Test: Document Upload to Supabase
 *
 * Tests the complete document upload pipeline:
 * 1. Upload file via /api/documents/upload
 * 2. Wait for background processing
 * 3. Verify document appears in database
 * 4. Verify chunks are created
 * 5. Verify embeddings are generated
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Test user credentials
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_FILE_PATH = '/tmp/test-document.csv';

let testResults = {
  passed: [],
  failed: [],
};

function log(stage, message) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${stage.padEnd(20)} ${message}`);
}

function success(message) {
  testResults.passed.push(message);
  log('✅ SUCCESS', message);
}

function error(message) {
  testResults.failed.push(message);
  log('❌ ERROR', message);
}

async function checkEnvironment() {
  log('SETUP', 'Checking environment variables...');

  if (!SUPABASE_URL) {
    error('NEXT_PUBLIC_SUPABASE_URL not set');
    process.exit(1);
  }
  if (!SUPABASE_ANON_KEY) {
    error('NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
    process.exit(1);
  }
  if (!SUPABASE_SERVICE_KEY) {
    error('SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
  }

  success('Environment variables configured');
}

async function createTestFile() {
  log('FILE', 'Creating test CSV file...');

  const csvContent = `name,email,department,salary
John Doe,john@example.com,Sales,50000
Jane Smith,jane@example.com,Engineering,80000
Bob Johnson,bob@example.com,Marketing,60000
Alice Williams,alice@example.com,HR,55000
Charlie Brown,charlie@example.com,Finance,70000`;

  fs.writeFileSync(TEST_FILE_PATH, csvContent);
  const stats = fs.statSync(TEST_FILE_PATH);
  success(`Test CSV created: ${TEST_FILE_PATH} (${stats.size} bytes)`);
}

async function signupUser() {
  log('AUTH', 'Signing up test user...');

  try {
    const response = await fetch(`${APP_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(`Signup failed: ${data.error || response.statusText}`);
    }

    const data = await response.json();
    success(`User signed up: ${TEST_EMAIL}`);
    return data.user;
  } catch (err) {
    error(`Signup failed: ${err.message}`);
    throw err;
  }
}

async function loginUser() {
  log('AUTH', 'Logging in user...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (authError) {
      throw new Error(`Login failed: ${authError.message}`);
    }

    success(`User logged in, session token: ${data.session.access_token.substring(0, 20)}...`);
    return data.session.access_token;
  } catch (err) {
    error(`Login failed: ${err.message}`);
    throw err;
  }
}

async function uploadDocument(token) {
  log('UPLOAD', 'Uploading CSV file...');

  try {
    const fileBuffer = fs.readFileSync(TEST_FILE_PATH);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'text/csv' });
    formData.append('file', blob, 'test-document.csv');

    const response = await fetch(`${APP_URL}/api/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(`Upload failed: ${data.error || response.statusText}`);
    }

    const data = await response.json();
    success(`Document uploaded: ${data.documentId}`);
    return data.documentId;
  } catch (err) {
    error(`Upload failed: ${err.message}`);
    throw err;
  }
}

async function waitForProcessing(documentId, maxWaitMs = 30000) {
  log('WAIT', `Waiting for document processing (max ${maxWaitMs / 1000}s)...`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const { data: docs, error } = await supabase
      .from('documents')
      .select('id, processing_status, total_chunks, total_tokens')
      .eq('id', documentId);

    if (error) {
      error(`Query failed: ${error.message}`);
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    if (!docs || docs.length === 0) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    const doc = docs[0];
    if (doc.processing_status === 'completed') {
      success(`Document processing completed`);
      log('INFO', `  - Chunks: ${doc.total_chunks}`);
      log('INFO', `  - Tokens: ${doc.total_tokens}`);
      return doc;
    }

    if (doc.processing_status === 'error') {
      error(`Document processing failed`);
      return null;
    }

    log('WAIT', `Status: ${doc.processing_status}...`);
    await new Promise(r => setTimeout(r, 1000));
  }

  error(`Processing timeout after ${maxWaitMs / 1000}s`);
  return null;
}

async function verifyChunks(documentId) {
  log('VERIFY', 'Checking document chunks...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: chunks, error } = await supabase
      .from('document_chunks')
      .select('id, chunk_index, token_count')
      .eq('document_id', documentId)
      .limit(5);

    if (error) {
      error(`Chunk query failed: ${error.message}`);
      return null;
    }

    if (!chunks || chunks.length === 0) {
      error('No chunks found in database');
      return null;
    }

    success(`Found ${chunks.length} chunks in database`);
    log('INFO', `  First chunk: ${chunks[0].token_count} tokens`);
    return chunks;
  } catch (err) {
    error(`Chunk verification failed: ${err.message}`);
    return null;
  }
}

async function verifyEmbeddings(documentId) {
  log('VERIFY', 'Checking embeddings...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // First, get chunks for this document
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('id')
      .eq('document_id', documentId);

    if (!chunks || chunks.length === 0) {
      error('No chunks found for embedding verification');
      return null;
    }

    const chunkIds = chunks.map(c => c.id);

    // Then check if embeddings exist
    const { data: embeddings, error } = await supabase
      .from('embeddings')
      .select('id, chunk_id')
      .in('chunk_id', chunkIds)
      .limit(5);

    if (error) {
      error(`Embedding query failed: ${error.message}`);
      return null;
    }

    if (!embeddings || embeddings.length === 0) {
      error('No embeddings found in database');
      return null;
    }

    success(`Found ${embeddings.length} embeddings in database`);
    return embeddings;
  } catch (err) {
    error(`Embedding verification failed: ${err.message}`);
    return null;
  }
}

async function listDocuments(token) {
  log('LIST', 'Fetching document list...');

  try {
    const response = await fetch(`${APP_URL}/api/documents/list`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`List failed: ${response.statusText}`);
    }

    const data = await response.json();
    success(`Found ${data.total} document(s) in user's list`);

    if (data.documents && data.documents.length > 0) {
      const doc = data.documents[0];
      log('INFO', `  Latest: ${doc.filename}`);
      log('INFO', `  Status: ${doc.processing_status}`);
      log('INFO', `  Size: ${(doc.file_size / 1024).toFixed(2)} KB`);
    }
    return data.documents;
  } catch (err) {
    error(`List fetch failed: ${err.message}`);
    return null;
  }
}

async function cleanup() {
  log('CLEANUP', 'Removing test files...');

  if (fs.existsSync(TEST_FILE_PATH)) {
    fs.unlinkSync(TEST_FILE_PATH);
    success('Test file removed');
  }

  // Note: Test user and documents remain in Supabase for debugging
  log('INFO', 'Test user and documents left in Supabase for manual inspection');
}

async function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS');
  console.log('='.repeat(60));

  console.log(`\n✅ Passed: ${testResults.passed.length}`);
  testResults.passed.forEach(msg => console.log(`   • ${msg}`));

  if (testResults.failed.length > 0) {
    console.log(`\n❌ Failed: ${testResults.failed.length}`);
    testResults.failed.forEach(msg => console.log(`   • ${msg}`));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log(`App URL: ${APP_URL}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log('='.repeat(60) + '\n');

  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

async function main() {
  try {
    log('START', '════════════════════════════════════════════════');
    log('START', 'Document Upload Integration Test');
    log('START', '════════════════════════════════════════════════');

    await checkEnvironment();
    await createTestFile();

    log('', '');
    const user = await signupUser();
    const token = await loginUser();

    log('', '');
    const documentId = await uploadDocument(token);

    log('', '');
    const doc = await waitForProcessing(documentId);

    if (doc) {
      log('', '');
      await verifyChunks(documentId);
      await verifyEmbeddings(documentId);

      log('', '');
      await listDocuments(token);
    }

    await cleanup();
    await printResults();
  } catch (err) {
    console.error('\nTest execution failed:', err);
    await cleanup();
    process.exit(1);
  }
}

main();
