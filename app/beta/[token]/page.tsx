'use client'

import { use, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChatWindow } from '@/components/ChatWindow'
import { MessageInput } from '@/components/MessageInput'
import type { Agent } from '@/types/agent'
import type { ChatMessage } from '@/types/chat'

interface BetaPageProps {
  params: Promise<{
    token: string
  }>
}

export default function BetaPage({ params }: BetaPageProps) {
  const { token } = use(params)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    loadBetaAgent()
  }, [token])

  const loadBetaAgent = async () => {
    try {
      setLoading(true)

      // Find agent by beta token
      const { data: betaLink, error: betaError } = await supabase
        .from('agent_beta_links')
        .select('*, agents(*)')
        .eq('beta_token', token)
        .single()

      if (betaError || !betaLink) {
        throw new Error('Beta link inválido ou expirado')
      }

      // Check expiration
      if (betaLink.expires_at && new Date(betaLink.expires_at) < new Date()) {
        throw new Error('Beta link expirado')
      }

      setAgent(betaLink.agents as Agent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar agent')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!agent) return

    setIsSending(true)
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content,
      },
    ])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: null, // Beta doesn't save to DB
          agentId: agent.id,
          message: content,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao processar')
      }

      const { message: assistantMsg } = await response.json()

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMsg,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
      // Remove user message on error
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsSending(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando agent...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <p className="text-2xl mb-2">⚠️</p>
          <p className="text-red-600 font-semibold mb-2">{error}</p>
          <p className="text-gray-600 text-sm">
            Este link beta pode estar inválido ou expirado.
          </p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Agent não encontrado</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar Info */}
      <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
        <div className="mb-6">
          <span className="text-5xl block mb-4">{agent.icon || '🤖'}</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {agent.name}
          </h1>
          <p className="text-gray-600 text-sm mb-4">{agent.description}</p>

          <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
            🧪 Versão Beta
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="font-semibold text-gray-900 mb-3 text-sm">
            ℹ️ Sobre este Agent
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {agent.system_prompt.substring(0, 150)}...
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-semibold mb-2">💡 Teste Privado</p>
            <p>
              Este é um teste beta. As mensagens <strong>não são salvas</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col bg-gray-50 p-4">
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
          <ChatWindow
            messages={messages}
            loading={isSending}
            agentName={agent.name}
          />

          <MessageInput
            onSendMessage={handleSendMessage}
            disabled={false}
            loading={isSending}
          />
        </div>
      </div>
    </div>
  )
}
