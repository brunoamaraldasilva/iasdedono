'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

interface ContextRequiredModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContextRequiredModal({ isOpen, onClose }: ContextRequiredModalProps) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)

  if (!isOpen) return null

  const handleNavigateToContext = async () => {
    setIsNavigating(true)
    onClose()
    await router.push('/dashboard/context')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        style={{ backgroundColor: '#222423' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle size={24} style={{ color: '#e0521d' }} />
          <h2 className="text-xl font-bold text-white">
            Contexto do Negócio Necessário
          </h2>
        </div>

        {/* Message */}
        <p className="text-gray-300 mb-6">
          Para que os assistentes IAs gerem respostas mais precisas e relevantes ao seu negócio,
          é importante que você preencha o contexto do seu negócio.
        </p>

        {/* Benefits List */}
        <div className="mb-6 space-y-2">
          <p className="text-sm text-gray-400 font-semibold">Benefícios:</p>
          <ul className="text-sm text-gray-300 space-y-1 ml-4">
            <li>✓ Respostas personalizadas para sua realidade</li>
            <li>✓ Análises mais precisas do seu negócio</li>
            <li>✓ Recomendações alinhadas com seus objetivos</li>
          </ul>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-gray-300 hover:text-white transition"
            style={{ border: '1px solid #444' }}
          >
            Fechar
          </button>
          <button
            onClick={handleNavigateToContext}
            disabled={isNavigating}
            className="flex-1 px-4 py-2 rounded-lg text-white font-semibold transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#e0521d' }}
          >
            {isNavigating ? 'Carregando...' : 'Ir para Configuração'}
          </button>
        </div>
      </div>
    </div>
  )
}
