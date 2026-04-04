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
          content: `Crie um título curto para uma conversa com ${agentName} onde o usuário disse: "${truncatedMessage}"`,
        },
      ],
      temperature: 0.5,
      max_tokens: 30,
    })

    const title = response.choices[0]?.message?.content?.trim()
    console.log('🤖 OpenAI Response:', { title, usage: response.usage })

    if (!title) {
      console.warn('⚠️ Empty title response from OpenAI, using fallback')
      return `Conversa com ${agentName}`
    }

    return title
  } catch (error) {
    console.error('❌ Error generating conversation title:', error)
    if (error instanceof Error) {
      console.error('Error details:', { message: error.message, name: error.name })
    }
    return `Conversa com ${agentName}`
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
