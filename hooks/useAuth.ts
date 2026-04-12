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
      if (!userEmail) return true

      try {
        const { data: whitelistEntry, error } = await supabase
          .from('whitelist')
          .select('status')
          .eq('email', userEmail.toLowerCase())
          .maybeSingle()

        if (error) {
          console.error('[AUTH] Whitelist check error:', error)
          return true // Fail-open
        }

        if (whitelistEntry?.status === 'inactive') {
          console.warn('🔐 [AUTH] User is inactive:', userEmail)
          return false
        }
        return true
      } catch (err) {
        console.error('[AUTH] Whitelist check failed:', err)
        return true // Fail-open: allow user through
      }
    }

    // Função simples para carregar dados do usuário
    const loadUserData = async (userId: string, userEmail?: string) => {
      try {
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (dbError) {
          if (dbError.code === 'PGRST116') {
            // User not found, create entry
            const { error: createError } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: userEmail || '',
                name: '',
                role: 'user',
              })

            if (createError) throw createError
            return loadUserData(userId)
          }
          throw dbError
        }

        return userData
      } catch (err) {
        console.error('[AUTH] Error loading user data:', err)
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
        const { data, error } = await supabase.auth.refreshSession()

        if (error) {
          console.error('[AUTH] Token refresh failed:', error.message)
          // If refresh fails, user MUST logout (token is expired/invalid)
          await supabase.auth.signOut()
          setUser(null)
          setLoading(false)
          return
        }
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
        // Only process if session ID changed (prevents infinite loops on multiple events)
        // onAuthStateChange fires multiple events (SIGNED_IN, INITIAL_SESSION) for same session
        const currentSessionId = session?.user?.id || 'NONE'
        if (currentSessionId === processedSessionRef.current) {
          return // Already processed this session
        }
        processedSessionRef.current = currentSessionId

        if (session?.user) {
          // ✅ CRITICAL OPTIMIZATION: Render immediately, verify in background
          // Don't block on whitelist/user data queries - they run in background
          setLoading(false)

          // 🔄 Load user data in background (fire and forget)
          loadUserData(session.user.id, session.user.email).then((userData) => {
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
            console.error('[AUTH] Error loading user data:', err)
            // Continue anyway - user is authenticated even if data load fails
          })

          // 🔄 Check whitelist status in background
          checkUserStatus(session.user.email).then((isActive) => {
            if (!isActive) {
              console.warn('🔐 [AUTH] User is inactive, logging out')
              supabase.auth.signOut()
              setUser(null)
            }
          }).catch((err) => {
            console.error('[AUTH] Error checking whitelist:', err)
            // Continue anyway - whitelist check failure shouldn't block auth
          })

          // Start auto-refresh: every 50 minutes
          if (!refreshIntervalId) {
            refreshIntervalId = setInterval(() => {
              refreshSession()
            }, 50 * 60 * 1000)
          }
        } else {
          processedSessionRef.current = 'NONE'  // Reset for next login
          setUser(null)
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
        console.error('[AUTH] Unexpected error in auth handler:', err)
        setUser(null)
        setLoading(false)
      }
    })

    // Cleanup
    return () => {
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
