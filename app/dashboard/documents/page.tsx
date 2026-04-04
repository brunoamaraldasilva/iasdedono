'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DocumentsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirecionar para dashboard já que documentos agora são por conversa
    router.push('/dashboard')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#161616' }}>
      <div className="text-center">
        <p className="text-gray-400 mb-4">
          📎 A funcionalidade de documentos foi movida para o chat!
        </p>
        <p className="text-gray-500 text-sm">
          Abra uma conversa e use o botão de anexo para enviar documentos.
        </p>
      </div>
    </div>
  )
}
