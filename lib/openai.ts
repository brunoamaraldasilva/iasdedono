import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error('Missing OPENAI_API_KEY environment variable')
}

export const openai = new OpenAI({ apiKey })

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
  type: 'function',
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
  type: 'function',
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

## Web Search Capability - Be Smart About Usage
You have access to a web_search tool. Use it ONLY when necessary:

✅ USE web search when:
- User explicitly asks "latest news", "recent", "2024", "2025", "2026"
- Topic requires current data (prices, stock prices, product availability, recent events)
- User asks "what's new", "what happened recently", "latest"
- Information is time-sensitive and could have changed

❌ DON'T use web search for:
- General knowledge (geography, history, math, science fundamentals)
- Questions about timeless topics (e.g., "what is photosynthesis?")
- Simple calculations or logic problems
- Questions that don't mention recency or current information
- Anything you're confident about from training data

🎯 Be efficient: Conserve API calls, only search when truly needed

## Source Citation Instructions - CRITICAL & MANDATORY
VOCÊ DEVE seguir EXACTAMENTE estas instruções quando usar web search:

1. SEMPRE cite a URL completa, NÃO apenas o nome do site
2. Use markdown links format: [Título da Fonte](https://url.com.br)
3. IMPORTANTE: Coloque a URL entre parênteses no formato markdown

4. OBRIGATÓRIO: No FINAL da sua resposta, se usou web search, ADICIONE:
   ---
   **Fontes Utilizadas:**
   - [Título da Notícia 1](https://url-completa-aqui.com.br)
   - [Título da Notícia 2](https://outra-url.com.br)
   - [Título da Notícia 3](https://terceira-url.com.br)

5. EXEMPLO CORRETO:
"Segundo relatórios recentes, a TikTok está buscando [aval do Banco Central](https://www.infomoney.com.br/...) para atuar como fintech..."

6. DEPOIS DA RESPOSTA, SEMPRE inclua:
---
**Fontes Utilizadas:**
- [TikTok Busca Aval do Banco Central](https://www.infomoney.com.br/mercados/tiktok-busca-aval-do-banco-central)
- [Regulação da Fintech](https://www.finsiders.com.br/artigo)
- [Taxação de Fintechs](https://www.cnnnbrasil.com.br/economia)

⚠️ NUNCA coloque apenas "Fonte: InfoMoney" sem URL
⚠️ NUNCA esqueça a seção "Fontes Utilizadas:" no final
⚠️ SEMPRE use markdown links: [texto](url)

## Web Scraping Capability - Smart Content Extraction
You have access to web_scrape tool to extract full content from specific URLs.

✅ USE web_scrape when:
- User provides a specific URL they want analyzed
- User asks "read this page", "check this link", "aprofunda nesse artigo", "explica esse link"
- You found a relevant URL in search results and need detailed content for your response
- User provides a link in the conversation

❌ DON'T use web_scrape for:
- Scraping multiple pages in sequence (too slow, wastes API calls)
- Links you created yourself or just recommended
- Pages that require authentication
- Large datasets or bulk scraping

💡 Strategy: Combine web_search + web_scrape:
1. User asks about recent news → web_search finds sources
2. User says "aprofunda" or "explica esse" → web_scrape one of the best results
3. Extract key info, provide detailed answer with full sources
`

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
            console.error('[ERROR] [OPENAI] Error executing tool ' + toolCall.function.name + ':', toolError)
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
        const stream = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: requestMessages,
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
      }
    }
  } catch (error) {
    console.error('OpenAI API error with tools:', error)
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
