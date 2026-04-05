/**
 * User Profile Synchronization
 * Safely syncs auth.users to user_profiles table (for indexing + RLS)
 *
 * Called from:
 * - /app/api/auth/signup/route.ts (on user creation)
 * - /app/api/auth/login/route.ts (on login, if missing)
 */

import { createServerSupabaseClient } from '@/lib/supabase'

export async function syncUserProfile(userId: string, email: string): Promise<void> {
  try {
    const supabase = createServerSupabaseClient()

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (existing) {
      console.log('✅ [SYNC] User profile already exists:', email)
      return
    }

    // Insert new user profile
    const { error } = await supabase
      .from('user_profiles')
      .insert([
        {
          id: userId,
          email: email.toLowerCase(),
        },
      ])

    if (error) {
      console.error('❌ [SYNC] Error syncing user profile:', error)
      // Don't throw - auth should not fail if user_profiles insert fails
      return
    }

    console.log('✅ [SYNC] User profile created:', email)
  } catch (error) {
    console.error('❌ [SYNC] Unexpected error syncing user profile:', error)
    // Silent fail - auth must never break due to this function
  }
}
