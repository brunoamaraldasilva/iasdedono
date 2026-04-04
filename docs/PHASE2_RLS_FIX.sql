-- ===============================
-- FIX: RLS Policies for Document Upload
-- The original policies need to be split by operation type
-- ===============================

-- DROP existing policies
DROP POLICY IF EXISTS "users_see_own_documents" ON documents;
DROP POLICY IF EXISTS "users_see_own_chunks" ON document_chunks;
DROP POLICY IF EXISTS "users_see_own_embeddings" ON embeddings;

-- ===============================
-- DOCUMENTS TABLE Policies
-- ===============================

-- SELECT: User can only see their own documents
CREATE POLICY "users_select_own_documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: User can only insert their own documents
CREATE POLICY "users_insert_own_documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: User can only update their own documents
CREATE POLICY "users_update_own_documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: User can only delete their own documents
CREATE POLICY "users_delete_own_documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- ===============================
-- DOCUMENT_CHUNKS TABLE Policies
-- ===============================

-- SELECT: User can see chunks of their own documents
CREATE POLICY "users_select_own_chunks"
  ON document_chunks FOR SELECT
  USING (
    document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
  );

-- INSERT: User can insert chunks for their own documents
CREATE POLICY "users_insert_own_chunks"
  ON document_chunks FOR INSERT
  WITH CHECK (
    document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
  );

-- UPDATE: User can update chunks of their own documents
CREATE POLICY "users_update_own_chunks"
  ON document_chunks FOR UPDATE
  USING (
    document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
  )
  WITH CHECK (
    document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
  );

-- DELETE: User can delete chunks of their own documents
CREATE POLICY "users_delete_own_chunks"
  ON document_chunks FOR DELETE
  USING (
    document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
  );

-- ===============================
-- EMBEDDINGS TABLE Policies
-- ===============================

-- SELECT: User can see embeddings of their own chunks
CREATE POLICY "users_select_own_embeddings"
  ON embeddings FOR SELECT
  USING (
    chunk_id IN (
      SELECT dc.id FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- INSERT: User can insert embeddings for their own chunks
CREATE POLICY "users_insert_own_embeddings"
  ON embeddings FOR INSERT
  WITH CHECK (
    chunk_id IN (
      SELECT dc.id FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- UPDATE: User can update embeddings of their own chunks
CREATE POLICY "users_update_own_embeddings"
  ON embeddings FOR UPDATE
  USING (
    chunk_id IN (
      SELECT dc.id FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    chunk_id IN (
      SELECT dc.id FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- DELETE: User can delete embeddings of their own chunks
CREATE POLICY "users_delete_own_embeddings"
  ON embeddings FOR DELETE
  USING (
    chunk_id IN (
      SELECT dc.id FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- Verification
SELECT 'RLS policies updated successfully' as status;
