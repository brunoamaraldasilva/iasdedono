-- ===============================
-- PHASE 2: Migrate Documents to be Conversation-Scoped
-- Change documents from global to conversation-specific
-- ===============================

-- STEP 1: Add conversation_id to documents table
ALTER TABLE documents
ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

-- STEP 2: Make conversation_id required (but allow NULL for migration)
-- First, optional
ALTER TABLE documents ALTER COLUMN conversation_id DROP NOT NULL;

-- STEP 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_conversation_id ON documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_conversation ON documents(user_id, conversation_id);

-- STEP 4: Update RLS Policies to include conversation_id
-- Documents can now be accessed by:
-- 1. The user who owns the document, OR
-- 2. Any user in the conversation

DROP POLICY IF EXISTS "users_select_own_documents" ON documents;
CREATE POLICY "users_select_own_documents"
  ON documents FOR SELECT
  USING (
    auth.uid() = user_id OR
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "users_insert_own_documents" ON documents;
CREATE POLICY "users_insert_own_documents"
  ON documents FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      conversation_id IS NULL OR
      conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "users_update_own_documents" ON documents;
CREATE POLICY "users_update_own_documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_documents" ON documents;
CREATE POLICY "users_delete_own_documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- STEP 5: Verification
SELECT 'Migration complete!' as status;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'documents' AND column_name = 'conversation_id';
