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
  const processedSessionRef = useRef<string | null>(null)  // Track which session we've already processed

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

        // NOTE: This now runs in background, not blocking render
        // RLS policy fixed to allow authenticated users to read
        const { data: whitelistEntry, error } = await supabase
          .from('whitelist')
          .select('status')
          .eq('email', userEmail.toLowerCase())
          .maybeSingle()

        if (error) {
          console.error('[WHITELIST-CHECK] Query error:', error)
          return true // Fail-open
        }

        console.log('[WHITELIST-CHECK] Query complete, entry:', whitelistEntry)
        if (whitelistEntry?.status === 'inactive') {
          console.warn('🔐 [AUTH] User is inactive:', userEmail)
          return false
        }
        console.log('[WHITELIST-CHECK] User is active, returning true')
        return true
      } catch (err) {
        console.error('[WHITELIST-CHECK] Unexpected error:', err)
        return true // Fail-open: allow user through
      }
    }

    // Função simples para carregar dados do usuário
    const loadUserData = async (userId: string, userEmail?: string) => {
      console.log('[LOAD-USER-DATA] Starting for userId:', userId)
      try {
        console.log('[LOAD-USER-DATA] Querying users table...')

        // NOTE: This now runs in background, not blocking render
        // RLS policy fixed to allow users to read their own data
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

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
      } catch (err) {
        console.error('[LOAD-USER-DATA] Error:', err)
        // Return minimal user object on error (running in background anyway)
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

        // CRITICAL FIX: Only process if session ID changed (prevents infinite loops)
        // onAuthStateChange fires multiple events (SIGNED_IN, INITIAL_SESSION) for same session
        // We only want to process each unique session once
        const currentSessionId = session?.user?.id || 'NONE'
        if (currentSessionId === processedSessionRef.current) {
          console.log('[AUTH-GUARD] Session already processed, skipping duplicate processing')
          return
        }
        processedSessionRef.current = currentSessionId
        console.log('[AUTH-GUARD] New session detected, processing...')

        if (session?.user) {
          console.log('[AUTH-PATH-A] User is logged in, email:', session.user.email)

          // ✅ CRITICAL OPTIMIZATION: Render immediately, verify in background
          // Don't block on whitelist/user data queries - they can timeout on SIGNED_IN events
          // Set loading=false FIRST so UI renders
          console.log('[AUTH-PATH-A-IMMEDIATE] setLoading(false) - RENDER APP NOW')
          setLoading(false)

          // 🔄 Load user data in background (fire and forget)
          // Don't block rendering on these queries
          loadUserData(session.user.id, session.user.email).then((userData) => {
            console.log('[AUTH-BACKGROUND] User data loaded:', !!userData)
            setUser(userData)

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
          }).catch((err) => {
            console.error('[AUTH-BACKGROUND] Error loading user data:', err)
            // Continue anyway - user is authenticated even if data load fails
          })

          // 🔄 Check whitelist status in background
          checkUserStatus(session.user.email).then((isActive) => {
            console.log('[AUTH-BACKGROUND] Whitelist check complete:', isActive)
            if (!isActive) {
              console.warn('🔐 [AUTH] User is inactive, logging out')
              supabase.auth.signOut()
              setUser(null)
            }
          }).catch((err) => {
            console.error('[AUTH-BACKGROUND] Error checking whitelist:', err)
            // Continue anyway - whitelist check failure shouldn't block auth
          })

          // Start auto-refresh: every 50 minutes
          // Supabase default token TTL is 1 hour, so refresh at 50min is safe
          if (!refreshIntervalId) {
            refreshIntervalId = setInterval(() => {
              refreshSession()
            }, 50 * 60 * 1000)
          }
        } else {
          console.log('[AUTH-PATH-B] No session, user not logged in')
          processedSessionRef.current = 'NONE'  // Reset for next login
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
