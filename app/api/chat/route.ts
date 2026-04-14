import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateChatResponseRawStream, generateConversationTitle } from '@/lib/openai'
import { searchGoogle, formatResultsForPrompt } from '@/lib/serpapi'
import { scrapeUrl } from '@/lib/webscraper'
import { rateLimit } from '@/lib/rateLimit'
import { generateQueryHash, getCachedResponse, cacheResponse } from '@/lib/chatCache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseServiceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not set')
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  })
}

type ChatRequestBody = {
  conversationId: string
  agentId: string
  message: string
  isFirstMessage?: boolean
  documentIds?: string[]
}

export async function POST(request: NextRequest) {
  const requestArrivalTime = Date.now()
  const t0 = new Date().toISOString()
  console.log(`[🔴 REQUEST-ARRIVAL] POST /api/chat arrived at ${t0}`)

  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = (await request.json()) as ChatRequestBody
    const {
      conversationId,
      agentId,
      message,
      isFirstMessage = false,
      documentIds = [],
    } = body

    if (!conversationId || !agentId || !message) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const rateLimitResult = rateLimit('chat', 10)
    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const userId = user?.id

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ⚡ CRITICAL FIX: Load context/messages BEFORE ReadableStream
    // Root cause: These queries inside ReadableStream.start() block HTTP response start (24+ sec delay!)
    // Solution: Execute now, then create ReadableStream immediately
    const preloadStart = Date.now()
    console.log(`[⏱️  PRELOAD-START] Beginning pre-load queries at T+${preloadStart - requestArrivalTime}ms`)

    let systemPrompt = agent.system_prompt || 'Você é um assistente útil.'

    const contextStart = Date.now()
    if (userId) {
      const { data: context } = await supabase
        .from('business_context')
        .select('*')
        .eq('user_id', userId)
        .single()
      console.log(`[⏱️  CONTEXT-QUERY] Completed in ${Date.now() - contextStart}ms`)

      if (context) {
        const contextParts: string[] = []
        if (context.business_name) contextParts.push(`Nome: ${context.business_name}`)
        if (context.business_type) contextParts.push(`Tipo: ${context.business_type}`)
        if (context.revenue) contextParts.push(`Faturamento: ${context.revenue}`)
        if (context.team_size) contextParts.push(`Tamanho do time: ${context.team_size}`)
        if (context.goals) contextParts.push(`Objetivos: ${context.goals}`)
        if (context.challenges) contextParts.push(`Desafios: ${context.challenges}`)
        if (context.additional_info) contextParts.push(`Outras informações: ${context.additional_info}`)

        if (contextParts.length > 0) {
          systemPrompt += `\n\n## Contexto do Negócio do Usuário:\n${contextParts.join('\n')}`
        }
      }
    }

    // Load agent materials
    const materialsStart = Date.now()
    const { data: materials } = await supabase
      .from('agent_materials')
      .select('title, content')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true })
    console.log(`[⏱️  MATERIALS-QUERY] Completed in ${Date.now() - materialsStart}ms`)

    if (materials && materials.length > 0) {
      const materialsText = materials
        .map((m: any) => `### ${m.title}\n${m.content}`)
        .join('\n\n')
      systemPrompt += `\n\n## Materiais do Agente:\n${materialsText}`
    }

    // Load documents attached to this message
    const documentsStart = Date.now()
    if (documentIds && documentIds.length > 0) {
      const { data: documents } = await supabase
        .from('documents')
        .select('id, filename, extracted_text')
        .in('id', documentIds)
        .order('created_at', { ascending: true })
      console.log(`[⏱️  DOCUMENTS-QUERY] Completed in ${Date.now() - documentsStart}ms`)

      if (documents && documents.length > 0) {
        const documentsText = documents
          .map((d: any) => `### Documento: ${d.filename}\n${d.extracted_text || '(conteúdo não processado)'}`)
          .join('\n\n')
        systemPrompt += `\n\n## Documentos do Usuário:\n${documentsText}`
      }
    } else {
      console.log(`[⏱️  DOCUMENTS-QUERY] Skipped - no documentIds provided`)
    }

    const messagesStart = Date.now()
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(7)
    console.log(`[⏱️  MESSAGES-QUERY] Completed in ${Date.now() - messagesStart}ms`)

    const chatMessages = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))

    chatMessages.push({ role: 'user', content: message })

    const queryHash = generateQueryHash(message, conversationId, agentId)
    const cacheStart = Date.now()
    const cachedResponse = await getCachedResponse(queryHash)
    console.log(`[⏱️  CACHE-CHECK] Completed in ${Date.now() - cacheStart}ms`)
    console.log(`[⏱️  PRELOAD-DONE] All pre-loading completed in ${Date.now() - preloadStart}ms`)

    const encoder = new TextEncoder()
    let fullResponse = ''
    const streamStartTime = Date.now()
    console.log(`[⏱️  STREAM-CREATE] Creating ReadableStream at T+${streamStartTime - requestArrivalTime}ms`)

    const stream = new ReadableStream({
      async start(controller) {
        const streamStartCallbackTime = Date.now()
        console.log(`[🎯 STREAM-START-CALLBACK] ReadableStream.start() invoked at T+${streamStartCallbackTime - requestArrivalTime}ms (${streamStartCallbackTime - streamStartTime}ms after creation)`)

        const sendSse = (payload: unknown, event?: string) => {
          const prefix = event ? `event: ${event}\n` : ''
          const data = `data: ${JSON.stringify(payload)}\n\n`
          controller.enqueue(encoder.encode(prefix + data))
        }

        try {

          if (cachedResponse) {
            const chunkSize = 20

            for (let i = 0; i < cachedResponse.length; i += chunkSize) {
              const chunk = cachedResponse.substring(i, i + chunkSize)
              sendSse({ content: chunk })
            }

            sendSse({ done: true }, 'done')
            controller.close()
            return
          }

          const onToolCall = async (
            toolName: string,
            toolInput: Record<string, unknown>
          ): Promise<string> => {
            if (toolName === 'web_search') {
              const query = toolInput.query as string
              const results = await searchGoogle(query)
              return formatResultsForPrompt(results)
            }

            if (toolName === 'web_scrape') {
              const url = toolInput.url as string
              const scrapedContent = await scrapeUrl(url)
              return scrapedContent.content
            }

            return `Unknown tool: ${toolName}`
          }

          let liveChunkCount = 0
          const generatorStart = Date.now()
          console.log(`[⏱️  GENERATOR-START] Calling generateChatResponseRawStream at T+${generatorStart - requestArrivalTime}ms`)

          let firstChunkTime = 0
          for await (const chunk of generateChatResponseRawStream(
            systemPrompt,
            chatMessages,
            onToolCall
          )) {
            if (!chunk) continue

            if (!firstChunkTime) {
              firstChunkTime = Date.now()
              console.log(`[🎯 FIRST-CHUNK-RECEIVED] First chunk received at T+${firstChunkTime - requestArrivalTime}ms (${firstChunkTime - generatorStart}ms after generator call)`)
            }

            fullResponse += chunk
            liveChunkCount += 1

            sendSse({ content: chunk })
          }

          console.log(`[🎯 STREAMING-COMPLETE] All chunks streamed at T+${Date.now() - requestArrivalTime}ms (${liveChunkCount} chunks total)`)

          sendSse({ done: true }, 'done')

          if (userId && fullResponse) {
            await supabase.from('messages').insert([
              {
                conversation_id: conversationId,
                role: 'assistant',
                content: fullResponse,
              },
            ])

            if (queryHash) {
              await cacheResponse(
                queryHash,
                message,
                fullResponse,
                conversationId,
                userId,
                24
              ).catch((err) => {
                console.error('Failed to cache response:', err)
              })
            }

            if (isFirstMessage) {
              setImmediate(async () => {
                try {
                  const title = await generateConversationTitle(agent.name, message)
                  const adminSupabase = createAdminSupabaseClient()
                  if (!adminSupabase) return

                  const { error } = await adminSupabase
                    .from('conversations')
                    .update({ title })
                    .eq('id', conversationId)

                  if (error) {
                    console.error('Failed to update title:', error)
                  }
                } catch (err) {
                  console.error('Error generating title:', err)
                }
              })
            }
          }

          console.log(
            `[CHAT-STREAM] complete: ${fullResponse.length} chars in ${Date.now() - streamStartTime}ms`
          )

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          sendSse({ error: 'Streaming error occurred' }, 'error')
          controller.close()
        }
      },
    })

    const responseReturnTime = Date.now()
    console.log(`[✅ RESPONSE-RETURN] Returning Response object at T+${responseReturnTime - requestArrivalTime}ms (${responseReturnTime - streamStartTime}ms after stream creation)`)

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('Chat Stream API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
