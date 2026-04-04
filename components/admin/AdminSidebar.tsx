'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  const menuItems = [
    { label: 'Dashboard', href: '/admin', icon: '📊' },
    { label: 'Agents', href: '/admin/agents', icon: '🤖' },
    { label: 'Usuários', href: '/admin/users', icon: '👥' },
  ]

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold mb-1">Dono</h1>
        <p className="text-xs text-gray-400">Admin Panel</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              isActive(item.href)
                ? 'bg-primary text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <Link
          href="/dashboard"
          className="block text-sm text-gray-400 hover:text-white transition py-2 px-4 rounded hover:bg-gray-800"
        >
          ← Voltar para App
        </Link>
      </div>
    </div>
  )
}
