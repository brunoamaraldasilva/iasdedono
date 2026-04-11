'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Agent } from '@/types/agent'
import type { ChatMessage } from '@/types/chat'

export function useChat(conversationId: string, onContentElementRef?: (ref: HTMLDivElement | null) => void) {
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
  const assistantIndexRef = useRef<number>(-1)
  const contentElementRef = useRef<HTMLDivElement | null>(null)


  // Load conversation and agent on mount
  useEffect(() => {
    isMountedRef.current = true
    console.log(`[PHASE 1] Hook mounted for conversation: ${conversationId}`)

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

        const loadedMessages = messagesData?.map((msg: any) => {
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

      // Keep loading state visible until first chunk arrives
      // Don't add empty assistant message yet - add it when first chunk arrives
      setLoading(true)
      streamingRef.current.set(streamId, '')

      assistantIndexRef.current = -1  // Will be set when first chunk arrives

      // Use Server-Sent Events for streaming
      const sseStartTime = Date.now()
      console.log(`🎯 [SSE] Iniciando SSE stream para /api/chat-stream`)

      return new Promise<void>((resolve, reject) => {
        const eventSource = new EventSource(
          `/api/chat-stream?${new URLSearchParams({
            conversationId,
            agentId: agent.id,
            message: content,
            isFirstMessage: String(isFirstMessage),
            documentIds: documentIds?.join(',') || '',
            token: accessToken,
          }).toString()}`
        )

        let chunkCount = 0
        let totalChars = 0
        let firstChunkReceived = false
        let renderUpdateCounter = 0
        const RENDER_UPDATE_INTERVAL = 10 // Update UI every 10 chunks

        eventSource.addEventListener('message', (event: MessageEvent) => {
          try {
            console.log(`[PHASE 3] EventSource message received:`, {
              dataLength: event.data.length,
              isComplete: event.data === 'data: [DONE]' || event.data === '[DONE]',
              preview: event.data.substring(0, 50)
            })

            if (event.data === 'data: [DONE]' || event.data === '[DONE]') {
              const totalTime = Date.now() - sseStartTime
              console.log(`✅ [SSE] Stream completo!`)
              console.log(`   Total chunks: ${chunkCount}`)
              console.log(`   Total chars: ${totalChars}`)
              console.log(`   Total time: ${totalTime}ms`)

              // Get final accumulated content
              const finalContent = streamingRef.current.get(streamId) || ''

              // Update messagesRef with final content for DB persistence
              if (assistantIndexRef.current >= 0 && assistantIndexRef.current < messagesRef.current.length) {
                messagesRef.current[assistantIndexRef.current].content = finalContent
                // Final update to React state
                const updatedMessages = [...messagesRef.current]
                setMessages(updatedMessages)
              }

              setLoading(false)
              eventSource.close()

              // After message completes, emit event to refresh conversations list
              if (isFirstMessage) {
                console.log('🔄 [HOOK] First message complete, triggering sidebar refresh...')
                window.dispatchEvent(new CustomEvent('conversationTitleUpdated', { detail: { conversationId } }))
              }

              resolve()
              return
            }

            const data = JSON.parse(event.data)
            if (data.content) {
              const chunk = data.content
              chunkCount++
              totalChars += chunk.length

              // CREATE BALLOON ON FIRST CHUNK (render once)
              if (!firstChunkReceived) {
                firstChunkReceived = true
                console.log(`📥 [SSE] First chunk received, creating assistant message balloon`)

                // Create the assistant message with first chunk
                const assistantMessage: ChatMessage = {
                  role: 'assistant',
                  content: chunk, // Start with first chunk immediately
                }
                const updated = [...messagesRef.current, assistantMessage]
                messagesRef.current = updated
                assistantIndexRef.current = updated.length - 1

                setLoading(false)
                setMessages(updated)

                // Store first chunk in ref
                streamingRef.current.set(streamId, chunk)
                renderUpdateCounter = 1
              } else {
                // Accumulate chunks in ref
                const current = streamingRef.current.get(streamId) || ''
                const newContent = current + chunk
                streamingRef.current.set(streamId, newContent)

                // Update React state periodically (every N chunks) to show streaming progress
                renderUpdateCounter++
                if (renderUpdateCounter % RENDER_UPDATE_INTERVAL === 0) {
                  const updated = [...messagesRef.current]
                  updated[assistantIndexRef.current].content = newContent
                  messagesRef.current = updated

                  // Use setTimeout to break out of event listener batching
                  setTimeout(() => {
                    setMessages([...updated])
                  }, 0)
                }
              }

              if (chunkCount <= 5 || chunkCount % 20 === 0) {
                console.log(`📦 [SSE] Chunk ${chunkCount}: ${chunk.length} chars`)
              }

              console.log(`[PHASE 3.6] Streaming update ${chunkCount}: ${streamingRef.current.get(streamId)?.length || 0} total chars`)
            }
          } catch (error) {
            console.error('[SSE] Error parsing message:', error)
          }
        })

        eventSource.addEventListener('error', (error: Event) => {
          console.error('[SSE] Stream error:', error)
          eventSource.close()
          reject(new Error('SSE stream error'))
        })
      }).catch((err) => {
        throw err
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error('Error sending message:', errorMsg)
      setError(errorMsg)
      setLoading(false)
      // Remove last user message on error
      setMessages((prev) => {
        const updated = prev.slice(0, -1)
        messagesRef.current = updated
        return updated
      })
    }
  }, [agent, conversationId])

  return { messages, agent, conversationTitle, loading, isLoadingMessages, error, sendMessage }
}
