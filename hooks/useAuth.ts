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
        const { data: whitelistEntry } = await supabase
          .from('whitelist')
          .select('status')
          .eq('email', userEmail.toLowerCase())
          .maybeSingle()

        if (whitelistEntry?.status === 'inactive') {
          console.warn('🔐 [AUTH] User is inactive:', userEmail)
          return false
        }
        return true
      } catch (err) {
        console.error('[AUTH] Error checking user status:', err)
        return true
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
        console.error('Error loading user data:', err)
        return null
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

    // Check auth on mount - NO TIMEOUTS
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        const authUser = session?.user

        if (sessionError || !authUser) {
          setUser(null)
          console.log('[AUTH] No authenticated user found')
          setLoading(false)
          return
        }

        const isActive = await checkUserStatus(authUser.email)
        if (!isActive) {
          console.warn('🔐 [AUTH] Inactive user session, forcing logout')
          await supabase.auth.signOut()
          setUser(null)
          setLoading(false)
          return
        }

        const userData = await loadUserData(authUser.id, authUser.email)
        setUser(userData)
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

        // Start auto-refresh: every 50 minutes (3000000 ms)
        // Supabase default token TTL is 1 hour, so refresh at 50min is safe
        if (!refreshIntervalId) {
          refreshIntervalId = setInterval(() => {
            refreshSession()
          }, 50 * 60 * 1000)
        }
      } catch (err) {
        console.error('[AUTH] Auth check failed:', err instanceof Error ? err.message : String(err))
        setUser(null)
        setLoading(false)
      }
    }

    // Start auth check
    checkAuth()

    // Listen para mudanças de auth (login, logout, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      try {
        if (session?.user) {
          const isActive = await checkUserStatus(session.user.email)
          if (!isActive) {
            console.warn('🔐 [AUTH] User became inactive, logging out')
            await supabase.auth.signOut()
            setUser(null)
            return
          }

          const userData = await loadUserData(session.user.id, session.user.email)
          setUser(userData)

          if (broadcastChannelRef.current) {
            try {
              broadcastChannelRef.current.postMessage({
                type: 'AUTH_CHANGE',
                user: userData,
              })
            } catch (err) {
              // Ignorar erro de broadcast
            }
          }

          // Restart refresh interval on auth change
          if (refreshIntervalId) clearInterval(refreshIntervalId)
          refreshIntervalId = setInterval(() => {
            refreshSession()
          }, 50 * 60 * 1000)
        } else {
          setUser(null)

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
        console.error('[AUTH] Error in auth state change handler:', err)
        setUser(null)
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
