import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateChatResponseWithTools, generateConversationTitle } from '@/lib/openai'
import { searchGoogle, formatResultsForPrompt } from '@/lib/serpapi'
import { scrapeUrl, isValidUrl, extractUrls } from '@/lib/webscraper'
import { rateLimit } from '@/lib/rateLimit'

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

// Helper to generate and update title asynchronously
async function generateTitleAsync(
  agentName: string,
  message: string,
  conversationId: string,
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>
) {
  try {
    console.log('🚀 [BACKGROUND] START - Title generation function called')
    console.log('📝 [BACKGROUND] Generating title for first message...', { agentName, messagePreview: message.substring(0, 50) })

    if (!agentName || !message || !conversationId) {
      console.error('❌ [BACKGROUND] Missing required parameters:', { agentName: !!agentName, message: !!message, conversationId: !!conversationId })
      return
    }

    if (!adminSupabase) {
      console.error('❌ [BACKGROUND] Admin Supabase client not initialized')
      return
    }

    console.log('🤖 [BACKGROUND] Calling OpenAI generateConversationTitle...')
    const generatedTitle = await generateConversationTitle(agentName, message)
    console.log('✅ [BACKGROUND] Title generated:', generatedTitle)

    if (!generatedTitle) {
      console.warn('⚠️ [BACKGROUND] Generated title is empty, skipping DB update')
      return
    }

    console.log('💾 [BACKGROUND] Updating database with title...', { conversationId, title: generatedTitle })
    // Update conversation title using admin client to bypass RLS
    const { error: updateError, data: updateData } = await adminSupabase
      .from('conversations')
      .update({ title: generatedTitle })
      .eq('id', conversationId)
      .select()

    console.log('💾 [BACKGROUND] Update response:', { error: updateError, dataCount: updateData?.length || 0 })

    if (updateError) {
      console.error('❌ [BACKGROUND] Error updating conversation title:', updateError)
    } else if (!updateData || updateData.length === 0) {
      console.error('❌ [BACKGROUND] No rows updated - conversation ID might not exist:', conversationId)
    } else {
      console.log('✅ [BACKGROUND] Conversation title updated in database successfully', { updatedTitle: updateData[0]?.title })
    }
  } catch (err) {
    console.error('❌ [BACKGROUND] Error generating conversation title:')
    console.error('   Error type:', err instanceof Error ? err.constructor.name : typeof err)
    console.error('   Message:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) {
      console.error('   Stack:', err.stack.split('\n').slice(0, 3).join('\n'))
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { conversationId, agentId, message, isFirstMessage, documentIds } = await request.json()

    if (!conversationId || !agentId || !message) {
      console.error('Missing required fields:', { conversationId, agentId, message })
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, agentId, and message are required' },
        { status: 400 }
      )
    }

    // Validate message length to prevent DoS
    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message too long (max 5000 characters)' },
        { status: 400 }
      )
    }

    // Create Supabase client with anon key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') || '',
        },
      },
    })

    // Get authenticated user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // For beta mode (no auth), use a placeholder user
    const userId = user?.id || 'beta-user'
    const isBeta = !user?.id

    // Create admin Supabase client for background title updates
    const adminSupabase = createAdminSupabaseClient()

    // Rate limit: 30 requests per minute per user (skip for beta)
    if (!isBeta) {
      const rateLimitCheck = rateLimit(`chat:${userId}`, 30, 60000)
      if (!rateLimitCheck.success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again in a moment.' },
          { status: 429 }
        )
      }
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentError) {
      console.error('Error fetching agent:', agentError)
      return NextResponse.json(
        { error: 'Agent not found or error loading agent' },
        { status: 404 }
      )
    }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Get conversation and verify ownership (skip for beta)
    let conversation = null
    if (!isBeta) {
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single()

      if (convError || !convData) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        )
      }

      // Verify user owns this conversation
      if (convData.user_id !== userId) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }

      conversation = convData
    }

    // Get business context (skip for beta)
    let context = null
    if (!isBeta && conversation) {
      const { data: contextData } = await supabase
        .from('business_context')
        .select('*')
        .eq('user_id', conversation.user_id)
        .single()
      context = contextData
    }

    // Get recent messages (skip for beta)
    let messagesData = []
    if (!isBeta) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(7)
      messagesData = msgs || []
    }

    // Reverse to get ascending order for context building
    const messages = messagesData ? messagesData.reverse() : []

    // Build system prompt with context
    let systemPrompt = agent.system_prompt

    // Add context to system prompt
    if (context) {
      systemPrompt += `

## Contexto do Negócio:
- Descrição: ${context.description || 'Não fornecido'}
- Indústria: ${context.industry || 'Não fornecido'}
- Objetivos: ${context.goals || 'Não fornecido'}`
    }

    // Get agent materials via admin client (bypasses RLS)
    let materials = []
    if (adminSupabase) {
      const { data: materialsData } = await adminSupabase
        .from('agent_materials')
        .select('*')
        .eq('agent_id', agentId)
        .order('order', { ascending: true })
      materials = materialsData || []
    }

    if (materials.length > 0) {
      console.log('[CHAT] Loading agent materials:', materials.length)
      systemPrompt += `

## Materiais e Contextos Disponíveis:`
      materials.forEach((material) => {
        if (material.is_file_based) {
          // File-based materials: use full content (already limited to 10000 chars)
          systemPrompt += `

### ${material.title} (${material.file_type?.toUpperCase() || 'Documento'})
${material.content}`
          console.log('[CHAT] Added file material:', material.title + ' (' + material.file_size + ' bytes)')
        } else {
          // Text materials: use preview
          systemPrompt += `
- ${material.title}: ${material.content.substring(0, 300)}...`
          console.log('[CHAT] Added text material:', material.title)
        }
      })
      console.log('[CHAT] Agent materials injected into prompt')
    }

    // Tool callback for web search
    const webSearchSources: Array<{ title: string; link: string }> = []

    const handleToolCall = async (toolName: string, toolInput: Record<string, unknown>): Promise<string> => {
      if (toolName === 'web_search') {
        try {
          const query = toolInput.query as string
          if (!query) {
            return 'Error: No search query provided'
          }

          console.log('🔍 [CHAT] Agent calling web_search for:', query.substring(0, 100))
          const searchResults = await searchGoogle(query, { num: 5 })

          if (searchResults && searchResults.length > 0) {
            console.log('✅ [CHAT] Found', searchResults.length, 'web results')

            // Store sources for later display
            searchResults.forEach(r => {
              if (!webSearchSources.find(s => s.link === r.link)) {
                webSearchSources.push({ title: r.title, link: r.link })
              }
            })

            // Format with STRICT instructions to preserve URLs
            const formattedResults = searchResults
              .map((r, i) => `${i + 1}. **[${r.title}](${r.link})**\n   Link: ${r.link}\n   Resumo: ${r.snippet}`)
              .join('\n\n')

            return `Web search results for "${query}"\n\nIMPORTANT: Cite EXACTLY as shown below with markdown links and full URLs:\n\n${formattedResults}\n\nMUSTHAVE: You MUST include these sources at the end in format:\n---\n**Fontes Utilizadas:**\n${searchResults.map(r => `- [${r.title}](${r.link})`).join('\n')}`
          } else {
            return `No search results found for "${query}". Please provide your response based on your knowledge.`
          }
        } catch (searchError) {
          console.error('❌ [CHAT] Web search error:', searchError)
          // Graceful fallback - agent can still respond
          return `Web search temporarily unavailable: ${searchError instanceof Error ? searchError.message : 'Unknown error'}. Please respond based on your knowledge.`
        }
      } else if (toolName === 'web_scrape') {
        try {
          const url = toolInput.url as string
          const selector = toolInput.selector as string | undefined

          if (!url || !isValidUrl(url)) {
            return 'Error: Invalid URL. Must be a valid HTTP(S) URL.'
          }

          console.log('🌐 [CHAT] Agent calling web_scrape for:', url)
          const scrapedContent = await scrapeUrl(url, selector)

          console.log('✅ [CHAT] Successfully scraped:', url)

          // Retornar conteúdo para agent usar
          return `Scraped content from: ${scrapedContent.title || url}\n\n${scrapedContent.content}\n\nSource: ${url}\nScraped: ${scrapedContent.scrapedAt}`
        } catch (scrapeError) {
          console.error('❌ [CHAT] Web scrape error:', scrapeError)
          // Graceful fallback
          return `Web scrape failed: ${scrapeError instanceof Error ? scrapeError.message : 'Unknown error'}. Please provide your response based on available information.`
        }
      }
      return 'Unknown tool'
    }

    // Add document text if provided
    if (documentIds && documentIds.length > 0) {
      console.log('📎 [CHAT] Loading documents for:', documentIds)

      // Use admin client to read extracted_text (bypasses RLS)
      const adminSupabaseClient = createAdminSupabaseClient()
      const docClient = adminSupabaseClient || supabase

      if (!docClient) {
        console.error('[CHAT] Document client not available')
      } else {
        const { data: docs } = await docClient
          .from('documents')
          .select('id, filename, extracted_text')
          .in('id', documentIds)

        if (docs && docs.length > 0) {
          console.log('📄 [CHAT] Document details:', docs.map(d => ({
            id: d.id,
            filename: d.filename,
            textLength: d.extracted_text?.length || 0,
            hasText: !!d.extracted_text
          })))

          systemPrompt += `

## Documentos Anexados à Conversa:`
          docs.forEach((doc) => {
            if (doc.extracted_text) {
              systemPrompt += `

### ${doc.filename}
${doc.extracted_text}`
              console.log(`✅ [CHAT] Added text from ${doc.filename} (${doc.extracted_text.length} chars)`)
            } else {
              console.warn(`⚠️ [CHAT] Document ${doc.filename} has no extracted_text!`)
            }
          })
          console.log('✅ [CHAT] Added', docs.length, 'documents to context')
        }
      }
    }

    // Prepare messages for OpenAI
    const chatMessages = messages?.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })) || []

    chatMessages.push({
      role: 'user' as const,
      content: message,
    })

    // Create streaming response
    const encoder = new TextEncoder()
    let fullResponse = ''

    // Debug: Log the full prompt being sent to OpenAI
    console.log('🔵 [CHAT] Final systemPrompt being sent to OpenAI:')
    console.log('📊 [CHAT] Prompt length:', systemPrompt.length, 'chars')
    console.log('📊 [CHAT] First 500 chars:', systemPrompt.substring(0, 500))
    if (systemPrompt.includes('Documentos')) {
      console.log('✅ [CHAT] Documentos section FOUND in prompt')
    } else {
      console.log('❌ [CHAT] Documentos section NOT FOUND in prompt')
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Generate streamed response with tools
          console.log('🎯 [CHAT] Starting chat with Tool Calling support...')
          for await (const chunk of generateChatResponseWithTools(systemPrompt, chatMessages, handleToolCall)) {
            fullResponse += chunk
            // Send chunk to client
            controller.enqueue(encoder.encode(chunk))
          }

          // Save assistant message to DB after streaming completes (skip for beta)
          if (!isBeta) {
            const { error: insertAssistantError } = await supabase
              .from('messages')
              .insert([
                {
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: fullResponse,
                },
              ])

            if (insertAssistantError) {
              console.error('Failed to save assistant message')
            }
          }

          controller.close()

          // Generate title on first message - AFTER response closes, in background (skip for beta)
          if (!isBeta && isFirstMessage) {
            console.log('✅ Stream closed, now starting title generation in background...')
            // Queue the title generation to run asynchronously without blocking
            setImmediate(() => {
              generateTitleAsync(agent.name, message, conversationId, adminSupabase).catch((err) => {
                console.error('❌ Background title generation failed:', err)
              })
            })
          }
        } catch (error) {
          console.error('Streaming error:', error instanceof Error ? error.message : 'Unknown error')
          controller.enqueue(encoder.encode('\n[Erro ao processar resposta]'))
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
