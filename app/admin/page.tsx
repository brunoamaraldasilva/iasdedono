'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface MessageData {
  date: string
  messages: number
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalAgents: 0,
    publishedAgents: 0,
    totalConversations: 0,
    totalMessages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<MessageData[]>([])
  const [filterDays, setFilterDays] = useState(7)

  useEffect(() => {
    loadStats()
    loadChartData(filterDays)
  }, [])

  useEffect(() => {
    loadChartData(filterDays)
  }, [filterDays])

  const loadStats = async () => {
    try {
      setLoading(true)

      // Total users
      const { count: usersCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Active users
      const { count: activeCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'user')

      // Total agents
      const { count: agentsCount } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })

      // Published agents
      const { count: publishedCount } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('is_published', true)

      // Total conversations
      const { count: conversationsCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })

      // Total messages (user only)
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'user')

      setStats({
        totalUsers: usersCount || 0,
        activeUsers: activeCount || 0,
        totalAgents: agentsCount || 0,
        publishedAgents: publishedCount || 0,
        totalConversations: conversationsCount || 0,
        totalMessages: messagesCount || 0,
      })
    } catch (err) {
      console.error('Error loading stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadChartData = async (days: number) => {
    try {
      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      // Call new dedicated API endpoint
      const response = await fetch(`/api/admin/dashboard/messages?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao carregar dados do gráfico')
      }

      const data = await response.json()
      console.log('📊 [DASHBOARD] Chart data loaded:', {
        total: data.total,
        points: data.messages?.length || 0,
      })

      setChartData(data.messages || [])
    } catch (err) {
      console.error('❌ [DASHBOARD] Error loading chart data:', err)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Visão geral do sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Total Users */}
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#222423', borderColor: '#333333' }}>
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">Total de Usuários</p>
          <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
          <p className="text-xs text-gray-500 mt-2">{stats.activeUsers} ativos</p>
        </div>

        {/* Activation Rate */}
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#222423', borderColor: '#333333' }}>
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">Taxa de Ativação</p>
          <p className="text-3xl font-bold text-[#10b981]">
            {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-500 mt-2">da base</p>
        </div>

        {/* Total Agents */}
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#222423', borderColor: '#333333' }}>
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">Agentes</p>
          <p className="text-3xl font-bold text-white">{stats.totalAgents}</p>
          <p className="text-xs text-gray-500 mt-2">{stats.publishedAgents} publicados</p>
        </div>

        {/* Conversations */}
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#222423', borderColor: '#333333' }}>
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">Conversas</p>
          <p className="text-3xl font-bold text-white">{stats.totalConversations}</p>
          <p className="text-xs text-gray-500 mt-2">total</p>
        </div>

        {/* Total Messages */}
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#222423', borderColor: '#333333' }}>
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">Mensagens</p>
          <p className="text-3xl font-bold text-[#e0521d]">{stats.totalMessages}</p>
          <p className="text-xs text-gray-500 mt-2">trocadas</p>
        </div>

        {/* System Status */}
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#222423', borderColor: '#333333' }}>
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase">Status</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#10b981] rounded-full animate-pulse" />
            <p className="text-sm font-semibold text-[#10b981]">ONLINE</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">sistema OK</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="p-6 rounded-lg" style={{ backgroundColor: '#222423', border: '1px solid #333333' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Mensagens Trocadas</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterDays(7)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition"
              style={{
                backgroundColor: filterDays === 7 ? '#e0521d' : '#333333',
                color: filterDays === 7 ? 'white' : '#999999',
              }}
            >
              Últimos 7 dias
            </button>
            <button
              onClick={() => setFilterDays(30)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition"
              style={{
                backgroundColor: filterDays === 30 ? '#e0521d' : '#333333',
                color: filterDays === 30 ? 'white' : '#999999',
              }}
            >
              Últimos 30 dias
            </button>
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
              <XAxis
                dataKey="date"
                stroke="#999999"
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#999999" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161616',
                  border: '1px solid #333333',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="messages"
                stroke="#e0521d"
                strokeWidth={2}
                dot={{ fill: '#e0521d', r: 4 }}
                activeDot={{ r: 6 }}
                name="Mensagens por dia"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-300 flex items-center justify-center text-gray-500">
            Nenhum dado disponível para este período
          </div>
        )}
      </div>
    </div>
  )
}
