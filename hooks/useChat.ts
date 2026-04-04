'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Agent } from '@/types/agent'
import type { ChatMessage } from '@/types/chat'

export function useChat(conversationId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [agent, setAgent] = useState<Agent | null>(null)
  const [conversationTitle, setConversationTitle] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const subscriptionRef = useRef<any>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const streamingRef = useRef<Map<string, string>>(new Map())
  const isMountedRef = useRef(true)

  // Load conversation and agent on mount
  useEffect(() => {
    isMountedRef.current = true

    const loadConversation = async () => {
      try {
        // Limpar subscription anterior
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe()
          subscriptionRef.current = null
        }

        if (!isMountedRef.current) return

        setIsLoadingMessages(true)
        setError(null)

        // Get conversation first (needed for agent_id)
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single()

        if (convError) throw convError
        if (!conversation) {
          setError('Conversa não encontrada')
          setIsLoadingMessages(false)
          return
        }

        if (!isMountedRef.current) return

        // OPTIMIZATION: Load agent and messages in parallel (no dependencies between them)
        const loadAgentPromise = conversation.agent_id
          ? supabase
              .from('agents')
              .select('*')
              .eq('id', conversation.agent_id)
              .single()
          : Promise.resolve({ data: null, error: null })

        const loadMessagesPromise = supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        // Wait for both in parallel
        const [agentResult, messagesResult] = await Promise.all([
          loadAgentPromise,
          loadMessagesPromise,
        ])

        const { data: agentData, error: agentError } = agentResult
        const { data: messagesData, error: messagesError } = messagesResult

        if (agentError) {
          console.error('Error loading agent:', agentError)
          setError('Agente não encontrado')
          setIsLoadingMessages(false)
          return
        }

        if (messagesError) throw messagesError

        // Set agent if it exists
        if (agentData) {
          setAgent(agentData as Agent)
        }

        setConversationTitle(conversation.title)

        const loadedMessages = messagesData?.map((msg) => {
          const baseMessage: ChatMessage = {
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          }

          // Restore attached documents if they exist
          if (msg.document_ids && msg.document_ids.length > 0) {
            baseMessage.attachedDocuments = msg.document_ids.map((id: string) => {
              // Try to find document name from ID (format: id:filename)
              const parts = id.split(':')
              return {
                id: parts[0],
                name: parts.length > 1 ? parts.slice(1).join(':') : `Document ${id.substring(0, 8)}`
              }
            })
          }

          return baseMessage
        }) || []

        if (!isMountedRef.current) return

        setMessages(loadedMessages)
        messagesRef.current = loadedMessages
        setIsLoadingMessages(false)

        // Criar nova subscription com ID único
        const channelName = `conversation:${conversationId}:${Date.now()}`
        const channel = supabase
          .channel(channelName, {
            config: {
              broadcast: { self: true },
            },
          })
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'conversations',
              filter: `id=eq.${conversationId}`,
            },
            (payload: any) => {
              if (isMountedRef.current) {
                setConversationTitle(payload.new.title)
              }
            }
          )
          .subscribe()

        subscriptionRef.current = channel
      } catch (err) {
        if (isMountedRef.current) {
          console.error('Error loading conversation:', err)
          setError(err instanceof Error ? err.message : 'Erro ao carregar conversa')
          setIsLoadingMessages(false)
        }
      }
    }

    loadConversation()

    // Cleanup function
    return () => {
      isMountedRef.current = false
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
    }
  }, [conversationId])

  const sendMessage = useCallback(async (content: string, documentIds?: string[], documentNames?: string[], useWebSearch?: boolean) => {
    if (!agent || !agent.id) {
      setError('Agente não está carregado. Tente recarregar a página.')
      return
    }

    if (!content.trim()) return

    try {
      setLoading(true)
      setError(null)

      // Check if this is the first message BEFORE adding to state
      const isFirstMessage = messagesRef.current.length === 0
      console.log('Sending message:', { isFirstMessage, messageCount: messagesRef.current.length, documentIds })

      // Add user message to state and DB
      const userMessage: ChatMessage = {
        role: 'user',
        content,
        attachedDocuments: documentIds && documentIds.length > 0
          ? documentIds.map((id, idx) => ({ id, name: documentNames?.[idx] || `Document ${idx + 1}` }))
          : undefined
      }
      const updatedMessages = [...messagesRef.current, userMessage]
      setMessages(updatedMessages)
      messagesRef.current = updatedMessages

      // Save user message to DB (with document metadata if present)
      const messageData: any = {
        conversation_id: conversationId,
        role: 'user',
        content,
      }

      // Store document IDs with names encoded as "id:filename"
      if (documentIds && documentIds.length > 0) {
        messageData.document_ids = documentIds.map((id, idx) =>
          `${id}:${documentNames?.[idx] || `Document ${idx + 1}`}`
        )
      }

      const { error: insertError } = await supabase
        .from('messages')
        .insert([messageData])

      if (insertError) throw insertError

      // Create unique stream ID for this message
      const streamId = `${conversationId}-${Date.now()}`

      // Get session and access token
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token

      if (!accessToken) {
        throw new Error('Sessão expirada. Por favor, recarregue a página e faça login novamente.')
      }

      // Call chat API with streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          conversationId,
          agentId: agent.id,
          message: content,
          isFirstMessage,
          documentIds,
          useWebSearch: useWebSearch || false,
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Erro ao processar mensagem'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Se não conseguir fazer parse do JSON, usa mensagem genérica
        }
        throw new Error(errorMessage)
      }

      // Add assistant message placeholder
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
      }

      const messagesWithAssistant = [...messagesRef.current, assistantMessage]
      const assistantIndex = messagesWithAssistant.length - 1

      setMessages(messagesWithAssistant)
      messagesRef.current = messagesWithAssistant
      streamingRef.current.set(streamId, '')

      // Read streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('Erro ao iniciar streaming')

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)

          // Accumulate in ref
          const current = streamingRef.current.get(streamId) || ''
          const newContent = current + chunk
          streamingRef.current.set(streamId, newContent)

          // Update state with new content
          setMessages((prev) => {
            if (assistantIndex < prev.length) {
              const updated = [...prev]
              updated[assistantIndex] = {
                role: 'assistant',
                content: newContent,
              }
              return updated
            }
            return prev
          })
        }
      } finally {
        reader.releaseLock()

        // Final state update and cleanup
        const finalContent = streamingRef.current.get(streamId) || ''
        streamingRef.current.delete(streamId)

        setMessages((prev) => {
          if (assistantIndex < prev.length) {
            const updated = [...prev]
            updated[assistantIndex] = {
              role: 'assistant',
              content: finalContent,
            }
            messagesRef.current = updated
            return updated
          }
          return prev
        })

        // After message completes, emit event to refresh conversations list
        if (isFirstMessage) {
          console.log('🔄 [HOOK] First message complete, triggering sidebar refresh...')
          window.dispatchEvent(new CustomEvent('conversationTitleUpdated', { detail: { conversationId } }))
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error('Error sending message:', errorMsg)
      setError(errorMsg)
      // Remove last user message on error
      setMessages((prev) => {
        const updated = prev.slice(0, -1)
        messagesRef.current = updated
        return updated
      })
    } finally {
      setLoading(false)
    }
  }, [agent, conversationId])

  return { messages, agent, conversationTitle, loading, isLoadingMessages, error, sendMessage }
}
