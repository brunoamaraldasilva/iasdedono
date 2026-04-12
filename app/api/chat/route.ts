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
    let systemPrompt = agent.system_prompt || 'Você é um assistente útil.'
    if (userId) {
      const { data: context } = await supabase
        .from('business_context')
        .select('*')
        .eq('user_id', userId)
        .single()

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

    const { data: recentMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(7)

    const chatMessages = (recentMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))

    chatMessages.push({ role: 'user', content: message })

    const queryHash = generateQueryHash(message, conversationId, agentId)
    const cachedResponse = await getCachedResponse(queryHash)

    const encoder = new TextEncoder()
    let fullResponse = ''
    const streamStartTime = Date.now()

    const stream = new ReadableStream({
      async start(controller) {
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

          for await (const chunk of generateChatResponseRawStream(
            systemPrompt,
            chatMessages,
            onToolCall
          )) {
            if (!chunk) continue

            fullResponse += chunk
            liveChunkCount += 1

            sendSse({ content: chunk })
          }

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
