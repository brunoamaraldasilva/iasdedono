'use client'

import { useEffect, useRef, useState } from 'react'

// Ensure useEffect is imported (already is, but making explicit)
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/types/chat'

interface ChatWindowProps {
  messages: ChatMessage[]
  loading: boolean
  isLoadingMessages?: boolean
  agentName?: string
}

interface SourceData {
  title: string
  link: string
}

export function ChatWindow({
  messages,
  loading,
  isLoadingMessages = false,
  agentName = 'Assistant',
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [messageSources, setMessageSources] = useState<Map<number, SourceData[]>>(new Map())

  // Log whenever messages prop changes
  useEffect(() => {
    console.log(`[PHASE 5] ChatWindow received messages prop:`, {
      count: messages.length,
      loading,
      isLoadingMessages,
      lastMessage: messages[messages.length - 1]?.role,
      lastMessageLength: messages[messages.length - 1]?.content?.length || 0,
      preview: messages[messages.length - 1]?.content?.substring(0, 80)
    })
  }, [messages, loading, isLoadingMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Extract sources from messages that have "Fontes Utilizadas:" section
  useEffect(() => {
    const sources = new Map<number, SourceData[]>()

    messages.forEach((msg, index) => {
      if (msg.role === 'assistant') {
        // Match the "Fontes Utilizadas:" section
        const sourcesMatch = msg.content.match(/---\n\*\*Fontes Utilizadas:\*\*\n([\s\S]*?)$/)

        if (sourcesMatch) {
          const sourcesText = sourcesMatch[1]
          const sourceLines = sourcesText.split('\n').filter(line => line.trim().startsWith('- '))

          const extractedSources: SourceData[] = sourceLines
            .map(line => {
              // Match format: "- [Title] (URL)" or "- Title (URL)"
              const titleMatch = line.match(/- (\[?[^\(\]]*\]?)\s*\(([^)]+)\)/)
              if (titleMatch) {
                let title = titleMatch[1]
                // Remove brackets if present
                if (title.startsWith('[') && title.endsWith(']')) {
                  title = title.slice(1, -1)
                }
                return { title, link: titleMatch[2] }
              }
              return null
            })
            .filter((s): s is SourceData => s !== null)

          if (extractedSources.length > 0) {
            sources.set(index, extractedSources)
          }
        }
      }
    })

    setMessageSources(sources)
  }, [messages])

  const getMessageContentWithoutSources = (content: string): string => {
    return content.replace(/---\n\*\*Fontes Utilizadas:\*\*\n[\s\S]*?$/, '').trim()
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="flex flex-col h-full rounded-lg shadow-lg" style={{ backgroundColor: '#222423' }}>
      {/* Header */}
      <div className="border-b p-3 md:p-4 flex-shrink-0" style={{ borderColor: '#333333' }}>
        <h2 className="font-semibold text-base md:text-lg text-white">{agentName}</h2>
        <p className="text-xs md:text-sm text-gray-400">Conversa em andamento</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6 space-y-3 md:space-y-4">

        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 border-4 border-gray-700 border-t-primary rounded-full animate-spin" />
              </div>
              <p className="text-gray-400">Carregando mensagens...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-gray-400 mb-2">Nenhuma mensagem ainda</p>
              <p className="text-sm text-gray-500">
                Comece uma conversa com {agentName}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={`${msg.role}-${index}-${msg.created_at || 'timestamp'}`}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] px-3 md:px-4 py-2 md:py-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-[#e0521d] text-white rounded-br-none'
                      : 'text-gray-100 rounded-bl-none'
                  }`}
                  style={{ backgroundColor: msg.role === 'assistant' ? '#161616' : undefined }}
                >
                  {msg.role === 'assistant' ? (
                    <div>
                      <div className="text-xs md:text-sm break-words prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          children={getMessageContentWithoutSources(msg.content)}
                          components={{
                          p: ({ node, ...props }) => (
                            <p className="mb-2 last:mb-0" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc list-inside mb-2" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal list-inside mb-2" {...props} />
                          ),
                          code: ({ node, inline, ...props }: any) =>
                            inline ? (
                              <code
                                className="bg-gray-700 px-1 rounded text-xs"
                                {...props}
                              />
                            ) : (
                              <code className="block bg-gray-700 p-2 rounded my-2 text-xs overflow-x-auto" {...props} />
                            ),
                          strong: ({ node, ...props }) => (
                            <strong className="font-bold" {...props} />
                          ),
                          em: ({ node, ...props }) => (
                            <em className="italic" {...props} />
                          ),
                          h1: ({ node, ...props }) => (
                            <h1 className="text-lg font-bold mb-2" {...props} />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 className="text-base font-bold mb-2" {...props} />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 className="text-sm font-bold mb-1" {...props} />
                          ),
                          table: ({ node, ...props }) => (
                            <table className="w-full border-collapse border border-gray-600 my-2 text-xs" {...props} />
                          ),
                          thead: ({ node, ...props }) => (
                            <thead className="bg-gray-700" {...props} />
                          ),
                          tbody: ({ node, ...props }) => (
                            <tbody {...props} />
                          ),
                          tr: ({ node, ...props }) => (
                            <tr className="border border-gray-600" {...props} />
                          ),
                          th: ({ node, ...props }) => (
                            <th className="border border-gray-600 px-2 py-1 text-left font-bold bg-gray-700" {...props} />
                          ),
                          td: ({ node, ...props }) => (
                            <td className="border border-gray-600 px-2 py-1" {...props} />
                          ),
                        }}
                      />
                      </div>
                      {/* Display sources if present */}
                      {messageSources.has(index) && messageSources.get(index)!.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-600 space-y-2">
                          <p className="text-xs font-semibold text-gray-400">🔗 Fontes Utilizadas:</p>
                          {messageSources.get(index)!.map((source, sIdx) => (
                            <a
                              key={sIdx}
                              href={source.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#e0521d] hover:underline break-all flex items-center gap-1"
                              title={source.title}
                            >
                              <span>→</span>
                              <span>{source.title || source.link}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm break-words">{msg.content}</p>
                  )}
                  {msg.attachedDocuments && msg.attachedDocuments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-600 space-y-1">
                      {msg.attachedDocuments.map(doc => (
                        <div key={doc.id} className="text-xs text-gray-400 flex items-center gap-1">
                          <span>Documento:</span>
                          <span className="text-gray-300">{doc.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.created_at && (
                    <p
                      className={`text-xs mt-1 ${
                        msg.role === 'user'
                          ? 'text-orange-200'
                          : 'text-gray-500'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="text-gray-100 px-4 py-2 rounded-lg rounded-bl-none" style={{ backgroundColor: '#161616' }}>
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: '#333333' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce delay-100" style={{ backgroundColor: '#333333' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce delay-200" style={{ backgroundColor: '#333333' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
