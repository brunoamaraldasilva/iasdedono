'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditLog {
  id: string
  admin_id: string
  action: string
  resource_type: string
  resource_id?: string
  changes?: Record<string, any>
  ip_address?: string
  created_at: string
}

const ITEMS_PER_PAGE = 50

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [resourceFilter, setResourceFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadLogs()
  }, [currentPage, actionFilter, resourceFilter])

  const loadLogs = async () => {
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
      if (actionFilter !== 'all') params.set('action', actionFilter)
      if (resourceFilter !== 'all') params.set('resource', resourceFilter)

      // Call API endpoint with token
      const startTime = performance.now()
      const response = await fetch(`/api/admin/logs/list?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const loadTime = performance.now() - startTime

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao carregar logs')
      }

      const data = await response.json()

      console.log('📋 [AUDIT LOGS] Loaded:', {
        total: data.total,
        retrieved: data.logs?.length || 0,
        page: currentPage,
        loadTime: `${loadTime.toFixed(0)}ms`,
      })

      setTotalLogs(data.total || 0)
      setLogs(data.logs || [])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao carregar logs'
      console.error('❌ [AUDIT LOGS] Error:', errorMsg)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalLogs / ITEMS_PER_PAGE)

  if (loading && logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e0521d] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando logs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Logs de Auditoria</h1>
          <p className="text-gray-400">Acompanhe todas as ações do admin ({totalLogs} total)</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="px-4 py-2 rounded-lg outline-none transition focus:ring-2 focus:ring-[#e0521d] text-white"
            style={{ backgroundColor: '#222423', borderColor: '#333333' }}
          >
            <option value="all">Todas as Ações</option>
            <option value="create_agent">Criar Agent</option>
            <option value="update_agent">Atualizar Agent</option>
            <option value="delete_agent">Deletar Agent</option>
            <option value="publish_agent">Publicar Agent</option>
            <option value="update_user_status">Atualizar Status Usuário</option>
            <option value="update_user_role">Atualizar Role Usuário</option>
            <option value="add_material">Adicionar Material</option>
            <option value="delete_material">Deletar Material</option>
          </select>

          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="px-4 py-2 rounded-lg outline-none transition focus:ring-2 focus:ring-[#e0521d] text-white"
            style={{ backgroundColor: '#222423', borderColor: '#333333' }}
          >
            <option value="all">Todos os Recursos</option>
            <option value="agent">Agent</option>
            <option value="user">Usuário</option>
            <option value="material">Material</option>
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
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Ação</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Recurso</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">ID Recurso</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Data/Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#333333' }}>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Nenhum log encontrado
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottomColor: '#333333' }} className="border-b hover:bg-black/20 transition">
                    <td className="px-6 py-4 text-sm text-white font-medium">{log.action}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{log.resource_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">{log.resource_id?.slice(0, 8)}...</td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
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
              Página {currentPage} de {totalPages} ({totalLogs} logs)
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
