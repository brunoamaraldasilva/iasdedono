'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { BetaLinkModal } from '@/components/admin/BetaLinkModal'
import { MaterialsUpload } from '@/components/admin/MaterialsUpload'
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
  const [newStarter, setNewStarter] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    conversation_starters: [] as string[],
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
        conversation_starters: agentData.conversation_starters || [],
      })

      // Load materials via API (uses admin client to bypass RLS)
      const materialsResponse = await fetch(`/api/agents/${id}/materials`)
      if (!materialsResponse.ok) {
        throw new Error('Failed to load materials')
      }
      const materialsData = await materialsResponse.json()
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

  const handleAddStarter = () => {
    if (!newStarter.trim()) {
      toast.error('Digite algo para adicionar')
      return
    }
    if (formData.conversation_starters.includes(newStarter.trim())) {
      toast.error('Esta sugestão já existe')
      return
    }
    setFormData((prev) => ({
      ...prev,
      conversation_starters: [...prev.conversation_starters, newStarter.trim()],
    }))
    setNewStarter('')
  }

  const handleRemoveStarter = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conversation_starters: prev.conversation_starters.filter((_, i) => i !== index),
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


  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('Deseja deletar este material?')) return

    try {
      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      // Call delete endpoint (uses admin client to bypass RLS)
      const response = await fetch(`/api/agents/${id}/materials/${materialId}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar material')
      }

      toast.success('Material removido!')
      setMaterials((prev) => prev.filter((m) => m.id !== materialId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar')
    }
  }

  const handleMaterialAdded = (material: AgentMaterial) => {
    setMaterials((prev) => [material, ...prev])
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

            {/* Conversation Starters */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Sugestões de Conversa
              </label>
              <div className="space-y-3">
                {/* Input para novo starter */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newStarter}
                    onChange={(e) => setNewStarter(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddStarter()
                      }
                    }}
                    placeholder="Ex: Como aumentar minhas vendas?"
                    className="flex-1 px-4 py-2 rounded-lg focus:ring-2 focus:ring-[#e0521d] outline-none transition text-white"
                    style={{ backgroundColor: '#161616', border: '1px solid #333333' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddStarter}
                    className="px-4 py-2 rounded-lg font-semibold text-white transition hover:opacity-90"
                    style={{ backgroundColor: '#e0521d' }}
                  >
                    Adicionar
                  </button>
                </div>

                {/* Lista de starters */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {formData.conversation_starters.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhuma sugestão adicionada</p>
                  ) : (
                    formData.conversation_starters.map((starter, index) => (
                      <div
                        key={index}
                        className="flex items-start justify-between p-3 rounded-lg"
                        style={{ backgroundColor: '#161616', border: '1px solid #333333' }}
                      >
                        <p className="text-sm text-white flex-1">{starter}</p>
                        <button
                          type="button"
                          onClick={() => handleRemoveStarter(index)}
                          className="ml-2 text-gray-400 hover:text-[#e0521d] transition font-semibold"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
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

          {/* Upload Files */}
          <div className="mb-6">
            <h3 className="font-semibold text-white mb-3">Anexar Arquivo</h3>
            <MaterialsUpload
              agentId={id}
              onMaterialAdded={handleMaterialAdded}
              materialType="resource"
            />
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
                    <div className="flex items-center gap-2">
                      {material.is_file_based && (
                        <span className="text-lg">📄</span>
                      )}
                      <p className="font-semibold text-white">{material.title}</p>
                    </div>
                    {material.is_file_based && material.file_size && (
                      <p className="text-xs text-gray-500 mt-1">
                        {material.file_type?.toUpperCase()} • {(material.file_size / 1024).toFixed(1)}KB
                      </p>
                    )}
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
