# FASE 1: Plano de Ação Executável - Validação de Contexto

**Status:** 🟢 Pronto para começar
**Complexidade:** ⭐ Baixa
**Tempo Estimado:** 1-2 dias
**Prioridade:** 🔴 CRÍTICO (bloqueador)

---

## ✅ Checklist de Execução

### **Passo 1: Expandir Schema no Supabase** ✅ COMPLETO

✅ Você já rodou `SQL_PHASE1_EXPAND_BUSINESS_CONTEXT.sql`
✅ Tabela `business_context` foi expandida com todos os campos necessários
✅ Triggers foram criados para calcular `completion_percentage` automaticamente
✅ Índices foram criados para performance

---

### **Passo 2: Atualizar Hook useContext (Novo)** (20 min)

**Arquivo:** `hooks/useContext.ts` (NOVO)

```typescript
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
  main_goals: string[] | null
  main_challenges: string[] | null
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
          const { data: newContext } = await supabase
            .from('business_context')
            .insert({
              user_id: user!.id,
            })
            .select()
            .single()

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
```

---

### **Passo 3: Criar Modal Component** (30 min)

**Arquivo:** `components/ContextRequiredModal.tsx` (NOVO)

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

interface ContextRequiredModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContextRequiredModal({ isOpen, onClose }: ContextRequiredModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        style={{ backgroundColor: '#222423' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle size={24} style={{ color: '#e0521d' }} />
          <h2 className="text-xl font-bold text-white">
            Contexto do Negócio Necessário
          </h2>
        </div>

        {/* Message */}
        <p className="text-gray-300 mb-6">
          Para que os assistentes IAs gerem respostas mais precisas e relevantes ao seu negócio,
          é importante que você preencha o contexto do seu negócio.
        </p>

        {/* Benefits List */}
        <div className="mb-6 space-y-2">
          <p className="text-sm text-gray-400 font-semibold">Benefícios:</p>
          <ul className="text-sm text-gray-300 space-y-1 ml-4">
            <li>✓ Respostas personalizadas para sua realidade</li>
            <li>✓ Análises mais precisas do seu negócio</li>
            <li>✓ Recomendações alinhadas com seus objetivos</li>
          </ul>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-gray-300 hover:text-white transition"
            style={{ border: '1px solid #444' }}
          >
            Fechar
          </button>
          <button
            onClick={() => router.push('/dashboard/context')}
            className="flex-1 px-4 py-2 rounded-lg text-white font-semibold transition hover:opacity-90"
            style={{ backgroundColor: '#e0521d' }}
          >
            Ir para Configuração
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### **Passo 3: Atualizar Dashboard Layout** (20 min)

**Arquivo:** `app/dashboard/layout.tsx`

Modificar onde checa autenticação:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/Sidebar'
import { ContextRequiredModal } from '@/components/ContextRequiredModal'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [contextNotFilled, setContextNotFilled] = useState(false)
  const [showContextModal, setShowContextModal] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  // Verificar se usuário tem contexto preenchido
  useEffect(() => {
    if (!user) return

    const checkContext = async () => {
      const { data } = await supabase
        .from('contexts')
        .select('id, completion_percentage')
        .eq('user_id', user.id)
        .single()

      const hasContext = data && data.completion_percentage >= 75
      setContextNotFilled(!hasContext)

      // Mostrar modal automaticamente se não tem contexto
      if (!hasContext) {
        setShowContextModal(true)
      }
    }

    checkContext()
  }, [user])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#161616' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="h-screen flex" style={{ backgroundColor: '#161616' }}>
      <Sidebar user={user} conversations={[]} />
      <main className="flex-1 overflow-hidden" style={{ backgroundColor: '#161616' }}>
        {children}
      </main>

      <ContextRequiredModal
        isOpen={showContextModal}
        onClose={() => setShowContextModal(false)}
      />
    </div>
  )
}
```

---

### **Passo 4: Melhorar Página de Contexto** (1 hora)

**Arquivo:** `app/dashboard/context/page.tsx`

Adicionar:
- ✅ Campos faltantes (goals, challenges, target_market, competitors)
- ✅ Indicador de progresso visual
- ✅ Auto-save conforme digita
- ✅ Feedback visual (cor verde para completo)

**Exemplo de estrutura:**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface ContextData {
  business_name: string
  business_type: string
  annual_revenue: number | null
  team_size: number | null
  main_goals: string[]
  main_challenges: string[]
  target_market: string
  additional_info: Record<string, any>
}

export default function ContextPage() {
  const { user } = useAuth()
  const [context, setContext] = useState<ContextData | null>(null)
  const [completion, setCompletion] = useState(0)
  const [saving, setSaving] = useState(false)

  // Carregar contexto ao montar
  useEffect(() => {
    if (!user) return
    loadContext()
  }, [user])

  // Auto-save com debounce
  useEffect(() => {
    if (!context || !user) return

    const timer = setTimeout(async () => {
      setSaving(true)
      await supabase
        .from('contexts')
        .upsert({
          user_id: user.id,
          ...context
        })
      setSaving(false)
    }, 1000) // Salvar 1 segundo depois de parar de digitar

    return () => clearTimeout(timer)
  }, [context, user])

  async function loadContext() {
    const { data } = await supabase
      .from('contexts')
      .select('*')
      .eq('user_id', user!.id)
      .single()

    if (data) {
      setContext(data)
      setCompletion(data.completion_percentage || 0)
    }
  }

  if (!context) return <div>Carregando...</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Contexto do Negócio</h1>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-gray-300">Preenchimento do Contexto</span>
          <span style={{ color: '#e0521d' }}>{completion}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              backgroundColor: completion >= 75 ? '#10b981' : '#e0521d',
              width: `${completion}%`
            }}
          />
        </div>
      </div>

      {/* Form Fields */}
      <form className="space-y-6">
        {/* Business Name */}
        <div>
          <label className="block text-white font-semibold mb-2">
            Nome da Empresa *
          </label>
          <input
            type="text"
            value={context.business_name || ''}
            onChange={(e) => setContext({ ...context, business_name: e.target.value })}
            className="w-full px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: '#333333' }}
            placeholder="Ex: Tech Solutions Brasil"
          />
        </div>

        {/* Tipo de Negócio */}
        <div>
          <label className="block text-white font-semibold mb-2">
            Tipo de Negócio
          </label>
          <input
            type="text"
            value={context.business_type || ''}
            onChange={(e) => setContext({ ...context, business_type: e.target.value })}
            className="w-full px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: '#333333' }}
            placeholder="Ex: SaaS, E-commerce, Consultoria"
          />
        </div>

        {/* Goals (Array) */}
        <div>
          <label className="block text-white font-semibold mb-2">
            Objetivos Principais (separados por vírgula)
          </label>
          <textarea
            value={(context.main_goals || []).join(', ')}
            onChange={(e) => setContext({
              ...context,
              main_goals: e.target.value.split(',').map(g => g.trim())
            })}
            className="w-full px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: '#333333' }}
            placeholder="Ex: Crescimento 100%, Expansão internacional"
            rows={3}
          />
        </div>

        {/* Challenges (Array) */}
        <div>
          <label className="block text-white font-semibold mb-2">
            Desafios Principais (separados por vírgula)
          </label>
          <textarea
            value={(context.main_challenges || []).join(', ')}
            onChange={(e) => setContext({
              ...context,
              main_challenges: e.target.value.split(',').map(c => c.trim())
            })}
            className="w-full px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: '#333333' }}
            placeholder="Ex: Falta de capital, Concorrência acirrada"
            rows={3}
          />
        </div>

        {/* Status */}
        {saving && (
          <p className="text-sm text-gray-400">Salvando...</p>
        )}
        {completion >= 75 && (
          <p className="text-sm" style={{ color: '#10b981' }}>
            ✓ Contexto suficientemente preenchido!
          </p>
        )}
      </form>
    </div>
  )
}
```

---

## 🎯 Resumo do que será feito

| Tarefa | Arquivo | Tempo |
|--------|---------|-------|
| Schema SQL | `SQL_PHASE1_CONTEXTS.sql` | 15 min |
| Modal Component | `components/ContextRequiredModal.tsx` | 30 min |
| Dashboard Update | `app/dashboard/layout.tsx` | 20 min |
| Context Page | `app/dashboard/context/page.tsx` | 1 hora |
| **TOTAL** | | **2 horas** |

---

## 🚀 Próximos Passos Após FASE 1

1. ✅ Testar fluxo completo: signup → login → modal → preencher contexto
2. ⏳ Começar FASE 2A (Definir tipos de arquivo suportados)
3. ⏳ Começar FASE 2B (Backend upload)

---

## ⚠️ Notas Importantes

- Modal reaparece ao recarregar se contexto não está 75%+ preenchido
- Auto-save evita perda de dados
- Completion percentage é calculado automaticamente pelo trigger SQL
- Usuário pode navegar normalmente enquanto contexto não está completo (só aparece modal)

---

**Status:** 🟢 Pronto para iniciar
**Executável:** Sim
**Bloqueadores:** Nenhum
