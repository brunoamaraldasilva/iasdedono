'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Server-side client that uses cookies for user-authenticated operations
export const createAuthenticatedServerSupabaseClient = async () => {
  const cookieStore = await cookies()

  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          cookie: cookieStore.toString(),
        },
      },
    }
  )
}
