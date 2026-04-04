-- Whitelist Implementation for C-Lvls V1
-- Execute this in Supabase SQL Editor

-- Step 1: Create authorized_users table
CREATE TABLE authorized_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  first_name TEXT,
  last_name TEXT,
  company_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Create indexes for fast lookup
CREATE INDEX idx_authorized_users_email ON authorized_users(email);
CREATE INDEX idx_authorized_users_status ON authorized_users(status);
CREATE INDEX idx_authorized_users_status_email ON authorized_users(email, status);

-- Step 3: Enable RLS (Row Level Security)
ALTER TABLE authorized_users ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policy - Allow public read (for signup validation)
CREATE POLICY "Whitelist is publicly readable for signup check" ON authorized_users
  FOR SELECT
  USING (true);

-- Step 5: Verify setup
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE tablename = 'authorized_users';

-- Step 6: Test data (optional - for testing only)
-- INSERT INTO authorized_users (email, status, first_name, last_name) VALUES
-- ('test@example.com', 'active', 'Test', 'User'),
-- ('inactive@example.com', 'inactive', 'Inactive', 'User'),
-- ('amaral.bruno@ifm.com', 'active', 'Bruno', 'Amaral');

-- Step 7: Verify table created
SELECT COUNT(*) as total_users FROM authorized_users;
