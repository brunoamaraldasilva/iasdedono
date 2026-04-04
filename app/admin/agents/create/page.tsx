'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function CreateAgentPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!formData.name || !formData.description || !formData.system_prompt) {
        throw new Error('Preencha todos os campos obrigatórios')
      }

      // Get auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session?.access_token) {
        throw new Error('Session expired')
      }

      const response = await fetch('/api/admin/agents/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar agent')
      }

      const { data } = await response.json()

      toast.success('Agent criado com sucesso!')
      router.push(`/admin/agents/${data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar agent')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-3xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Novo Agent</h1>
          <p className="text-gray-400">Crie um novo agent/persona personalizado</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-white mb-2"
            >
              Nome do Agent *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Analista de Dados"
              required
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-[#e0521d] outline-none transition text-white"
              style={{ backgroundColor: '#222423', borderColor: '#333333', border: '1px solid' }}
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-semibold text-white mb-2"
            >
              Descrição *
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Breve descrição do que este agent faz"
              required
              className="w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-[#e0521d] outline-none transition text-white"
              style={{ backgroundColor: '#222423', borderColor: '#333333', border: '1px solid' }}
            />
          </div>

          {/* System Prompt */}
          <div>
            <label
              htmlFor="system_prompt"
              className="block text-sm font-semibold text-white mb-2"
            >
              System Prompt *
            </label>
            <textarea
              id="system_prompt"
              name="system_prompt"
              value={formData.system_prompt}
              onChange={handleChange}
              placeholder="Instruções detalhadas para o agent (como deve se comportar, qual sua expertise, etc)"
              rows={8}
              required
              className="w-full px-4 py-3 rounded-lg focus:ring-2 focus:ring-[#e0521d] outline-none transition resize-none font-mono text-sm text-white"
              style={{ backgroundColor: '#222423', borderColor: '#333333', border: '1px solid' }}
            />
            <p className="text-xs text-gray-400 mt-2">
              Quanto mais detalhado, melhor será a resposta do agent
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid #333333' }}>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#e0521d' }}
            >
              {loading ? 'Criando...' : 'Criar Agent'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 font-semibold py-3 rounded-lg transition text-white hover:brightness-110"
              style={{ backgroundColor: '#333333' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
