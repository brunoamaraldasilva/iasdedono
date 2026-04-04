-- DISABLE RLS ON USERS TABLE (SIMPLER APPROACH)
-- Users table contains only non-sensitive public user data
-- Execute no Supabase SQL Editor

-- 1. Drop ALL policies first
DROP POLICY IF EXISTS "Allow admins to view all users" ON public.users;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow admins to update users" ON public.users;
DROP POLICY IF EXISTS "Allow admins to update user status and role" ON public.users;

-- 2. DISABLE RLS entirely on users table
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 3. Verify RLS is disabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'users';
