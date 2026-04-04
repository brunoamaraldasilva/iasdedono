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

    // Timeout apenas para ESCONDER o loading visual, não para interromper autenticação
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('⚠️ [AUTH] Autenticação demorando, escondendo spinner...')
        setLoading(false) // Just hide spinner, auth continua em background
      }
    }, 12000) // 12 segundos

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
            // Usuário não existe, criar perfil
            const { error: createError } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: userEmail || '',
                name: '',
                role: 'user',
              })

            if (createError) throw createError

            // Recarregar dados criados
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

    // Check auth inicial
    const checkAuth = async () => {
      try {
        // Use getSession() instead of getUser() to avoid Supabase auth lock race condition
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        const authUser = session?.user

        if (sessionError || !authUser) {
          setUser(null)
          setLoading(false)
          return
        }

        // Carregar dados do usuário (passar email para evitar outra chamada a getUser)
        const userData = await loadUserData(authUser.id, authUser.email)
        setUser(userData)
        setLoading(false)

        // Broadcast para outras abas
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
      } catch (err) {
        console.error('Initial auth check failed:', err)
        setUser(null)
        setLoading(false)
      }
    }

    checkAuth()

    // Listen para mudanças de auth (login, logout, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Usuário logado
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
      } else {
        // Usuário fez logout
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
      }
    })

    // Cleanup
    return () => {
      clearTimeout(timeoutId)
      subscription?.unsubscribe()
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
