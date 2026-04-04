'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { MessageCircle } from 'lucide-react'

interface Agent {
  id: string
  name: string
  description?: string
  icon?: string
}

export default function HomePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)

  // Load ALL published agents from database on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoadingAgents(true)
        const { data } = await supabase
          .from('agents')
          .select('id, name, description, icon')
          .eq('is_published', true)
          .order('created_at', { ascending: false })

        console.log('📊 [DASHBOARD] Loaded agents:', data?.length || 0)
        setAgents(data || [])
      } catch (err) {
        console.error('Error loading agents:', err)
      } finally {
        setLoadingAgents(false)
      }
    }

    loadAgents()
  }, [])

  const handleStartChat = async () => {
    if (!selectedAgent || !user) return

    try {
      setLoading(true)

      // Create new conversation with selected agent
      const { data, error: err } = await supabase
        .from('conversations')
        .insert([
          {
            user_id: user.id,
            agent_id: selectedAgent.id,
            title: `Chat com ${selectedAgent.name}`,
          },
        ])
        .select()
        .single()

      if (err) throw err

      console.log('✅ [DASHBOARD] Created conversation:', data.id)

      // Redirect to chat
      router.push(`/dashboard/chat/${data.id}`)
    } catch (err) {
      console.error('Error starting chat:', err instanceof Error ? err.message : 'Unknown error')
      alert('Erro ao criar conversa. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (loadingAgents) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: '#161616' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e0521d] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando agentes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col pt-8 px-8" style={{ backgroundColor: '#161616' }}>
      {/* Agents Grid - Top */}
      <div className="w-full max-w-6xl mx-auto mb-12">
        {agents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Nenhum agent disponível no momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const isSelected = selectedAgent?.id === agent.id
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="p-4 rounded-lg transition text-white hover:brightness-110"
                  style={{
                    backgroundColor: isSelected ? '#e0521d' : '#222423',
                  }}
                >
                  {agent.icon && <div className="text-2xl mb-2">{agent.icon}</div>}
                  <div className="font-bold text-lg mb-1 text-left">{agent.name}</div>
                  {agent.description && (
                    <div className="text-xs leading-tight text-gray-300 text-left">{agent.description}</div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Center - Selected Agent Circle */}
      {selectedAgent && (
        <div className="flex flex-col items-center justify-center flex-1 mb-12">
          {/* Circle with icon */}
          <div className="w-40 h-40 rounded-full bg-primary flex items-center justify-center mb-6">
            <div className="text-white text-5xl font-bold">
              {selectedAgent.name.split(' ')[0][0]}
            </div>
          </div>

          {/* Agent name and description */}
          <h2 className="text-2xl font-bold text-white mb-2">{selectedAgent.name}</h2>
          <p className="text-gray-400 text-center max-w-md text-sm mb-8">
            {selectedAgent.description}
          </p>

          {/* Start Chat Button */}
          <button
            onClick={handleStartChat}
            disabled={loading}
            className="px-8 py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Criando conversa...' : 'Começar Conversa'}
          </button>
        </div>
      )}

      {/* Message when no agent selected */}
      {!selectedAgent && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500 text-sm flex items-center gap-2">
            <MessageCircle size={16} />
            Selecione uma IAs de Dono para começar
          </div>
        </div>
      )}
    </div>
  )
}
