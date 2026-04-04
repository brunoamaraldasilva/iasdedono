import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

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
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    {
      auth: {
        persistSession: false,
      },
    }
  )
}
