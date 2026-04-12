import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY || ''

// Create OpenAI client only if API key is available
export const openai = apiKey ? new OpenAI({ apiKey }) : (null as any as OpenAI)

export async function generateChatResponse(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    return response.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw error
  }
}

// Tool definition for web search
const WEB_SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description: 'Search the web for current information when you need up-to-date facts, recent news, or information beyond your training data. Use this when the user asks about recent events, current prices, new products, or information that changes frequently.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The search query to send to the web search engine. Keep it concise and relevant.'
        }
      },
      required: ['query']
    }
  }
}

// Tool definition for web scraping
const WEB_SCRAPE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'web_scrape',
    description: 'Scrape the full content of a specific URL to get detailed information. Use this when you need to analyze a specific page or link in detail, not just search results. Only use for URLs provided by the user or found in search results.',
    parameters: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scrape. Must be a valid HTTP(S) URL.'
        },
        selector: {
          type: 'string',
          description: 'Optional CSS selector to extract specific content from the page. If omitted, returns main article content or full page text.'
        }
      },
      required: ['url']
    }
  }
}

export async function* generateChatResponseStream(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        yield content
      }
    }
  } catch (error) {
    console.error('OpenAI streaming API error:', error)
    throw error
  }
}

export async function* generateChatResponseWithTools(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onToolCall?: (toolName: string, toolInput: Record<string, unknown>) => Promise<string>
) {
  try {
    const systemWithInstructions = systemPrompt + `

## Web Search & Scraping

**Web Search:** Use ONLY for recent/time-sensitive info (news, prices, 2025+). NOT general knowledge.

**Source Format (MANDATORY):**
End with: ---
**Fontes:** [Title](https://url.com)

**Web Scrape:** Detailed content when URL provided.`

    let requestMessages: any[] = [
      {
        role: 'system',
        content: systemWithInstructions,
      },
      ...messages,
    ]

    let continueLoop = true
    while (continueLoop) {
      continueLoop = false

      // Make initial request with tools enabled
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: requestMessages,
        temperature: 0.7,
        max_tokens: 2000,
        tools: [WEB_SEARCH_TOOL, WEB_SCRAPE_TOOL],
        tool_choice: 'auto',
      })

      const choice = response.choices[0]
      const message = choice.message

      // If there are tool calls, execute them
      if (choice.finish_reason === 'tool_calls' && message.tool_calls && message.tool_calls.length > 0) {
        console.log('🔧 [OPENAI] Agent is calling tools:', message.tool_calls.map((tc: any) => tc.function.name))

        // Add assistant message with tool calls
        requestMessages.push({
          role: 'assistant',
          content: message.content || '',
          tool_calls: message.tool_calls
        })

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          try {
            // Type guard for function-type tool calls
            if (!('function' in toolCall)) {
              console.warn('[WARN] [OPENAI] Tool call does not have function property')
              continue
            }

            const toolInput = JSON.parse(toolCall.function.arguments)
            const toolResult = await onToolCall!(toolCall.function.name, toolInput)

            // Add tool result to messages using correct format
            requestMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult
            })

            console.log('[OK] [OPENAI] Tool ' + toolCall.function.name + ' executed successfully')
          } catch (toolError) {
            console.error('[ERROR] [OPENAI] Error executing tool:', toolError)
            requestMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: 'Error: ' + (toolError instanceof Error ? toolError.message : 'Unknown error')
            })
          }
        }

        // Loop back to get the next response
        continueLoop = true
      } else {
        // No tool calls, stream the final response with streaming
        console.log('[OPENAI] ⏳ Making streaming request to OpenAI (stream: true)')
        const streamStartTime = Date.now()
        const stream = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: requestMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: true,
        })
        const streamCreatedTime = Date.now() - streamStartTime
        console.log(`[OPENAI] ✅ Streaming request created in ${streamCreatedTime}ms`)

        let chunkCount = 0
        let totalContent = ''
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            chunkCount++
            totalContent += content
            if (chunkCount <= 5 || chunkCount % 10 === 0) {
              console.log(`[OPENAI] 📦 OpenAI chunk ${chunkCount}: ${content.length} chars, total: ${totalContent.length}`)
            }
            yield content
          }
        }
        const totalTime = Date.now() - streamStartTime
        console.log(`[OPENAI] ✅ Stream complete: ${chunkCount} chunks, ${totalContent.length} total chars in ${totalTime}ms`)
      }
    }
  } catch (error) {
    console.error('OpenAI API error with tools:', error)
    throw error
  }
}

/**
 * Raw HTTP streaming - reads chunks directly from OpenAI API socket
 * This bypasses SDK buffering and provides true real-time streaming
 * Solves issue where all chunks arrive at once instead of streaming
 */
export async function* generateChatResponseRawStream(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onToolCall?: (toolName: string, toolInput: Record<string, unknown>) => Promise<string>
) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  try {
    // Build the same tool-calling loop, but use raw streaming for final response
    const systemWithInstructions = systemPrompt + `

## Web Search & Scraping

**Web Search:** Use ONLY for recent/time-sensitive info (news, prices, 2025+). NOT general knowledge.

**Source Format (MANDATORY):**
End with: ---
**Fontes:** [Title](https://url.com)

**Web Scrape:** Detailed content when URL provided.`

    let requestMessages: any[] = [
      {
        role: 'system',
        content: systemWithInstructions,
      },
      ...messages,
    ]

    let continueLoop = true
    while (continueLoop) {
      continueLoop = false

      // Make initial request with tools enabled (non-streaming)
      const toolResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: requestMessages,
          temperature: 0.7,
          max_tokens: 2000,
          tools: [
            {
              type: 'function',
              function: {
                name: 'web_search',
                description: 'Search the web for current information when you need up-to-date facts, recent news, or information beyond your training data.',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'The search query to send to the web search engine.',
                    },
                  },
                  required: ['query'],
                },
              },
            },
            {
              type: 'function',
              function: {
                name: 'web_scrape',
                description: 'Scrape the full content of a specific URL to get detailed information.',
                parameters: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string',
                      description: 'The URL to scrape. Must be a valid HTTP(S) URL.',
                    },
                    selector: {
                      type: 'string',
                      description: 'Optional CSS selector to extract specific content.',
                    },
                  },
                  required: ['url'],
                },
              },
            },
          ],
          tool_choice: 'auto',
        }),
      })

      if (!toolResponse.ok) {
        throw new Error(`OpenAI API error: ${toolResponse.statusText}`)
      }

      const choice = (await toolResponse.json()).choices[0]
      const message = choice.message

      // Handle tool calls
      if (choice.finish_reason === 'tool_calls' && message.tool_calls && message.tool_calls.length > 0) {
        console.log('🔧 [OPENAI-RAW] Agent is calling tools:', message.tool_calls.map((tc: any) => tc.function.name))

        requestMessages.push({
          role: 'assistant',
          content: message.content || '',
          tool_calls: message.tool_calls,
        })

        for (const toolCall of message.tool_calls) {
          try {
            if (!('function' in toolCall)) {
              console.warn('[WARN] [OPENAI-RAW] Tool call missing function')
              continue
            }

            const toolInput = JSON.parse(toolCall.function.arguments)
            const toolResult = await onToolCall!(toolCall.function.name, toolInput)

            requestMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult,
            })

            console.log('[OK] [OPENAI-RAW] Tool ' + toolCall.function.name + ' executed')
          } catch (toolError) {
            console.error('[ERROR] [OPENAI-RAW] Tool error:', toolError)
            requestMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: 'Error: ' + (toolError instanceof Error ? toolError.message : 'Unknown'),
            })
          }
        }

        continueLoop = true
      } else {
        // No tool calls - use raw streaming for final response
        console.log('[OPENAI-RAW] 🚀 Making RAW STREAMING request (bypassing SDK buffering)')
        const streamStartTime = Date.now()

        const streamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: requestMessages,
            temperature: 0.7,
            max_tokens: 2000,
            stream: true,
          }),
        })

        if (!streamResponse.ok) {
          throw new Error(`OpenAI streaming API error: ${streamResponse.statusText}`)
        }

        const reader = streamResponse.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let chunkCount = 0
        let totalContent = ''
        const firstReadStartTime = Date.now()
        let firstReadDone = false

        try {
          while (true) {
            const readStartTime = Date.now()
            const { done, value } = await reader.read()
            const readEndTime = Date.now()

            if (!firstReadDone) {
              firstReadDone = true
              console.log(`[OPENAI-RAW] ⏱️ FIRST reader.read() took ${readEndTime - firstReadStartTime}ms to return`)
            }

            if (value) {
              console.log(`[OPENAI-RAW] 📥 reader.read() returned ${value.byteLength} bytes in ${readEndTime - readStartTime}ms`)
            }

            if (done) break

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')

            // Process all complete lines
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i].trim()

              // Skip empty lines
              if (!line) continue

              // Check for [DONE] marker
              if (line === 'data: [DONE]') {
                console.log('[OPENAI-RAW] ✅ Stream complete: [DONE] received')
                break
              }

              // Parse SSE format: "data: {json}"
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.substring(6)
                  const parsed = JSON.parse(jsonStr)

                  const content = parsed.choices?.[0]?.delta?.content || ''
                  if (content) {
                    chunkCount++
                    totalContent += content
                    if (chunkCount <= 5 || chunkCount % 20 === 0) {
                      console.log(`[OPENAI-RAW] 📦 Chunk ${chunkCount}: ${content.length} chars, total: ${totalContent.length}`)
                    }
                    yield content
                  }
                } catch (parseError) {
                  // Silently skip parse errors (sometimes OpenAI sends extra whitespace)
                }
              }
            }

            // Keep the last incomplete line in buffer
            buffer = lines[lines.length - 1]
          }
        } finally {
          reader.releaseLock()
        }

        const totalTime = Date.now() - streamStartTime
        console.log(`[OPENAI-RAW] ✅ Raw stream complete: ${chunkCount} chunks, ${totalContent.length} chars in ${totalTime}ms`)
      }
    }
  } catch (error) {
    console.error('[OPENAI-RAW] Error:', error)
    throw error
  }
}

export async function transcribeAudio(audioFile: File) {
  try {
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    })

    return response.text
  } catch (error) {
    console.error('Whisper API error:', error)
    throw error
  }
}

export async function generateConversationTitle(
  agentName: string,
  userMessage: string
): Promise<string> {
  try {
    // Truncate message if too long
    const truncatedMessage = userMessage.length > 100 ? userMessage.substring(0, 100) + '...' : userMessage

    console.log('🤖 OpenAI: Calling generateConversationTitle with:', { agentName, messageLength: userMessage.length })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente que gera títulos curtos e descritivos para conversas. O título deve ter no máximo 5 palavras e descrever o assunto da conversa de forma concisa. Responda APENAS com o título, sem aspas ou pontuação extra.',
        },
        {
          role: 'user',
          content: 'Crie um título curto para uma conversa com ' + agentName + ' onde o usuário disse: "' + truncatedMessage + '"',
        },
      ],
      temperature: 0.5,
      max_tokens: 30,
    })

    const title = response.choices[0]?.message?.content?.trim()
    console.log('🤖 OpenAI Response:', { title, usage: response.usage })

    if (!title) {
      console.warn('⚠️ Empty title response from OpenAI, using fallback')
      return 'Conversa com ' + agentName
    }

    return title
  } catch (error) {
    console.error('❌ Error generating conversation title:', error)
    if (error instanceof Error) {
      console.error('Error details:', { message: error.message, name: error.name })
    }
    return 'Conversa com ' + agentName
  }
}

export async function compressChatHistory(messages: string[]): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente que resume conversas mantendo os pontos principais. Resuma os seguintes pontos de conversa em bullet points concisos.',
        },
        {
          role: 'user',
          content: messages.join('\n\n'),
        },
      ],
      temperature: 0.5,
      max_tokens: 800,
    })

    return response.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('Error compressing chat history:', error)
    throw error
  }
}
