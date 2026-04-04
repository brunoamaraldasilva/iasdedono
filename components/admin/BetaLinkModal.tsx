'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface BetaLinkModalProps {
  agentId: string
  agentName: string
  isOpen: boolean
  onClose: () => void
}

export function BetaLinkModal({
  agentId,
  agentName,
  isOpen,
  onClose,
}: BetaLinkModalProps) {
  const [loading, setLoading] = useState(false)
  const [betaToken, setBetaToken] = useState<string | null>(null)
  const [betaUrl, setBetaUrl] = useState<string | null>(null)

  const handleGenerateBeta = async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/agents/${agentId}/beta`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Erro ao gerar link beta')
      }

      const data = await response.json()
      setBetaToken(data.beta_token)
      setBetaUrl(data.url)

      toast.success('Link beta gerado com sucesso!')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao gerar link beta'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = () => {
    if (!betaUrl) return

    const fullUrl = `${window.location.origin}${betaUrl}`
    navigator.clipboard.writeText(fullUrl)
    toast.success('Link copiado para a área de transferência!')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🧪 Teste Beta: {agentName}
        </h2>
        <p className="text-gray-600 text-sm mb-4">
          Gere um link para testar este agent antes de publicar
        </p>

        {/* Content */}
        {betaUrl ? (
          <>
            {/* Success */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800 mb-3">
                ✓ Link beta gerado com sucesso!
              </p>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    URL:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/beta/${betaToken}`}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded text-xs font-mono"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                  <p className="font-semibold mb-2">💡 Como usar:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Compartilhe este link com testadores</li>
                    <li>As mensagens NÃO são salvas</li>
                    <li>Link expira em 30 dias</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Empty State */}
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  Clique abaixo para gerar um link beta compartilhável. Você
                  poderá testar o agent em um ambiente privado antes de
                  publicar.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {betaUrl && (
            <button
              onClick={() => {
                setBetaUrl(null)
                setBetaToken(null)
              }}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition"
            >
              Novo Link
            </button>
          )}

          {!betaUrl && (
            <button
              onClick={handleGenerateBeta}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Gerando...' : '🚀 Gerar Link'}
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
