-- SECURE RLS POLICIES FOR USERS TABLE
-- Execute no Supabase SQL Editor

-- 1. ENABLE RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "Allow admins to view all users" ON public.users;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow admins to update users" ON public.users;
DROP POLICY IF EXISTS "Allow admins to update user status and role" ON public.users;

-- 3. Policy: SELECT - Users see own profile OR admins see all
CREATE POLICY "users_select"
  ON public.users
  FOR SELECT
  USING (
    auth.uid() = id  -- User sees their own row
    OR
    (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))  -- Admin sees all
  );

-- 4. Policy: UPDATE - Only admins can update users
CREATE POLICY "users_update"
  ON public.users
  FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- 5. Verify policies are in place
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
