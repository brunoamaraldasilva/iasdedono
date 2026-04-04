-- FIX RLS POLICIES FOR ADMIN USERS TABLE
-- Execute no Supabase SQL Editor

-- 1. Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to recreate them
DROP POLICY IF EXISTS "Allow admins to view all users" ON public.users;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow admins to update users" ON public.users;

-- 3. Create policy: Admins can view all users
CREATE POLICY "Allow admins to view all users"
  ON public.users
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Create policy: Users can view their own profile
CREATE POLICY "Allow users to view their own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- 5. Create policy: Admins can update user status and role
CREATE POLICY "Allow admins to update users"
  ON public.users
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Verify policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
