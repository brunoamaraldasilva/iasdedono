'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface ContextData {
  id: string
  user_id: string
  business_name: string | null
  business_type: string | null
  description: string | null
  industry: string | null
  annual_revenue: number | null
  team_size: number | null
  founded_year: number | null
  main_goals: string | null
  main_challenges: string | null
  target_market: string | null
  main_competitors: string | null
  additional_info: Record<string, any> | null
  is_completed: boolean
  completion_percentage: number
  created_at: string
  updated_at: string
}

export default function ContextPage() {
  const { user } = useAuth()
  const [context, setContext] = useState<ContextData | null>(null)
  const [completion, setCompletion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Carregar contexto ao montar
  useEffect(() => {
    if (!user) return
    loadContext()
  }, [user])

  // Auto-save com debounce
  useEffect(() => {
    if (!context || !user || saving) return

    const timer = setTimeout(async () => {
      setSaving(true)
      try {
        console.log('💾 [CONTEXT] Attempting to save with user_id:', user.id)
        console.log('💾 [CONTEXT] Data to save:', context)

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('Session expired')
        }

        // Call backend API to save (bypasses RLS)
        const response = await fetch('/api/context/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(context),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to save context')
        }

        const result = await response.json()
        console.log('✅ [CONTEXT] Saved successfully:', result)

        if (result.completion_percentage !== undefined) {
          setCompletion(result.completion_percentage)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : JSON.stringify(err)
        console.error('❌ Error saving context:', errorMsg)
      } finally {
        setSaving(false)
      }
    }, 1000) // Salvar 1 segundo depois de parar de digitar

    return () => clearTimeout(timer)
  }, [context, user])

  async function loadContext() {
    try {
      setLoading(true)
      console.log('📖 [CONTEXT] Loading context for user:', user!.id)

      const { data, error } = await supabase
        .from('business_context')
        .select('*')
        .eq('user_id', user!.id)
        .single()

      console.log('📖 [CONTEXT] Load response:', { error: error?.message, hasData: !!data })

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('❌ [CONTEXT] Error loading:', error)
          throw error
        }
        console.log('⚠️ [CONTEXT] No context found (PGRST116), creating new...')
      }

      if (data) {
        console.log('✅ [CONTEXT] Loaded context:', data)
        setContext(data)
        setCompletion(data.completion_percentage)
      } else {
        // Create empty context with user_id
        const emptyContext: ContextData = {
          id: '',
          user_id: user!.id,
          business_name: null,
          business_type: null,
          description: null,
          industry: null,
          annual_revenue: null,
          team_size: null,
          founded_year: null,
          main_goals: null,
          main_challenges: null,
          target_market: null,
          main_competitors: null,
          additional_info: null,
          is_completed: false,
          completion_percentage: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        console.log('📝 [CONTEXT] Setting empty context')
        setContext(emptyContext)
        setCompletion(0)
      }
    } catch (err) {
      console.error('❌ [CONTEXT] Error loading context:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !context) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#161616' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando contexto...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto flex flex-col" style={{ backgroundColor: '#161616' }}>
      {/* Header */}
      <div className="border-b p-4 md:p-6 bg-[#222423] flex-shrink-0" style={{ borderColor: '#333333' }}>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Contexto do Negócio</h1>
        <p className="text-xs md:text-sm text-gray-400">Preencha as informações sobre seu negócio para melhores resultados dos assistentes</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          {/* Progress Bar */}
          <div className="mb-6 md:mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-xs md:text-sm text-gray-300">Preenchimento do Contexto</span>
              <span style={{ color: '#e0521d' }} className="text-xs md:text-sm font-semibold">{completion}%</span>
            </div>
            <div className="w-full bg-[#333333] rounded-full h-2 md:h-3">
              <div
                className="h-2 md:h-3 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: completion >= 75 ? '#10b981' : '#e0521d',
                  width: `${completion}%`
                }}
              />
            </div>
          </div>

          {/* Form Fields */}
          <form className="space-y-4 md:space-y-6">
          {/* Business Name */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Nome da Empresa *
            </label>
            <input
              type="text"
              value={context.business_name || ''}
              onChange={(e) => setContext({ ...context, business_name: e.target.value })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Ex: Tech Solutions Brasil"
            />
          </div>

          {/* Business Type */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Tipo de Negócio *
            </label>
            <input
              type="text"
              value={context.business_type || ''}
              onChange={(e) => setContext({ ...context, business_type: e.target.value })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Ex: SaaS, E-commerce, Consultoria"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Descrição do Negócio
            </label>
            <textarea
              value={context.description || ''}
              onChange={(e) => setContext({ ...context, description: e.target.value })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Descreva brevemente o que sua empresa faz"
              rows={3}
            />
          </div>

          {/* Industry */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Indústria
            </label>
            <input
              type="text"
              value={context.industry || ''}
              onChange={(e) => setContext({ ...context, industry: e.target.value })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Ex: Tecnologia, Retail, Manufatura"
            />
          </div>

          {/* Annual Revenue */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Receita Anual (R$)
            </label>
            <input
              type="number"
              value={context.annual_revenue || ''}
              onChange={(e) => setContext({ ...context, annual_revenue: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Ex: 1000000"
            />
          </div>

          {/* Team Size */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Tamanho do Time
            </label>
            <input
              type="number"
              value={context.team_size || ''}
              onChange={(e) => setContext({ ...context, team_size: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Ex: 10"
            />
          </div>

          {/* Founded Year */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Ano de Fundação
            </label>
            <input
              type="number"
              value={context.founded_year || ''}
              onChange={(e) => setContext({ ...context, founded_year: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Ex: 2020"
            />
          </div>

          {/* Main Goals */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Objetivos Principais
            </label>
            <textarea
              value={context.main_goals || ''}
              onChange={(e) => setContext({
                ...context,
                main_goals: e.target.value
              })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Descreva seus objetivos principais. Ex: Crescimento de 100%, expansão internacional, melhoria de margens de lucro, etc."
              rows={3}
            />
          </div>

          {/* Main Challenges */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Desafios Principais
            </label>
            <textarea
              value={context.main_challenges || ''}
              onChange={(e) => setContext({
                ...context,
                main_challenges: e.target.value
              })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Descreva seus principais desafios. Ex: Falta de capital, concorrência acirrada, dificuldade em reter talentos, etc."
              rows={3}
            />
          </div>

          {/* Target Market */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Mercado-alvo
            </label>
            <textarea
              value={context.target_market || ''}
              onChange={(e) => setContext({ ...context, target_market: e.target.value })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Ex: Empresas de 100-500 colaboradores no Brasil"
              rows={2}
            />
          </div>

          {/* Main Competitors */}
          <div>
            <label className="block text-sm md:text-base text-white font-semibold mb-2">
              Principais Competidores
            </label>
            <textarea
              value={context.main_competitors || ''}
              onChange={(e) => setContext({ ...context, main_competitors: e.target.value })}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg text-white outline-none transition focus:ring-2 focus:ring-[#e0521d]"
              style={{ backgroundColor: '#222423', borderColor: '#333333' }}
              placeholder="Ex: Empresa A, Empresa B, Empresa C"
              rows={2}
            />
          </div>

          {/* Status Messages */}
          <div className="pt-4 md:pt-6 border-t" style={{ borderColor: '#333333' }}>
            {saving && (
              <p className="text-xs md:text-sm text-gray-400 mb-2">💾 Salvando...</p>
            )}
            {completion >= 75 && !saving && (
              <p className="text-xs md:text-sm font-semibold" style={{ color: '#10b981' }}>
                ✓ Contexto suficientemente preenchido! Seus assistentes agora têm informações melhores.
              </p>
            )}
            {completion < 75 && (
              <p className="text-xs md:text-sm" style={{ color: '#e0521d' }}>
                ⚠️ Preencha mais campos para desbloquear todas as funcionalidades ({completion}% completo)
              </p>
            )}
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
