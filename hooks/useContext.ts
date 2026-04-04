'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface BusinessContext {
  id: string
  user_id: string
  business_name: string | null
  business_type: string | null
  description: string | null
  industry: string | null
  annual_revenue: number | null
  team_size: number | null
  founded_year: number | null
  main_goals: string | string[] | null
  main_challenges: string | string[] | null
  target_market: string | null
  main_competitors: string | null
  goals: string | null
  additional_info: Record<string, any> | null
  is_completed: boolean
  completion_percentage: number
  created_at: string
  updated_at: string
}

export function useContext() {
  const { user } = useAuth()
  const [context, setContext] = useState<BusinessContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Carregar contexto ao montar
  useEffect(() => {
    if (!user) return
    loadContext()
  }, [user])

  async function loadContext() {
    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('business_context')
        .select('*')
        .eq('user_id', user!.id)
        .single()

      if (err) {
        if (err.code === 'PGRST116') {
          // Contexto não existe, criar vazio
          const { data: newContext, error: insertErr } = await supabase
            .from('business_context')
            .insert({
              user_id: user!.id,
            })
            .select()
            .single()

          if (insertErr) throw insertErr
          setContext(newContext)
        } else {
          throw err
        }
      } else {
        setContext(data)
      }
    } catch (err) {
      console.error('Error loading context:', err)
      setError(err instanceof Error ? err.message : 'Erro ao carregar contexto')
    } finally {
      setLoading(false)
    }
  }

  async function updateContext(updates: Partial<BusinessContext>) {
    if (!context || !user) return

    try {
      const { data, error: err } = await supabase
        .from('business_context')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single()

      if (err) throw err
      setContext(data)
    } catch (err) {
      console.error('Error updating context:', err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar contexto')
    }
  }

  return { context, loading, error, updateContext }
}
