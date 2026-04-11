import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateChatResponseWithTools, generateConversationTitle } from '@/lib/openai'
import { searchGoogle, formatResultsForPrompt } from '@/lib/serpapi'
import { scrapeUrl, isValidUrl, extractUrls } from '@/lib/webscraper'
import { rateLimit } from '@/lib/rateLimit'
import { generateQueryHash, getCachedResponse, cacheResponse } from '@/lib/chatCache'

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
  try {
    // Extract query parameters (synchronous in GET handlers)
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

    // Rate limiting
    const rateLimitResult = rateLimit('chat', 10)
    if (!rateLimitResult.success) {
      return new Response('Rate limited', { status: 429 })
    }

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
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 401 })
    }

    // Get agent
    const { data: agent } = await supabase.from('agents').select('*').eq('id', agentId).single()

    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found or error loading agent' }), { status: 404 })
    }

    console.log(`🎯 [CHAT-STREAM] Starting SSE stream for message: "${message.substring(0, 50)}"`)

    // Create SSE stream
    const encoder = new TextEncoder()
    let fullResponse = ''
    let firstChunkSent = false
    const streamStartTime = Date.now()

    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          // Build system prompt
          let systemPrompt = agent.system_prompt || 'Você é um assistente útil.'

          // Add business context if available
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

          // Check cache
          const queryHash = generateQueryHash(message, conversationId, agentId)
          const cachedResponse = await getCachedResponse(queryHash)

          if (cachedResponse) {
            console.log(`⚡ [CHAT-STREAM] Cache HIT - sending cached response as SSE`)
            // Send cached response in chunks via SSE
            const chunkSize = 20
            for (let i = 0; i < cachedResponse.length; i += chunkSize) {
              const chunk = cachedResponse.substring(i, i + chunkSize)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
              await new Promise(resolve => setTimeout(resolve, 10))
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            return
          }

          // Generate response with streaming
          console.log(`🎯 [CHAT-STREAM] Starting chat with Tool Calling support...`)

          for await (const chunk of generateChatResponseWithTools(systemPrompt, chatMessages)) {
            fullResponse += chunk

            // Send chunk via SSE
            const sseChunk = `data: ${JSON.stringify({ content: chunk })}\n\n`
            controller.enqueue(encoder.encode(sseChunk))

            if (!firstChunkSent) {
              const firstChunkLatency = Date.now() - streamStartTime
              console.log(`⏱️  [CHAT-STREAM] FIRST CHUNK sent after ${firstChunkLatency}ms`)
              firstChunkSent = true
            }
          }

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
              setImmediate(() => {
                generateConversationTitle(agent.name, message)
                  .then(title => {
                    return supabase
                      .from('conversations')
                      .update({ title })
                      .eq('id', conversationId)
                  })
                  .catch(err => console.error('Title generation failed:', err))
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

    // Return SSE response
    return new Response(customReadable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat Stream API error:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
