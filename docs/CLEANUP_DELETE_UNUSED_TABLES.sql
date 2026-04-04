-- Delete unused tables (authors only)
-- Execute this in Supabase SQL Editor

-- Drop authors table if it exists
DROP TABLE IF EXISTS authors CASCADE;

-- ⚠️ DO NOT DELETE USERS - it's critical for authentication!
-- users table is used in app/api/auth/signup/route.ts

-- Verify deletion
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'authors';
-- Should return 0 rows
