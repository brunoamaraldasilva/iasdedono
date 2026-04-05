'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

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
      // Get session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.')
      }

      const response = await fetch(`/api/agents/${agentId}/beta`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao gerar link beta')
      }

      const data = await response.json()
      setBetaToken(data.beta_token)
      setBetaUrl(data.url)

      toast.success('Link beta gerado com sucesso!')
    } catch (err) {
      console.error('Beta link error:', err)
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
      <div className="rounded-lg shadow-lg max-w-md w-full mx-4 p-6" style={{ backgroundColor: '#222423', border: '1px solid #333333' }}>
        {/* Header */}
        <h2 className="text-2xl font-bold text-white mb-2">
          🧪 Teste Beta: {agentName}
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Gere um link para testar este agent antes de publicar
        </p>

        {/* Content */}
        {betaUrl ? (
          <>
            {/* Success */}
            <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: '#1a4d2e', border: '1px solid #2d7a4a' }}>
              <p className="text-sm text-green-200 mb-3">
                ✓ Link beta gerado com sucesso!
              </p>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-2">
                    URL:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/beta/${betaToken}`}
                      className="flex-1 px-3 py-2 rounded text-xs font-mono text-white"
                      style={{ backgroundColor: '#161616', border: '1px solid #333333' }}
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 text-white text-xs font-semibold rounded transition hover:opacity-80"
                      style={{ backgroundColor: '#e0521d' }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="rounded p-3 text-xs text-blue-200" style={{ backgroundColor: '#1a3a52', border: '1px solid #2d5a7a' }}>
                  <p className="font-semibold mb-2">💡 Como usar:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Compartilhe este link com testadores</li>
                    <li>As mensagens NÃO são salvas</li>
                    <li>Link expira em 24 horas</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Empty State */}
            <div className="mb-6">
              <div className="rounded-lg p-4 mb-4 text-blue-200" style={{ backgroundColor: '#1a3a52', border: '1px solid #2d5a7a' }}>
                <p className="text-sm">
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
              className="flex-1 px-4 py-2 text-white font-semibold rounded-lg transition hover:opacity-80"
              style={{ backgroundColor: '#333333' }}
            >
              Novo Link
            </button>
          )}

          {!betaUrl && (
            <button
              onClick={handleGenerateBeta}
              disabled={loading}
              className="flex-1 px-4 py-2 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: '#e0521d' }}
            >
              {loading ? 'Gerando...' : '🚀 Gerar Link'}
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-white font-semibold rounded-lg transition hover:opacity-80"
            style={{ backgroundColor: '#333333' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
