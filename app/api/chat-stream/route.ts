import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateChatResponseRawStream, generateConversationTitle } from '@/lib/openai'
import { searchGoogle, formatResultsForPrompt } from '@/lib/serpapi'
import { scrapeUrl, isValidUrl, extractUrls } from '@/lib/webscraper'
import { rateLimit } from '@/lib/rateLimit'
import { generateQueryHash, getCachedResponse, cacheResponse } from '@/lib/chatCache'

// CRITICAL: Declare route as dynamic to prevent caching/prerendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Server-side admin client for updating conversations
function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set - cannot create admin client')
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  })
}

export async function GET(request: NextRequest) {
  const requestStartTime = Date.now()
  try {
    // Extract query parameters (Route Handlers use synchronous nextUrl.searchParams)
    const searchParams = request.nextUrl.searchParams
    const conversationId = searchParams.get('conversationId')
    const agentId = searchParams.get('agentId')
    const message = searchParams.get('message')
    const isFirstMessage = searchParams.get('isFirstMessage') === 'true'
    const documentIds = searchParams.get('documentIds')?.split(',').filter(Boolean) || []
    const token = searchParams.get('token')

    // Validate required parameters
    if (!conversationId || !agentId || !message || !token) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 })
    }

    console.log(`⏱️  [CHAT-STREAM] 📍 Request started (T+0ms)`)

    // Rate limiting
    const rateLimitStart = Date.now()
    const rateLimitResult = rateLimit('chat', 10)
    if (!rateLimitResult.success) {
      return new Response('Rate limited', { status: 429 })
    }
    console.log(`⏱️  [CHAT-STREAM] Rate limit check: ${Date.now() - rateLimitStart}ms`)

    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    // Get user ID
    const authStart = Date.now()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id
    console.log(`⏱️  [CHAT-STREAM] Auth getUser: ${Date.now() - authStart}ms`)

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 401 })
    }

    // Get agent
    const agentStart = Date.now()
    const { data: agent } = await supabase.from('agents').select('*').eq('id', agentId).single()
    console.log(`⏱️  [CHAT-STREAM] Load agent: ${Date.now() - agentStart}ms`)

    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found or error loading agent' }), { status: 404 })
    }

    const totalSetupTime = Date.now() - requestStartTime
    console.log(`🎯 [CHAT-STREAM] Starting SSE stream for message: "${message.substring(0, 50)}" (setup took ${totalSetupTime}ms)`)

    // ⚡ CRITICAL FIX: Load context/messages BEFORE ReadableStream
    // Root cause: These queries inside ReadableStream.start() block HTTP response start (40+ sec TTFB!)
    // Solution: Execute now, then create ReadableStream immediately
    console.log(`📍 [CHAT-STREAM] Pre-loading context & messages (moving out of ReadableStream start)...`)
    const preloadStart = Date.now()

    // Load business context
    let systemPrompt = agent.system_prompt || 'Você é um assistente útil.'
    if (userId) {
      const { data: context } = await supabase
        .from('business_context')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (context) {
        // Build context from all fields
        const contextParts = []
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

    // Get recent messages for context
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

    // Add current message
    chatMessages.push({ role: 'user', content: message })

    // Check cache BEFORE creating ReadableStream
    const queryHash = generateQueryHash(message, conversationId, agentId)
    const cachedResponse = await getCachedResponse(queryHash)

    console.log(`⏱️  [CHAT-STREAM] Pre-load complete in ${Date.now() - preloadStart}ms`)

    // Fast path: cached response (no streaming overhead)
    if (cachedResponse) {
      console.log(`⚡ [CHAT-STREAM] Cache HIT - returning cached response`)
      const encoder = new TextEncoder()

      const cachedReadable = new ReadableStream({
        start(controller) {
          try {
            const chunkSize = 20
            for (let i = 0; i < cachedResponse.length; i += chunkSize) {
              const chunk = cachedResponse.substring(i, i + chunkSize)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            console.error('[CHAT-STREAM] Cached error:', error)
            controller.close()
          }
        },
      })

      return new Response(cachedReadable, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    // Slow path: stream new response
    const encoder = new TextEncoder()
    let fullResponse = ''
    let firstChunkSent = false
    const streamStartTime = Date.now()

    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          // Pre-loading already done above, now just handle streaming

          if (cachedResponse) {
            console.log(`⚡ [CHAT-STREAM] Cache HIT - sending cached response as SSE`)
            // Send cached response in chunks via SSE
            const chunkSize = 20
            let cachedChunkCount = 0
            const cacheStartTime = Date.now()
            for (let i = 0; i < cachedResponse.length; i += chunkSize) {
              const chunk = cachedResponse.substring(i, i + chunkSize)
              cachedChunkCount++
              const delayStart = Date.now()
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
              await new Promise(resolve => setTimeout(resolve, 10))
              const delayEnd = Date.now()
              console.log(`[DIAGNOSTIC-CACHE] Cached chunk ${cachedChunkCount}: ${chunk.length} chars, actual delay: ${delayEnd - delayStart}ms`)
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            console.log(`[DIAGNOSTIC-CACHE] Cached stream complete: ${cachedChunkCount} chunks in ${Date.now() - cacheStartTime}ms`)
            controller.close()
            return
          }

          // Tool execution callback
          const onToolCall = async (toolName: string, toolInput: Record<string, unknown>): Promise<string> => {
            try {
              if (toolName === 'web_search') {
                const query = toolInput.query as string
                console.log(`🌐 [TOOL] Executing web_search: "${query}"`)
                const results = await searchGoogle(query)
                const formatted = formatResultsForPrompt(results)
                console.log(`🌐 [TOOL] web_search returned ${results.length} results`)
                return formatted
              } else if (toolName === 'web_scrape') {
                const url = toolInput.url as string
                console.log(`📄 [TOOL] Executing web_scrape: "${url}"`)
                const scrapedContent = await scrapeUrl(url)
                const contentText = scrapedContent.content
                console.log(`📄 [TOOL] web_scrape returned ${contentText.length} chars`)
                return contentText
              }
              return 'Unknown tool: ' + toolName
            } catch (error) {
              console.error(`❌ [TOOL] Error executing ${toolName}:`, error)
              throw error
            }
          }

          // Generate response with RAW STREAMING (bypasses SDK buffering)
          console.log(`🎯 [CHAT-STREAM] Starting RAW STREAMING with Tool Calling support...`)

          let liveChunkCount = 0
          const chunkTimestamps: { chunkNum: number; chars: number; serverTime: number }[] = []
          for await (const chunk of generateChatResponseRawStream(systemPrompt, chatMessages, onToolCall)) {
            fullResponse += chunk

            // Send chunk via SSE - IMMEDIATE delivery
            const sseChunk = `data: ${JSON.stringify({ content: chunk })}\n\n`
            liveChunkCount++
            const chunkSendTime = Date.now() - streamStartTime
            controller.enqueue(encoder.encode(sseChunk))

            chunkTimestamps.push({ chunkNum: liveChunkCount, chars: chunk.length, serverTime: chunkSendTime })

            if (!firstChunkSent) {
              console.log(`⏱️  [CHAT-STREAM] FIRST CHUNK sent after ${chunkSendTime}ms`)
              firstChunkSent = true
            }

            if (liveChunkCount <= 10 || liveChunkCount % 50 === 0) {
              console.log(`[DIAGNOSTIC-LIVE] Chunk ${liveChunkCount}: +${chunk.length} chars (server timestamp: ${chunkSendTime}ms)`)
            }
          }

          console.log(`[DIAGNOSTIC-TIMING] Chunk transmission timeline:`,
            chunkTimestamps.slice(0, 10).map(t => `#${t.chunkNum}(${t.chars}c@${t.serverTime}ms)`).join(' → '),
            '...',
            chunkTimestamps.slice(-3).map(t => `#${t.chunkNum}(${t.chars}c@${t.serverTime}ms)`).join(' → ')
          )

          // Send completion marker
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))

          const totalTime = Date.now() - streamStartTime
          console.log(`✅ [CHAT-STREAM] SSE complete: ${fullResponse.length} chars in ${totalTime}ms`)

          // Save message to DB after streaming completes
          if (userId) {
            await supabase.from('messages').insert([
              {
                conversation_id: conversationId,
                role: 'assistant',
                content: fullResponse,
              },
            ])

            // Cache the response
            if (queryHash && fullResponse) {
              await cacheResponse(
                queryHash,
                message,
                fullResponse,
                conversationId,
                userId,
                24
              ).catch(err => {
                console.error('Failed to cache response:', err)
              })
            }

            // Generate title for first message in background
            if (isFirstMessage) {
              console.log('✅ Stream complete, queuing title generation...')
              setImmediate(async () => {
                try {
                  const title = await generateConversationTitle(agent.name, message)
                  console.log(`🎯 [TITLE] Generated title: "${title}"`)

                  // Use admin client to update conversation title
                  const adminSupabase = createAdminSupabaseClient()
                  if (!adminSupabase) {
                    console.error('❌ [TITLE] Admin Supabase client not available')
                    return
                  }

                  const { error } = await adminSupabase
                    .from('conversations')
                    .update({ title })
                    .eq('id', conversationId)

                  if (error) {
                    console.error('❌ [TITLE] Failed to update title in DB:', error)
                  } else {
                    console.log(`✅ [TITLE] Successfully updated conversation title in DB`)
                  }
                } catch (err) {
                  console.error('❌ [TITLE] Error generating/updating title:', err instanceof Error ? err.message : 'Unknown error')
                }
              })
            }
          }

          controller.close()
        } catch (error) {
          console.error('Streaming error:', error instanceof Error ? error.message : 'Unknown error')
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Streaming error occurred' })}\n\n`)
          )
          controller.close()
        }
      },
    })

    // Return SSE response with anti-buffering headers
    return new Response(customReadable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('Chat Stream API error:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
