-- =============================================================================
-- WHITELIST TABLE ENHANCEMENT - Add metadata and timestamps
-- =============================================================================
--
-- Purpose: Support external API imports with tracking metadata
-- Reason: Need to store source info (Shopify, manual import, etc) and update timestamps
--
-- =============================================================================

-- If whitelist table doesn't exist yet, create it with all fields:
CREATE TABLE IF NOT EXISTS whitelist (
  email TEXT PRIMARY KEY,
  status TEXT DEFAULT 'active', -- 'active' or 'inactive'
  metadata JSONB DEFAULT NULL, -- Store: { source, plan, imported_at, notes }
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- If table already exists, add missing columns:
ALTER TABLE whitelist
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

ALTER TABLE whitelist
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- =============================================================================
-- CREATE INDEXES (CRITICAL for performance)
-- =============================================================================

-- Primary lookup index (used by auth check)
CREATE INDEX IF NOT EXISTS idx_whitelist_email_active
ON whitelist(email, status);

-- Secondary index for status queries
CREATE INDEX IF NOT EXISTS idx_whitelist_status
ON whitelist(status);

-- Index for finding recently updated entries
CREATE INDEX IF NOT EXISTS idx_whitelist_updated_at_desc
ON whitelist(updated_at DESC);

-- =============================================================================
-- AUTO-UPDATE TIMESTAMP ON MODIFICATION
-- =============================================================================
-- Create trigger to automatically update the 'updated_at' timestamp

CREATE OR REPLACE FUNCTION update_whitelist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_whitelist_update_timestamp ON whitelist;

CREATE TRIGGER trigger_whitelist_update_timestamp
BEFORE UPDATE ON whitelist
FOR EACH ROW
EXECUTE FUNCTION update_whitelist_timestamp();

-- =============================================================================
-- ENABLE RLS (Row Level Security)
-- =============================================================================

ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to READ whitelist
CREATE POLICY IF NOT EXISTS "whitelist_read_authenticated"
ON whitelist
FOR SELECT
TO authenticated
USING (true);

-- Allow service role to WRITE whitelist (for bulk imports)
CREATE POLICY IF NOT EXISTS "whitelist_write_service_role"
ON whitelist
FOR ALL
TO service_role
USING (true);

-- =============================================================================
-- EXAMPLE DATA STRUCTURE (metadata field)
-- =============================================================================
--
-- After import via API:
-- INSERT INTO whitelist (email, status, metadata, created_at) VALUES
-- (
--   'buyer@example.com',
--   'active',
--   '{"source": "shopify", "plan": "pro", "shopify_customer_id": "123456", "imported_at": "2026-04-12T10:30:00Z"}',
--   now()
-- );
--
-- This allows tracking:
-- - Where the email came from (source)
-- - What plan they purchased
-- - External system references
-- - When they were imported
--

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check if table exists and has all fields:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'whitelist'
-- ORDER BY ordinal_position;
--
-- Should show:
-- ✓ email (text)
-- ✓ status (text)
-- ✓ metadata (jsonb)
-- ✓ created_at (timestamp)
-- ✓ updated_at (timestamp)

-- Check indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'whitelist';
--
-- Should show:
-- ✓ idx_whitelist_email_active
-- ✓ idx_whitelist_status
-- ✓ idx_whitelist_updated_at_desc

-- Test metadata storage:
-- SELECT email, status, metadata->>'source' as source
-- FROM whitelist
-- WHERE metadata IS NOT NULL
-- LIMIT 5;
