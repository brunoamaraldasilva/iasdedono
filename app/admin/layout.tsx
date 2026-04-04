'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { LogOut, ArrowLeft, BarChart3, Users, Zap, ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#161616' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e0521d] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    )
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const isActive = (path: string) => pathname === path

  const menuItems = [
    { href: '/admin', label: 'Dashboard', icon: BarChart3 },
    { href: '/admin/users', label: 'Usuários', icon: Users },
    { href: '/admin/agents', label: 'Agentes', icon: Zap },
    { href: '/admin/logs', label: 'Logs', icon: ClipboardList },
  ]

  return (
    <div className="h-screen flex" style={{ backgroundColor: '#161616' }}>
      <aside className="w-64 flex flex-col h-full flex-shrink-0 border-r" style={{ backgroundColor: '#222423', borderRightColor: '#333333' }}>
        <div className="p-4 border-b flex-shrink-0" style={{ borderColor: '#333333' }}>
          <h1 className="text-xl font-bold text-[#e0521d]">ADMIN</h1>
          <p className="text-xs text-gray-500 mt-1">Painel de Controle</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {menuItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="block px-4 py-3 rounded-lg text-sm font-semibold transition flex items-center gap-3"
              style={{
                backgroundColor: isActive(href) ? '#333333' : 'transparent',
                color: isActive(href) ? '#e0521d' : '#999999',
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-4 flex-shrink-0 space-y-2" style={{ borderColor: '#333333' }}>
          <div className="text-xs text-gray-500 mb-3">
            <p className="font-semibold text-gray-300">{user?.name || user?.email}</p>
            <p className="text-gray-600 text-xs">{user?.role}</p>
          </div>

          <Link
            href="/dashboard"
            className="block w-full px-3 py-2 text-sm rounded transition flex items-center gap-2 text-left hover:bg-[#333333]"
            style={{ color: '#999999' }}
          >
            <ArrowLeft size={16} />
            Voltar ao Dashboard
          </Link>

          <button
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-sm rounded transition flex items-center gap-2 text-left hover:bg-[#333333]"
            style={{ color: '#999999' }}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b p-4" style={{ borderColor: '#333333' }}>
          <h2 className="text-xl font-bold text-white">Administração</h2>
          <p className="text-xs text-gray-400">Gerenciar usuários, agentes e sistema</p>
        </div>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
