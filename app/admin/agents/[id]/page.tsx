'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BetaLinkModal } from '@/components/admin/BetaLinkModal'
import toast from 'react-hot-toast'
import type { Agent, AgentMaterial } from '@/types/agent'

interface EditAgentPageProps {
  params: Promise<{
    id: string
  }>
}

export default function EditAgentPage({ params }: EditAgentPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [materials, setMaterials] = useState<AgentMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
  })
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    content: '',
    type: 'context' as const,
  })
  const [showBetaModal, setShowBetaModal] = useState(false)

  useEffect(() => {
    loadAgent()
  }, [])

  const loadAgent = async () => {
    try {
      setLoading(true)

      // Load agent
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', id)
        .single()

      if (agentError) throw agentError

      setAgent(agentData)
      setFormData({
        name: agentData.name,
        description: agentData.description,
        system_prompt: agentData.system_prompt,
      })

      // Load materials
      const { data: materialsData, error: materialsError } = await supabase
        .from('agent_materials')
        .select('*')
        .eq('agent_id', id)
        .order('order', { ascending: true })

      if (materialsError) throw materialsError

      setMaterials(materialsData || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar agent')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSaveAgent = async () => {
    setSaving(true)

    try {
      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      const response = await fetch('/api/admin/agents/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          agentId: id,
          ...formData,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar')
      }

      toast.success('Agent atualizado com sucesso!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMaterial = async () => {
    if (!newMaterial.title || !newMaterial.content) {
      toast.error('Preencha título e conteúdo')
      return
    }

    try {
      const { error } = await supabase
        .from('agent_materials')
        .insert([
          {
            agent_id: id,
            ...newMaterial,
            order: materials.length,
          },
        ])

      if (error) throw error

      toast.success('Material adicionado!')
      setNewMaterial({ title: '', content: '', type: 'context' })
      await loadAgent()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar')
    }
  }

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('Deseja deletar este material?')) return

    try {
      const { error } = await supabase
        .from('agent_materials')
        .delete()
        .eq('id', materialId)

      if (error) throw error

      toast.success('Material removido!')
      setMaterials((prev) => prev.filter((m) => m.id !== materialId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar')
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-600">Agent não encontrado</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Editar Agent: {agent.name}
          </h1>
        </div>

        {/* Agent Details */}
        <div className="rounded-lg shadow-sm p-6 mb-8" style={{ backgroundColor: '#222423', border: '1px solid #333333' }}>
          <h2 className="text-xl font-bold text-white mb-4">Detalhes</h2>

          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Nome
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-[#e0521d] outline-none transition text-white"
                style={{ backgroundColor: '#161616', border: '1px solid #333333' }}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Descrição
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-[#e0521d] outline-none transition text-white"
                style={{ backgroundColor: '#161616', border: '1px solid #333333' }}
              />
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                System Prompt
              </label>
              <textarea
                name="system_prompt"
                value={formData.system_prompt}
                onChange={handleChange}
                rows={6}
                className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-[#e0521d] outline-none transition resize-none font-mono text-sm text-white"
                style={{ backgroundColor: '#161616', border: '1px solid #333333' }}
              />
            </div>

            {/* Save */}
            <button
              onClick={handleSaveAgent}
              disabled={saving}
              className="w-full text-white font-semibold py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#e0521d' }}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Materials */}
        <div className="rounded-lg shadow-sm p-6" style={{ backgroundColor: '#222423', border: '1px solid #333333' }}>
          <h2 className="text-xl font-bold text-white mb-4">Materiais</h2>

          {/* Add Material */}
          <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#161616', border: '1px solid #333333' }}>
            <h3 className="font-semibold text-white mb-3">Adicionar Material</h3>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Título"
                value={newMaterial.title}
                onChange={(e) =>
                  setNewMaterial((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-[#e0521d] outline-none transition"
                style={{ backgroundColor: '#222423', border: '1px solid #333333' }}
              />

              <textarea
                placeholder="Conteúdo"
                value={newMaterial.content}
                onChange={(e) =>
                  setNewMaterial((prev) => ({ ...prev, content: e.target.value }))
                }
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-[#e0521d] outline-none transition resize-none"
                style={{ backgroundColor: '#222423', border: '1px solid #333333' }}
              />

              <select
                value={newMaterial.type}
                onChange={(e) =>
                  setNewMaterial((prev) => ({
                    ...prev,
                    type: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg text-sm text-white focus:ring-2 focus:ring-[#e0521d] outline-none transition"
                style={{ backgroundColor: '#222423', border: '1px solid #333333' }}
              >
                <option value="context">Contexto</option>
                <option value="document">Documento</option>
                <option value="resource">Recurso</option>
              </select>

              <button
                onClick={handleAddMaterial}
                className="w-full text-white font-semibold py-2 rounded-lg transition hover:opacity-80"
                style={{ backgroundColor: '#e0521d' }}
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* Materials List */}
          <div className="space-y-3">
            {materials.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum material adicionado</p>
            ) : (
              materials.map((material) => (
                <div
                  key={material.id}
                  className="p-4 rounded-lg flex items-start justify-between"
                  style={{ backgroundColor: '#161616', border: '1px solid #333333' }}
                >
                  <div className="flex-1">
                    <p className="font-semibold text-white">{material.title}</p>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                      {material.content}
                    </p>
                    <span className="inline-block mt-2 px-2 py-1 text-xs rounded text-white" style={{ backgroundColor: '#333333' }}>
                      {material.type}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteMaterial(material.id)}
                    className="ml-4 text-gray-400 hover:text-[#e0521d] transition font-semibold text-lg"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Beta Link Modal */}
        <BetaLinkModal
          agentId={id}
          agentName={agent.name}
          isOpen={showBetaModal}
          onClose={() => setShowBetaModal(false)}
        />
      </div>

      {/* Beta Button */}
      <button
        onClick={() => setShowBetaModal(true)}
        className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-16 h-16 flex items-center justify-center text-2xl shadow-lg transition"
        title="Gerar link beta para teste"
      >
        🧪
      </button>
    </div>
  )
}
