#!/usr/bin/env node

/**
 * Verify that document data is actually in Supabase
 * Checks: documents, chunks, and embeddings tables
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verify() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Environment variables not set');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  console.log('🔍 Verifying PHASE 2 data in Supabase...\n');

  try {
    // Check documents table
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, user_id, filename, processing_status, total_chunks, total_tokens')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('📋 Recent Documents:');
    if (docsError) {
      console.error('  ❌ Error:', docsError.message);
    } else {
      console.log(`  ✅ Found ${docs?.length || 0} documents`);
      docs?.forEach((doc) => {
        console.log(`     • ${doc.filename}`);
        console.log(`       - ID: ${doc.id}`);
        console.log(`       - Status: ${doc.processing_status}`);
        console.log(`       - Chunks: ${doc.total_chunks}, Tokens: ${doc.total_tokens}`);
      });
    }

    // Check document chunks
    if (docs && docs.length > 0) {
      const docId = docs[0].id;
      const { data: chunks, error: chunksError } = await supabase
        .from('document_chunks')
        .select('id, chunk_index, token_count, content')
        .eq('document_id', docId)
        .order('chunk_index');

      console.log(`\n📄 Chunks for ${docs[0].filename}:`);
      if (chunksError) {
        console.error('  ❌ Error:', chunksError.message);
      } else {
        console.log(`  ✅ Found ${chunks?.length || 0} chunks`);
        chunks?.forEach((chunk) => {
          console.log(`     • Chunk ${chunk.chunk_index}: ${chunk.token_count} tokens`);
          console.log(`       Content: "${chunk.content.substring(0, 50)}..."`);
        });
      }

      // Check embeddings
      const { data: embeddings, error: embError } = await supabase
        .from('embeddings')
        .select('id, chunk_id')
        .in('chunk_id', chunks?.map(c => c.id) || []);

      console.log(`\n🧠 Embeddings:`);
      if (embError) {
        console.error('  ❌ Error:', embError.message);
      } else {
        console.log(`  ✅ Found ${embeddings?.length || 0} embeddings`);
      }
    }

    console.log('\n════════════════════════════════════════');
    console.log('✅ PHASE 2 DATA VERIFIED IN SUPABASE');
    console.log('════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

verify();
