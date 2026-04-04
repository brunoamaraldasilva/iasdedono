-- Fix business_context table - Simple version without array functions

-- Check current column types
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_context'
AND column_name IN ('main_goals', 'main_challenges');

-- If they're still TEXT[], convert them to TEXT
-- Drop and recreate without array type
ALTER TABLE business_context
DROP COLUMN IF EXISTS main_goals CASCADE;

ALTER TABLE business_context
ADD COLUMN main_goals TEXT DEFAULT NULL;

ALTER TABLE business_context
DROP COLUMN IF EXISTS main_challenges CASCADE;

ALTER TABLE business_context
ADD COLUMN main_challenges TEXT DEFAULT NULL;

-- Verify
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'business_context'
AND column_name IN ('main_goals', 'main_challenges');
