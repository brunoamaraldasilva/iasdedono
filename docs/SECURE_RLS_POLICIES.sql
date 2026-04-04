-- SECURE RLS POLICIES FOR PRODUCTION
-- Execute no Supabase SQL Editor

-- ============================================
-- 1. USERS TABLE - Secure Policies
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "users_select_public" ON public.users;
DROP POLICY IF EXISTS "users_insert_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_update_blocked" ON public.users;
DROP POLICY IF EXISTS "users_delete_blocked" ON public.users;
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "Allow admins to view all users" ON public.users;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow admins to update users" ON public.users;
DROP POLICY IF EXISTS "Allow admins to update user status and role" ON public.users;

-- SELECT: Public read (users table contains only non-sensitive data)
CREATE POLICY "users_select_public"
  ON public.users
  FOR SELECT
  USING (true);

-- INSERT: Only during signup via API (disabled for client)
CREATE POLICY "users_insert_blocked"
  ON public.users
  FOR INSERT
  WITH CHECK (false);  -- Only via API with service_role_key

-- UPDATE: Blocked - only via API with admin validation
CREATE POLICY "users_update_blocked"
  ON public.users
  FOR UPDATE
  USING (false);  -- Only via API with service_role_key

-- DELETE: Blocked completely
CREATE POLICY "users_delete_blocked"
  ON public.users
  FOR DELETE
  USING (false);


-- ============================================
-- 2. ADMIN AUDIT LOGS TABLE - Strict Policies
-- ============================================

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_blocked" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_blocked" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_blocked" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_blocked" ON public.admin_audit_logs;

-- SELECT: Completely blocked - only access via read-only API
CREATE POLICY "audit_logs_select_blocked"
  ON public.admin_audit_logs
  FOR SELECT
  USING (false);

-- INSERT: Blocked - only via API with admin validation
CREATE POLICY "audit_logs_insert_blocked"
  ON public.admin_audit_logs
  FOR INSERT
  WITH CHECK (false);

-- UPDATE: Blocked completely
CREATE POLICY "audit_logs_update_blocked"
  ON public.admin_audit_logs
  FOR UPDATE
  USING (false);

-- DELETE: Blocked completely
CREATE POLICY "audit_logs_delete_blocked"
  ON public.admin_audit_logs
  FOR DELETE
  USING (false);


-- ============================================
-- 3. VERIFY POLICIES ARE IN PLACE
-- ============================================

SELECT
  tablename,
  policyname,
  permissive,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('users', 'admin_audit_logs')
ORDER BY tablename, policyname;

-- Verify RLS is enabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('users', 'admin_audit_logs');
