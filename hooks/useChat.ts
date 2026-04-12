'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Agent } from '@/types/agent'
import type { ChatMessage } from '@/types/chat'

type SsePayload = {
  content?: string
  error?: string
  done?: boolean
}

export function useChat(conversationId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [agent, setAgent] = useState<Agent | null>(null)
  const [conversationTitle, setConversationTitle] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const subscriptionRef = useRef<any>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    isMountedRef.current = true

    const loadConversation = async () => {
      try {
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe()
          subscriptionRef.current = null
        }

        setIsLoadingMessages(true)
        setError(null)

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

        const loadAgentPromise = conversation.agent_id
          ? supabase.from('agents').select('*').eq('id', conversation.agent_id).single()
          : Promise.resolve({ data: null, error: null })

        const loadMessagesPromise = supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

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

        if (agentData) {
          setAgent(agentData as Agent)
        }

        setConversationTitle(conversation.title)

        const loadedMessages =
          messagesData?.map((msg: any) => {
            const baseMessage: ChatMessage = {
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            }

            if (msg.document_ids && msg.document_ids.length > 0) {
              baseMessage.attachedDocuments = msg.document_ids.map((id: string) => {
                const parts = id.split(':')
                return {
                  id: parts[0],
                  name:
                    parts.length > 1
                      ? parts.slice(1).join(':')
                      : `Document ${id.substring(0, 8)}`,
                }
              })
            }

            return baseMessage
          }) || []

        if (!isMountedRef.current) return

        setMessages(loadedMessages)
        messagesRef.current = loadedMessages
        setIsLoadingMessages(false)

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

    return () => {
      isMountedRef.current = false

      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [conversationId])

  const sendMessage = useCallback(
    async (
      content: string,
      documentIds?: string[],
      documentNames?: string[],
      useWebSearch?: boolean
    ) => {
      if (!agent || !agent.id) {
        setError('Agente não está carregado. Tente recarregar a página.')
        return
      }

      if (!content.trim()) return

      try {
        setLoading(true)
        setError(null)

        const isFirstMessage = messagesRef.current.length === 0

        const userMessage: ChatMessage = {
          role: 'user',
          content,
          attachedDocuments:
            documentIds && documentIds.length > 0
              ? documentIds.map((id, idx) => ({
                  id,
                  name: documentNames?.[idx] || `Document ${idx + 1}`,
                }))
              : undefined,
        }

        const updatedMessages = [...messagesRef.current, userMessage]
        setMessages(updatedMessages)
        messagesRef.current = updatedMessages

        const messageData: any = {
          conversation_id: conversationId,
          role: 'user',
          content,
        }

        if (documentIds && documentIds.length > 0) {
          messageData.document_ids = documentIds.map(
            (id, idx) => `${id}:${documentNames?.[idx] || `Document ${idx + 1}`}`
          )
        }

        const { error: insertError } = await supabase.from('messages').insert([messageData])

        if (insertError) throw insertError

        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token

        if (!accessToken) {
          throw new Error('Sessão expirada. Por favor, recarregue a página e faça login novamente.')
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: '',
        }

        const messagesWithAssistant = [...messagesRef.current, assistantMessage]
        const assistantIndex = messagesWithAssistant.length - 1

        setMessages(messagesWithAssistant)
        messagesRef.current = messagesWithAssistant

        const abortController = new AbortController()
        abortControllerRef.current = abortController

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            conversationId,
            agentId: agent.id,
            message: content,
            isFirstMessage,
            documentIds,
            useWebSearch,
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          let errorMessage = 'Erro ao processar mensagem'
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            // noop
          }
          throw new Error(errorMessage)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('Erro ao iniciar streaming')
        }

        const decoder = new TextDecoder()
        let sseBuffer = ''
        let assistantContent = ''
        let chunkCount = 0
        const streamStartTime = Date.now()

        const applyAssistantContent = (nextContent: string) => {
          setMessages((prev) => {
            if (assistantIndex >= prev.length) return prev

            const updated = [...prev]
            updated[assistantIndex] = {
              role: 'assistant',
              content: nextContent,
            }
            messagesRef.current = updated
            return updated
          })
        }

        while (true) {
          const readStartTime = performance.now()
          const { done, value } = await reader.read()
          const readEndTime = performance.now()

          if (done) {
            console.log(`[STREAM END] Total time: ${Date.now() - streamStartTime}ms, Total chunks parsed: ${chunkCount}`)
            break
          }

          const decodedText = decoder.decode(value, { stream: true })
          console.log(`[STREAM READ] #${chunkCount} raw bytes: ${value.byteLength}, decoded: ${decodedText.length} chars, read took ${(readEndTime - readStartTime).toFixed(2)}ms`)

          sseBuffer += decodedText

          const events = sseBuffer.split('\n\n')
          sseBuffer = events.pop() || ''

          console.log(`[STREAM PARSE] Found ${events.length} complete SSE events in this read cycle`)

          for (const rawEvent of events) {
            const lines = rawEvent.split('\n')
            let eventName = 'message'
            const dataLines: string[] = []

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim()
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim())
              }
            }

            if (dataLines.length === 0) continue

            const dataText = dataLines.join('\n')
            let payload: SsePayload

            try {
              payload = JSON.parse(dataText)
            } catch {
              console.warn('[STREAM PARSE ERROR] Failed to parse JSON:', dataText.substring(0, 100))
              continue
            }

            if (eventName === 'error' || payload.error) {
              throw new Error(payload.error || 'Erro no streaming')
            }

            if (eventName === 'done' || payload.done) {
              console.log('[STREAM DONE EVENT] Received done marker')
              continue
            }

            if (payload.content) {
              chunkCount++
              assistantContent += payload.content
              const elapsed = Date.now() - streamStartTime
              console.log(`[STREAM CHUNK ${chunkCount}] +${payload.content.length} chars (total: ${assistantContent.length}) @ ${elapsed}ms`)
              applyAssistantContent(assistantContent)
            }
          }
        }

        if (sseBuffer.trim()) {
          const lines = sseBuffer.split('\n')
          const dataLines = lines
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())

          if (dataLines.length > 0) {
            try {
              const payload = JSON.parse(dataLines.join('\n')) as SsePayload
              if (payload.content) {
                assistantContent += payload.content
                applyAssistantContent(assistantContent)
              }
            } catch {
              // noop
            }
          }
        }

        if (isFirstMessage) {
          window.dispatchEvent(
            new CustomEvent('conversationTitleUpdated', {
              detail: { conversationId },
            })
          )
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
        console.error('Error sending message:', errorMsg)
        setError(errorMsg)

        setMessages((prev) => {
          const updated = prev.slice(0, -1)
          messagesRef.current = updated
          return updated
        })
      } finally {
        abortControllerRef.current = null
        setLoading(false)
      }
    },
    [agent, conversationId]
  )

  return {
    messages,
    agent,
    conversationTitle,
    loading,
    isLoadingMessages,
    error,
    sendMessage,
  }
}
