-- =============================================================================
-- FIX RLS POLICIES - Allow SIGNED_IN auth state to query tables
-- =============================================================================
--
-- PROBLEM:
-- - INITIAL_SESSION (cached): RLS policies work ✅
-- - SIGNED_IN (fresh auth): RLS policies block queries ❌
--
-- ROOT CAUSE:
-- - Current RLS policies are too restrictive during SIGNED_IN auth state
-- - Client-side queries hang indefinitely when auth state changes
--
-- SOLUTION:
-- - Remove row-level restrictions from read operations
-- - Allow all authenticated users to READ whitelist and users tables
-- - These are lookup operations, not data sharing
-- - Write operations still require ownership check
--
-- =============================================================================

-- ============================================================================
-- TABLE: whitelist (email lookup for auth checks)
-- ============================================================================
-- This table is used to verify user email during login/auth
-- ALL authenticated users should be able to query it (read-only)

-- Step 1: DISABLE old restrictive policies (if they exist)
DROP POLICY IF EXISTS "whitelist_select" ON whitelist;
DROP POLICY IF EXISTS "Users can read whitelist" ON whitelist;

-- Step 2: CREATE new permissive read policy for authenticated users
CREATE POLICY "whitelist_read_authenticated"
ON whitelist
FOR SELECT
TO authenticated
USING (true);  -- All authenticated users can read all whitelist entries

-- Step 3: Protect write operations (only admin via service role)
CREATE POLICY "whitelist_write_service_role"
ON whitelist
FOR INSERT, UPDATE, DELETE
TO service_role
USING (true);

-- ============================================================================
-- TABLE: users (user profile data)
-- ============================================================================
-- Each user can read/write their own profile
-- Anyone authenticated can read their own entry

-- Step 1: DISABLE old policies
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Step 2: CREATE new policies
CREATE POLICY "users_read_own"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);  -- Can only read own user record

CREATE POLICY "users_update_own"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)  -- Can only update own record
WITH CHECK (auth.uid() = id);

CREATE POLICY "users_insert_own"
ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);  -- Can only insert own record

-- Allow service role (backend) to manage all users
CREATE POLICY "users_service_role"
ON users
FOR ALL
TO service_role
USING (true);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- After applying these policies, verify with:
--
-- SELECT * FROM whitelist WHERE email = 'test@example.com';
-- -- Should return instantly (all auth users can read)
--
-- SELECT * FROM users WHERE id = auth.uid();
-- -- Should return user's own data instantly
--
-- =============================================================================
