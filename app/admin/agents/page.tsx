'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Trash2, Edit2, Eye, EyeOff, Plus } from 'lucide-react'
import type { Agent } from '@/types/agent'

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setLoading(true)

      const { data, error: err } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      setAgents(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading agents')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (agentId: string) => {
    if (!confirm('Tem certeza que deseja deletar este agent?')) return

    try {
      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      const response = await fetch('/api/admin/agents/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ agentId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar agent')
      }

      setAgents((prev) => prev.filter((a) => a.id !== agentId))
      toast.success('Agent deletado com sucesso')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao deletar agent'
      )
    }
  }

  const handleTogglePublish = async (agent: Agent) => {
    try {
      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      const response = await fetch('/api/admin/agents/publish', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ agentId: agent.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar agent')
      }

      const data = await response.json()

      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id ? { ...a, is_published: data.is_published } : a
        )
      )

      toast.success(
        data.is_published
          ? 'Agent publicado com sucesso'
          : 'Agent despublicado'
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao atualizar agent'
      )
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando agents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Agentes</h1>
            <p className="text-gray-400">Gerenciar personas e agentes customizados</p>
          </div>
          <Link
            href="/admin/agents/create"
            className="font-semibold px-6 py-3 rounded-lg transition text-white flex items-center gap-2"
            style={{ backgroundColor: '#e0521d' }}
          >
            <Plus size={18} />
            Novo Agent
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#8B2e2e', borderColor: '#c53030' }}>
            <p className="text-[#ff6b6b]">{error}</p>
          </div>
        )}

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 mb-4">Nenhum agent encontrado</p>
            </div>
          ) : (
            agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-lg p-6 hover:border-[#e0521d] transition"
                style={{ backgroundColor: '#222423', border: '1px solid #333333' }}
              >
                {/* Header */}
                <div className="mb-4">
                  <h3 className="font-bold text-white text-lg mb-1">{agent.name}</h3>
                  <p className="text-xs text-gray-500">{agent.description}</p>
                </div>

                {/* Status Badges */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {agent.is_published && (
                    <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                      Publicado
                    </span>
                  )}
                  {agent.is_beta && (
                    <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
                      Beta
                    </span>
                  )}
                  {!agent.is_published && !agent.is_beta && (
                    <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full" style={{ backgroundColor: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}>
                      Draft
                    </span>
                  )}
                </div>

                {/* Prompt Preview */}
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                  {agent.system_prompt.substring(0, 100)}...
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t" style={{ borderColor: '#333333' }}>
                  <Link
                    href={`/admin/agents/${agent.id}`}
                    className="flex-1 px-3 py-2 text-sm font-semibold rounded transition text-center text-white hover:brightness-110 flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#333333' }}
                  >
                    <Edit2 size={16} />
                    Editar
                  </Link>
                  <button
                    onClick={() => handleTogglePublish(agent)}
                    className="flex-1 px-3 py-2 text-sm font-semibold rounded transition text-white hover:brightness-110 flex items-center justify-center gap-2"
                    style={{ backgroundColor: agent.is_published ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' }}
                  >
                    {agent.is_published ? (
                      <>
                        <EyeOff size={16} />
                        Despub
                      </>
                    ) : (
                      <>
                        <Eye size={16} />
                        Publicar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="px-3 py-2 text-sm font-semibold rounded transition hover:brightness-110 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
