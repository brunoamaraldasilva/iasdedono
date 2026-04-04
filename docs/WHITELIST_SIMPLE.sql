-- Simple Whitelist Table Setup
-- Execute this in Supabase SQL Editor

-- Drop old table if it exists
DROP TABLE IF EXISTS whitelist CASCADE;

-- Create simple whitelist table
CREATE TABLE whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for fast email lookup
CREATE INDEX idx_whitelist_email ON whitelist(email);

-- Enable RLS
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;

-- Allow public read (for signup check)
CREATE POLICY "Whitelist is readable" ON whitelist
  FOR SELECT
  USING (true);

-- Test query - should return 0 rows
SELECT COUNT(*) as total_authorized FROM whitelist;
