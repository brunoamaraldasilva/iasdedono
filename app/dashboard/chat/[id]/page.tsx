'use client'

import { use, useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { ChatWindow } from '@/components/ChatWindow'
import { MessageInput } from '@/components/MessageInput'

interface ChatPageProps {
  params: Promise<{
    id: string
  }>
}

export default function ChatPage({ params }: ChatPageProps) {
  const { id } = use(params)
  const { messages, agent, conversationTitle, loading, isLoadingMessages, error, sendMessage } = useChat(id)
  const [isSending, setIsSending] = useState(false)

  const handleSendMessage = async (content: string, documentIds?: string[], documentNames?: string[]) => {
    setIsSending(true)
    try {
      await sendMessage(content, documentIds, documentNames)
    } finally {
      setIsSending(false)
    }
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4" style={{ backgroundColor: '#161616' }}>
      <div className="flex-1 flex flex-col rounded-lg shadow-lg overflow-hidden" style={{ backgroundColor: '#222423' }}>
        <ChatWindow
          messages={messages}
          loading={loading}
          isLoadingMessages={isLoadingMessages}
          agentName={agent?.name || 'Assistant'}
        />

        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={!agent || loading || isLoadingMessages}
          conversationId={id}
          loading={isSending}
        />
      </div>
    </div>
  )
}
