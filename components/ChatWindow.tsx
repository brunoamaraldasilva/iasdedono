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
  conversationStarters?: string[]
  onStarterClick?: (starter: string) => Promise<void>
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
  conversationStarters = [],
  onStarterClick,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const contentElementRef = useRef<HTMLDivElement | null>(null)
  const [messageSources, setMessageSources] = useState<Map<number, SourceData[]>>(new Map())
  const [clickingStarter, setClickingStarter] = useState<string | null>(null)

  // Log whenever messages prop changes
  const renderCountRef = useRef(0)
  useEffect(() => {
    renderCountRef.current += 1
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    console.log(`[PHASE 5] RENDER #${renderCountRef.current} at ${timestamp}:`, {
      count: messages.length,
      loading,
      isLoadingMessages,
      lastMessage: messages[messages.length - 1]?.role,
      lastMessageLength: messages[messages.length - 1]?.content?.length || 0,
      preview: messages[messages.length - 1]?.content?.substring(0, 80)
    })

    // DEBUG: Log what will actually render
    if (messages.length > 0) {
      console.log(`[DEBUG] Messages array content:`, messages.map((msg, idx) => ({
        index: idx,
        role: msg.role,
        contentLength: msg.content?.length,
        firstChars: msg.content?.substring(0, 30)
      })))
    }
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
            <div className="w-full max-w-md">
              <p className="text-gray-400 mb-6">Nenhuma mensagem ainda</p>

              {conversationStarters && conversationStarters.length > 0 ? (
                <div className="w-full space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-5 px-2">
                      Comece por uma sugestão
                    </h3>
                    <div className="space-y-2">
                      {conversationStarters.map((starter, idx) => (
                        <button
                          key={idx}
                          onClick={async () => {
                            if (onStarterClick) {
                              setClickingStarter(starter)
                              try {
                                await onStarterClick(starter)
                              } finally {
                                setClickingStarter(null)
                              }
                            }
                          }}
                          disabled={clickingStarter !== null}
                          className={`
                            w-full px-4 py-3 rounded-md text-sm text-left transition-all duration-200
                            border border-gray-600 hover:border-gray-500
                            hover:translate-x-1 hover:shadow-md
                            disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:shadow-none
                            ${clickingStarter === starter
                              ? 'bg-gray-700 border-gray-500'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                            }
                          `}
                          style={clickingStarter !== starter ? {
                            backgroundColor: 'rgba(51, 51, 51, 0.5)',
                            borderColor: 'rgba(107, 114, 128, 0.5)',
                            color: '#d1d5db'
                          } : undefined}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-200">{starter}</span>
                            {clickingStarter === starter ? (
                              <span className="text-xs text-gray-400 ml-2">Processando...</span>
                            ) : (
                              <span className="text-gray-500 text-lg">→</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-400 mb-4">
                    Comece uma conversa com <span className="text-gray-300 font-medium">{agentName}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Digite sua pergunta na caixa abaixo para iniciar
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {console.log(`[DEBUG RENDER] Rendering ${messages.length} messages`)}
            {messages.map((msg, index) => {
              console.log(`[DEBUG RENDER] Message ${index}:`, {
                role: msg.role,
                contentLength: msg.content?.length,
                hasContent: !!msg.content && msg.content.length > 0
              })
              return (
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
                      <div
                        ref={(el) => {
                          if (el && index === messages.length - 1) {
                            contentElementRef.current = el
                          }
                        }}
                        className="text-xs md:text-sm break-words prose prose-sm prose-invert max-w-none"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          children={getMessageContentWithoutSources(msg.content)}
                          components={{
                          p: ({ node, ...props }) => (
                            <p className="mb-2 last:mb-0" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="text-sm" {...props} />
                          ),
                          a: ({ node, ...props }: any) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#e0521d] hover:underline cursor-pointer"
                            />
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
              )
            })}
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
