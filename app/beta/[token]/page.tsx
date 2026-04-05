'use client'

import { use, useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
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
  const [conversationId] = useState(() => uuidv4()) // Generate temp conversation ID

  useEffect(() => {
    loadBetaAgent()
  }, [token])

  const loadBetaAgent = async () => {
    try {
      setLoading(true)

      // Fetch agent via API endpoint (bypasses RLS)
      const response = await fetch(`/api/beta/${token}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Beta link inválido ou expirado')
      }

      const data = await response.json()
      setAgent(data.agent as Agent)
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
          conversationId,
          agentId: agent.id,
          message: content,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao processar')
      }

      // Read streaming response
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let assistantMsg = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantMsg += decoder.decode(value, { stream: true })
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMsg,
        },
      ])
    } catch (err) {
      console.error('Chat error:', err)
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
      // Remove user message on error
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsSending(false)
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#161616' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e0521d] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando agent...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#161616' }}>
        <div className="text-center max-w-sm">
          <p className="text-red-400 font-semibold mb-2">{error}</p>
          <p className="text-gray-400 text-sm">
            Este link beta pode estar inválido ou expirado.
          </p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#161616' }}>
        <p className="text-gray-400">Agent não encontrado</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex" style={{ backgroundColor: '#161616' }}>
      {/* Sidebar Info */}
      <div className="w-80 border-r p-6 overflow-y-auto" style={{ backgroundColor: '#e0521d' }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            {agent.name}
          </h1>
          <p className="text-white text-sm mb-4 opacity-90">{agent.description}</p>

          <div className="inline-block px-3 py-1 text-xs font-semibold rounded-full text-white" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            Teste Beta
          </div>
        </div>

        <div className="border-t border-white border-opacity-20 pt-6">
          <h2 className="font-semibold text-white mb-3 text-sm">
            Sobre este Agent
          </h2>
          <p className="text-sm text-white opacity-90 mb-4">
            {agent.system_prompt.substring(0, 150)}...
          </p>

          <div className="rounded-lg p-4 text-sm text-white" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <p className="font-semibold mb-2">Teste Privado</p>
            <p>
              Este é um teste beta. As mensagens <strong>não são salvas</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col p-4">
        <div className="flex-1 flex flex-col rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: '#222423' }}>
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
