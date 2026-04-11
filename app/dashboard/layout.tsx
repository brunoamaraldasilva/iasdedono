'use client'

import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/Sidebar'
import { ContextRequiredModal } from '@/components/ContextRequiredModal'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [conversations, setConversations] = useState<
    Array<{ id: string; title: string }>
  >([])
  const [inProgressConversation, setInProgressConversation] = useState<string | null>(null)
  const [showContextModal, setShowContextModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Shared function to fetch and filter conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return

    try {
      const { data: allConvs } = await supabase
        .from('conversations')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!allConvs) {
        setConversations([])
        return
      }

      // OPTIMIZATION: Get distinct conversation IDs that have messages in one query
      // This replaces the N+1 pattern (1 query per conversation)
      const { data: conversationsWithMessages } = await supabase
        .from('messages')
        .select('conversation_id', { count: 'exact' })
        .eq('conversation_id', allConvs.map((c: any) => c.id)[0] || '')

      // Get unique conversation IDs from messages table
      let conversationIdsWithMessages = new Set<string>()

      if (allConvs.length > 0) {
        // Fetch a batch of recent conversations and check which have messages
        // Limit to top 50 to batch the check efficiently
        const recentConvs = allConvs.slice(0, 50)
        const { data: messageData } = await supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', recentConvs.map((c: any) => c.id))

        if (messageData) {
          conversationIdsWithMessages = new Set(
            messageData.map((m: any) => m.conversation_id)
          )
        }
      }

      // Filter only conversations with messages and limit to 10
      const filteredConvs = allConvs
        .filter((conv: any) => conversationIdsWithMessages.has(conv.id))
        .slice(0, 10)
        .map((conv: any) => ({
          id: conv.id,
          title: conv.title,
        }))

      console.log('💬 [SIDEBAR] Loaded conversations from DB:', filteredConvs.map((c: any) => ({
        id: c.id.slice(0, 8),
        title: c.title,
        hasChat: true
      })))
      setConversations(filteredConvs)
    } catch (err) {
      console.error('Error loading conversations:', err instanceof Error ? err.message : 'Unknown error')
    }
  }, [user])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    // Load on mount
    fetchConversations()

    // Subscribe to changes in real-time
    const subscription = supabase
      .channel(`conversations:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          // Reload conversations whenever they change
          console.log('🔄 [SUBSCRIPTION] Conversation updated:', payload.new?.title || 'untitled')
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user])

  // Monitor messages for all conversations to track in-progress chats
  useEffect(() => {
    if (!user) return

    const messageSubscription = supabase
      .channel(`user_messages:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const { conversation_id, role } = payload.new
          if (role === 'assistant') {
            console.log('✅ Assistant message received for conversation:', conversation_id)
            // Clear in-progress when assistant responds
            setInProgressConversation(null)
          } else if (role === 'user') {
            // Mark conversation as in-progress when user sends message
            setInProgressConversation(conversation_id)
          }
        }
      )
      .subscribe()

    return () => {
      messageSubscription.unsubscribe()
    }
  }, [user])

  // Reload conversations when pathname changes (new chat created)
  useEffect(() => {
    fetchConversations()
  }, [pathname, fetchConversations])

  // Listen for conversation title updates (from chat page)
  useEffect(() => {
    const handleTitleUpdate = (event: any) => {
      console.log('📢 [LAYOUT] Received title update event, refetching conversations...')
      fetchConversations()
    }

    window.addEventListener('conversationTitleUpdated', handleTitleUpdate)
    return () => {
      window.removeEventListener('conversationTitleUpdated', handleTitleUpdate)
    }
  }, [fetchConversations])

  // Check if user has filled business context
  useEffect(() => {
    if (!user) return

    const checkContext = async () => {
      try {
        const { data } = await supabase
          .from('business_context')
          .select('id, completion_percentage')
          .eq('user_id', user.id)
          .single()

        const hasFilledContext = data && data.completion_percentage >= 75
        const isOnContextPage = pathname === '/dashboard/context'

        // Show modal only if context is not filled AND user is not on context page
        if (!hasFilledContext && !isOnContextPage) {
          setShowContextModal(true)
        } else {
          setShowContextModal(false)
        }
      } catch (err) {
        console.error('Error checking context:', err)
      }
    }

    checkContext()
  }, [user, pathname])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="h-screen flex" style={{ backgroundColor: '#161616' }}>
      {/* Sidebar - Fixed on mobile, static on desktop */}
      <aside
        className={`
          fixed md:static
          left-0 top-0 h-full
          transition-all duration-300 z-50
          overflow-hidden
          ${sidebarOpen ? 'w-[250px]' : 'w-0'} md:w-[250px]
        `}
      >
        <Sidebar user={user} conversations={conversations} inProgressConversation={inProgressConversation} />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#161616' }}>
        {/* Mobile Header with toggle */}
        <header className="md:hidden border-b p-4 flex items-center justify-between flex-shrink-0" style={{ borderColor: '#333333' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-2xl text-white hover:text-[#e0521d] transition"
          >
            ☰
          </button>
          <h1 className="text-lg font-bold text-[#e0521d]">IAs de Dono</h1>
          <div className="w-6" />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      <ContextRequiredModal
        isOpen={showContextModal}
        onClose={() => setShowContextModal(false)}
      />
    </div>
  )
}
