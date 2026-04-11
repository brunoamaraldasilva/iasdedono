import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Create Supabase client - env vars must be available at runtime
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
