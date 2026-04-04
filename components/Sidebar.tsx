'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types/user'

interface SidebarProps {
  user: User | null
  conversations: Array<{ id: string; title: string }> | []
  inProgressConversation?: string | null
}

export function Sidebar({ user, conversations, inProgressConversation }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (path: string) => pathname === path

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error)
        return
      }
      router.push('/')
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  return (
    <div className="w-64 flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#222423', borderRightColor: '#161616' }}>
      {/* Header */}
      <div className="p-4 border-b flex-shrink-0" style={{ borderColor: '#161616' }}>
        <h1 className="text-2xl font-bold text-primary">IAs DE DONO</h1>
        <p className="text-xs text-gray-500 mt-1"></p>
      </div>

      {/* New Conversation */}
      <Link
        href="/dashboard"
        className="m-4 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-semibold text-center transition flex-shrink-0 flex items-center justify-center gap-2"
      >
        <span>+</span>
        Nova Conversa
      </Link>

      {/* Conversations List - Expandable */}
      <div className="flex-1 flex flex-col overflow-hidden border-t mt-4" style={{ borderColor: '#161616' }}>
        <div className="px-4 py-4 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase">
            Conversas Recentes
          </p>
        </div>

        {conversations.length > 0 ? (
          <div className="flex-1 overflow-y-auto px-4">
            <div className="space-y-2">
              {conversations.map((conv) => {
                const truncatedTitle = conv.title.length > 40
                  ? conv.title.substring(0, 37) + '...'
                  : conv.title

                const isInProgress = inProgressConversation === conv.id

                return (
                  <Link
                    key={conv.id}
                    href={`/dashboard/chat/${conv.id}`}
                    className="block px-3 py-2 text-sm rounded transition break-words flex items-center justify-between gap-2"
                    style={{
                      color: pathname === `/dashboard/chat/${conv.id}` ? 'white' : '#999999',
                      backgroundColor: pathname === `/dashboard/chat/${conv.id}` ? '#161616' : 'transparent'
                    }}
                    title={conv.title}
                  >
                    <span className="flex-1 truncate">{truncatedTitle}</span>
                    {isInProgress && (
                      <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full animate-pulse" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center px-4 text-center">
            <p className="text-xs text-gray-600">Nenhuma conversa ainda</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t space-y-2 flex-shrink-0 p-4" style={{ borderColor: '#161616' }}>
        {user && (
          <div className="text-xs text-gray-500 break-words mb-4">
            <p className="font-semibold text-gray-300">{user.name || user.email}</p>
            <p className="text-gray-600">{user.email}</p>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="space-y-2">
          {/* Admin Button - Only for admins */}
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              className="block w-full px-3 py-2 text-sm rounded transition flex items-center gap-2 font-semibold"
              style={{
                color: isActive('/admin') ? 'white' : '#ffffff',
                backgroundColor: isActive('/admin') ? '#e0521d' : '#222423',
                borderColor: '#e0521d',
                border: '2px solid'
              }}
            >
              ⚙️
              Admin
            </Link>
          )}

          <Link
            href="/dashboard/context"
            className="block w-full px-3 py-2 text-sm rounded transition flex items-center gap-2"
            style={{
              color: isActive('/dashboard/context') ? 'white' : '#999999',
              backgroundColor: isActive('/dashboard/context') ? '#161616' : 'transparent'
            }}
          >
            <Settings size={16} />
            Contexto do Negócio
          </Link>

          <button
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-sm rounded transition flex items-center gap-2 text-left bg-transparent border-none cursor-pointer hover:bg-gray-700"
            style={{ color: '#999999' }}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
