-- PHASE 2: Add document persistence to messages table
-- This migration allows messages to store which documents were attached

-- Add document_ids array column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS document_ids TEXT[] DEFAULT NULL;

-- Create index for faster queries (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_messages_has_documents
ON messages USING gin (document_ids);

-- Test query to verify:
-- SELECT id, content, document_ids FROM messages WHERE document_ids IS NOT NULL;
