-- ===============================
-- PHASE 2: Document Upload Schema
-- Execute this in Supabase SQL Editor
-- ===============================

-- STEP 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- STEP 2: Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'csv')),
  file_path TEXT NOT NULL,

  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'error')),
  error_message TEXT,
  extracted_text TEXT,

  total_chunks INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- STEP 3: Create document_chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- STEP 4: Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,

  embedding vector(1536),

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- STEP 5: Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create RLS Policies
-- Documents: User can only see their own
CREATE POLICY "users_see_own_documents"
  ON documents FOR ALL USING (auth.uid() = user_id);

-- Chunks: User can see chunks of their own documents
CREATE POLICY "users_see_own_chunks"
  ON document_chunks FOR ALL
  USING (
    document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
  );

-- Embeddings: User can see embeddings of their own chunks
CREATE POLICY "users_see_own_embeddings"
  ON embeddings FOR ALL
  USING (
    chunk_id IN (
      SELECT dc.id FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- STEP 7: Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_id ON embeddings(chunk_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);

-- STEP 8: Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at_trigger ON documents;
CREATE TRIGGER documents_updated_at_trigger
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_documents_updated_at();

-- STEP 9: Create Supabase Storage bucket
-- Execute in Supabase Dashboard: Storage → Create Bucket
-- Name: documents
-- Public: No (private)
-- Allowed MIME types: application/pdf, text/csv

-- ===============================
-- Verificação: Execute this to verify everything is created
-- ===============================
SELECT
  'documents' as table_name,
  COUNT(*) as row_count
FROM documents
UNION ALL
SELECT 'document_chunks', COUNT(*) FROM document_chunks
UNION ALL
SELECT 'embeddings', COUNT(*) FROM embeddings;
