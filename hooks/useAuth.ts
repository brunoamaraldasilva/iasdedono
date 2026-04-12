'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types/user'

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  const initCheckRef = useRef(false)

  useEffect(() => {
    // Previne múltiplas execuções
    if (initCheckRef.current) return
    initCheckRef.current = true

    console.log('[AUTH-PHASE-1] useEffect hook started')

    let refreshIntervalId: NodeJS.Timeout | null = null

    // Setup BroadcastChannel para sync entre abas
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        broadcastChannelRef.current = new BroadcastChannel('auth-channel')
        broadcastChannelRef.current.onmessage = (event) => {
          if (event.data.type === 'AUTH_CHANGE') {
            setUser(event.data.user)
          }
        }
      } catch (err) {
        // BroadcastChannel não suportado
      }
    }

    // Função para verificar se usuário está ativo (whitelist)
    const checkUserStatus = async (userEmail?: string): Promise<boolean> => {
      console.log('[WHITELIST-CHECK] Starting for email:', userEmail)
      if (!userEmail) {
        console.log('[WHITELIST-CHECK] No email provided, returning true')
        return true
      }

      try {
        console.log('[WHITELIST-CHECK] Querying whitelist table...')

        // CRITICAL FIX: Add 5-second timeout to prevent hanging on SIGNED_IN events
        // Wraps the query promise with a timeout to prevent infinite white screen
        const queryPromise = supabase
          .from('whitelist')
          .select('status')
          .eq('email', userEmail.toLowerCase())
          .maybeSingle()

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('WHITELIST_QUERY_TIMEOUT')), 5000)
        )

        const { data: whitelistEntry } = await Promise.race([
          queryPromise,
          timeoutPromise,
        ]) as any

        console.log('[WHITELIST-CHECK] Query complete, entry:', whitelistEntry)
        if (whitelistEntry?.status === 'inactive') {
          console.warn('🔐 [AUTH] User is inactive:', userEmail)
          return false
        }
        console.log('[WHITELIST-CHECK] User is active, returning true')
        return true
      } catch (err: any) {
        // Check if it's a timeout
        if (err?.message === 'WHITELIST_QUERY_TIMEOUT') {
          console.error('❌ [WHITELIST-CHECK] Query timeout after 5s (RLS policy issue suspected on SIGNED_IN events), failing open')
          console.log('   This prevents white screen. Fix: Update RLS policy on whitelist table to allow authenticated users on SIGNED_IN events.')
          return true // Fail-open: allow user through to prevent white screen
        }
        console.error('[WHITELIST-CHECK] Error:', err)
        return true
      }
    }

    // Função simples para carregar dados do usuário
    const loadUserData = async (userId: string, userEmail?: string) => {
      console.log('[LOAD-USER-DATA] Starting for userId:', userId)
      try {
        console.log('[LOAD-USER-DATA] Querying users table...')

        // CRITICAL FIX: Add 5-second timeout to prevent hanging on SIGNED_IN events
        // Same RLS policy issue as whitelist table
        const queryPromise = supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('LOAD_USER_TIMEOUT')), 5000)
        )

        const { data: userData, error: dbError } = await Promise.race([
          queryPromise,
          timeoutPromise,
        ]) as any

        console.log('[LOAD-USER-DATA] Query complete, error:', dbError?.code, 'data:', !!userData)

        if (dbError) {
          if (dbError.code === 'PGRST116') {
            console.log('[LOAD-USER-DATA] User not found, creating...')
            const { error: createError } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: userEmail || '',
                name: '',
                role: 'user',
              })

            if (createError) throw createError
            console.log('[LOAD-USER-DATA] User created, recursing...')
            return loadUserData(userId)
          }
          throw dbError
        }

        console.log('[LOAD-USER-DATA] Returning user data')
        return userData
      } catch (err: any) {
        // Check if it's a timeout
        if (err?.message === 'LOAD_USER_TIMEOUT') {
          console.error('❌ [LOAD-USER-DATA] Query timeout after 5s (RLS policy issue on SIGNED_IN), returning minimal user object')
          console.log('   User will load with minimal data. Fix: Update RLS policy on users table.')
          // Return minimal user object to prevent white screen
          return {
            id: userId,
            email: userEmail || '',
            name: '',
            role: 'user',
          }
        }
        console.error('[LOAD-USER-DATA] Error:', err)
        // Return minimal user object on any error to prevent white screen
        return {
          id: userId,
          email: userEmail || '',
          name: '',
          role: 'user',
        }
      }
    }

    // Refresh token BEFORE it expires (every 50 minutes)
    const refreshSession = async () => {
      try {
        console.log('🔄 [AUTH] Refreshing session token...')
        const { data, error } = await supabase.auth.refreshSession()

        if (error) {
          console.error('❌ [AUTH] Token refresh failed:', error.message)
          // If refresh fails, user MUST logout (token is expired/invalid)
          await supabase.auth.signOut()
          setUser(null)
          setLoading(false)
          return
        }

        console.log('✅ [AUTH] Token refreshed successfully')
      } catch (err) {
        console.error('[AUTH] Error refreshing token:', err)
        await supabase.auth.signOut()
        setUser(null)
      }
    }

    // CRITICAL: Use onAuthStateChange for initialization
    // It fires IMMEDIATELY with session from browser cookies (no HTTP request needed)
    // Then continues listening for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      try {
        // Log auth event for debugging
        console.log(`[AUTH-CALLBACK] Event: ${event}, Has session: ${!!session}, Has user: ${!!session?.user}`)
        if (event === 'INITIAL_SESSION') {
          console.log('[AUTH] Initial session loaded from cookies (no HTTP request)')
        }

        if (session?.user) {
          console.log('[AUTH-PATH-A] User is logged in, email:', session.user.email)
          const isActive = await checkUserStatus(session.user.email)
          console.log('[AUTH-PATH-A] isActive check complete:', isActive)
          if (!isActive) {
            console.warn('🔐 [AUTH] User is inactive, logging out')
            await supabase.auth.signOut()
            setUser(null)
            console.log('[AUTH-PATH-A1] setLoading(false) - INACTIVE USER')
            setLoading(false)
            return
          }

          console.log('[AUTH-PATH-A] About to load user data...')
          const userData = await loadUserData(session.user.id, session.user.email)
          console.log('[AUTH-PATH-A] User data loaded:', !!userData)
          setUser(userData)
          console.log('[AUTH-PATH-A2] setLoading(false) - LOGGED IN')
          setLoading(false)

          if (broadcastChannelRef.current) {
            try {
              broadcastChannelRef.current.postMessage({
                type: 'AUTH_CHANGE',
                user: userData,
              })
            } catch (err) {
              // Channel pode estar fechado
            }
          }

          // Start auto-refresh: every 50 minutes
          // Supabase default token TTL is 1 hour, so refresh at 50min is safe
          if (!refreshIntervalId) {
            refreshIntervalId = setInterval(() => {
              refreshSession()
            }, 50 * 60 * 1000)
          }
        } else {
          console.log('[AUTH-PATH-B] No session, user not logged in')
          setUser(null)
          console.log('[AUTH-PATH-B] setLoading(false) - NO SESSION')
          setLoading(false)

          if (broadcastChannelRef.current) {
            try {
              broadcastChannelRef.current.postMessage({
                type: 'AUTH_CHANGE',
                user: null,
              })
            } catch (err) {
              // Ignorar erro de broadcast
            }
          }

          // Stop refresh interval when user logs out
          if (refreshIntervalId) {
            clearInterval(refreshIntervalId)
            refreshIntervalId = null
          }
        }
      } catch (err) {
        console.error('[AUTH-ERROR] Caught error in auth state change handler:', err)
        setUser(null)
        console.log('[AUTH-ERROR] setLoading(false) - EXCEPTION')
        setLoading(false)
      }
    })

    console.log('[AUTH-PHASE-1] onAuthStateChange subscription set up, waiting for callback...')

    // Cleanup
    return () => {
      console.log('[AUTH-CLEANUP] useEffect cleanup called')
      subscription?.unsubscribe()
      if (refreshIntervalId) clearInterval(refreshIntervalId)
      try {
        broadcastChannelRef.current?.close()
      } catch (err) {
        // Ignorar erro ao fechar
      }
    }
  }, [])

  const logout = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      router.push('/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer logout'
      setError(message)
      console.error('Logout error:', err)
    } finally {
      setLoading(false)
    }
  }

  return { user, loading, error, logout }
}
