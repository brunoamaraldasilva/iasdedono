'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { CheckCircle, Circle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'

interface UserWithStats {
  id: string
  email: string
  name?: string
  role?: string
  status?: string
  created_at: string
  last_login?: string
  conversation_count?: number
  message_count?: number
}

const ITEMS_PER_PAGE = 50

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithStats[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [currentPage, search, roleFilter, statusFilter])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      // Build query params
      const params = new URLSearchParams()
      params.set('page', currentPage.toString())
      if (search) params.set('search', search)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      // Call API endpoint with token
      const response = await fetch(`/api/admin/users/list?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao carregar usuários')
      }

      const data = await response.json()

      console.log('📊 [ADMIN USERS] Loaded:', {
        total: data.total,
        retrieved: data.users?.length || 0,
        page: currentPage,
      })

      setTotalUsers(data.total || 0)
      setUsers(data.users || [])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao carregar usuários'
      console.error('❌ [ADMIN USERS] Error:', errorMsg)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const updateUserStatus = async (userId: string, newStatus: string) => {
    try {
      setActionLoading(userId)

      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      // Call API endpoint with token for server-side validation
      const response = await fetch('/api/admin/users/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId, status: newStatus }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar')
      }

      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, status: newStatus } : u)
      )
      toast.success(`Usuário ${newStatus === 'active' ? 'ativado' : 'desativado'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar usuário')
    } finally {
      setActionLoading(null)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setActionLoading(userId)

      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      // Call API endpoint with token for server-side validation
      const response = await fetch('/api/admin/users/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar')
      }

      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, role: newRole } : u)
      )
      toast.success(`Role atualizado para ${newRole}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar role')
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE)

  if (loading && users.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e0521d] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando usuários...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Usuários</h1>
          <p className="text-gray-400">Gerenciar usuários da plataforma ({totalUsers} total)</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <input
            type="text"
            placeholder="Buscar por email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            className="px-4 py-2 rounded-lg outline-none transition focus:ring-2 focus:ring-[#e0521d] text-white"
            style={{ backgroundColor: '#222423', borderColor: '#333333' }}
          />

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="px-4 py-2 rounded-lg outline-none transition focus:ring-2 focus:ring-[#e0521d] text-white"
            style={{ backgroundColor: '#222423', borderColor: '#333333' }}
          >
            <option value="all">Todos os Roles</option>
            <option value="user">Usuário</option>
            <option value="admin">Admin</option>
            <option value="support">Support</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="px-4 py-2 rounded-lg outline-none transition focus:ring-2 focus:ring-[#e0521d] text-white"
            style={{ backgroundColor: '#222423', borderColor: '#333333' }}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="suspended">Suspenso</option>
          </select>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#8B2e2e', borderColor: '#c53030' }}>
            <p className="text-[#ff6b6b]">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#222423', border: '1px solid #333333' }}>
          <table className="w-full">
            <thead style={{ backgroundColor: '#161616', borderBottomColor: '#333333' }} className="border-b">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Nome</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Conversas</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Cadastro</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#333333' }}>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} style={{ borderBottomColor: '#333333' }} className="border-b hover:bg-black/20 transition">
                    <td className="px-6 py-4 text-sm text-white font-medium">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{user.name || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <select
                        value={user.role || 'user'}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        disabled={actionLoading === user.id}
                        className="px-2 py-1 text-sm rounded outline-none focus:ring-2 focus:ring-[#e0521d] disabled:opacity-50 text-white"
                        style={{ backgroundColor: '#333333' }}
                      >
                        <option value="user">Usuário</option>
                        <option value="admin">Admin</option>
                        <option value="support">Support</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 w-fit"
                        style={{
                          backgroundColor:
                            user.status === 'active'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : user.status === 'suspended'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(107, 114, 128, 0.2)',
                          color:
                            user.status === 'active'
                              ? '#10b981'
                              : user.status === 'suspended'
                              ? '#ef4444'
                              : '#9ca3af',
                        }}
                      >
                        {user.status === 'active' ? (
                          <>
                            <CheckCircle size={14} />
                            Ativo
                          </>
                        ) : user.status === 'suspended' ? (
                          <>
                            <AlertCircle size={14} />
                            Suspenso
                          </>
                        ) : (
                          <>
                            <Circle size={14} />
                            Inativo
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{user.conversation_count || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2 flex">
                      {user.status === 'active' ? (
                        <button
                          onClick={() => updateUserStatus(user.id, 'inactive')}
                          disabled={actionLoading === user.id}
                          className="px-3 py-1 rounded text-xs font-semibold disabled:opacity-50 transition hover:bg-opacity-80"
                          style={{ backgroundColor: 'rgba(107, 114, 128, 0.2)', color: '#d1d5db' }}
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          onClick={() => updateUserStatus(user.id, 'active')}
                          disabled={actionLoading === user.id}
                          className="px-3 py-1 rounded text-xs font-semibold disabled:opacity-50 transition hover:bg-opacity-80"
                          style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}
                        >
                          Ativar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Página {currentPage} de {totalPages} ({totalUsers} usuários)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition hover:bg-opacity-80 flex items-center gap-2"
                style={{ backgroundColor: '#333333', color: '#9ca3af' }}
              >
                <ChevronLeft size={16} />
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition hover:bg-opacity-80 flex items-center gap-2"
                style={{ backgroundColor: '#333333', color: '#9ca3af' }}
              >
                Próxima
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
