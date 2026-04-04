-- DISABLE RLS - PROTECT VIA MIDDLEWARE INSTEAD
-- Execute no Supabase SQL Editor

-- 1. Drop all policies
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "Allow admins to view all users" ON public.users;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow admins to update users" ON public.users;
DROP POLICY IF EXISTS "Allow admins to update user status and role" ON public.users;

-- 2. Disable RLS on users table
-- Security will be handled via Next.js middleware + API routes
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 3. Verify
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'users';
