import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Lazy-load with validation to avoid build-time errors when env vars are not set
let supabaseInstance: ReturnType<typeof createClient> | null = null

export const supabase = (() => {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('⚠️ Missing Supabase environment variables - client will not be available')
      // Return a dummy client to avoid breaking imports during build
      return createClient('https://dummy.supabase.co', 'dummy-key', {
        auth: { persistSession: false },
      })
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        // Aumenta o timeout de lock para evitar race conditions
        // @ts-ignore - propriedade não tipificada mas funciona
        lockTimeoutMs: 5000,
      },
    })
  }
  return supabaseInstance
})()

// Server-side client with service role key for admin operations
export const createServerSupabaseClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !serviceKey) {
    console.error('⚠️ Missing Supabase service role key - returning anon client')
    // Fallback to anon client if service key is missing
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  })
}
