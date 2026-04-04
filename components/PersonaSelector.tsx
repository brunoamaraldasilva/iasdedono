'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Agent } from '@/types/agent'

interface PersonaSelectorProps {
  onSelectAgent: (agent: Agent) => void
  selectedAgentId?: string
}

export function PersonaSelector({
  onSelectAgent,
  selectedAgentId,
}: PersonaSelectorProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const { data, error: err } = await supabase
          .from('agents')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: true })

        if (err) throw err
        setAgents(data || [])

        // Select first agent by default
        if (data && data.length > 0 && !selectedAgentId) {
          onSelectAgent(data[0])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading agents')
      } finally {
        setLoading(false)
      }
    }

    loadAgents()
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm p-4 bg-red-50 rounded-lg">
        {error}
      </div>
    )
  }

  return (
    <div className="w-full">
      <h3 className="text-sm md:text-base font-semibold px-3 md:px-2 mb-3 md:mb-4" style={{ color: '#999999' }}>
        PERSONAS
      </h3>

      {/* Grid responsivo: 2 colunas mobile, 3 desktop */}
      <div className="grid gap-3 md:gap-4 px-3 md:px-0 grid-cols-2 md:grid-cols-1 auto-rows-max">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className="
              p-3 md:p-4 rounded-lg transition-all text-center text-left
              border border-[#333333]
              active:scale-95 md:hover:scale-105
            "
            style={{
              backgroundColor: selectedAgentId === agent.id ? '#e0521d' : '#222423',
              color: selectedAgentId === agent.id ? 'white' : '#cccccc',
              borderColor: selectedAgentId === agent.id ? '#e0521d' : '#333333',
            }}
          >
            <div className="text-xl md:text-2xl mb-2">{agent.icon || '🤖'}</div>
            <p className="font-semibold text-sm md:text-base line-clamp-2">
              {agent.name}
            </p>
            {agent.description && (
              <p className="text-xs md:text-xs opacity-70 mt-1 line-clamp-2">
                {agent.description}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
