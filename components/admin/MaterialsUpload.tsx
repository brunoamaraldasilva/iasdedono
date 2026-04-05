'use client'

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { AgentMaterial } from '@/types/agent'

interface MaterialsUploadProps {
  agentId: string
  onMaterialAdded?: (material: AgentMaterial) => void
  materialType?: 'document' | 'context' | 'resource'
}

type UploadState = 'idle' | 'uploading' | 'extracting' | 'error'

export function MaterialsUpload({
  agentId,
  onMaterialAdded,
  materialType = 'resource',
}: MaterialsUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState('')

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
  ]

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'PDF, CSV, XLSX ou DOCX apenas',
      }
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: 'Máx 10MB (' + (file.size / 1024 / 1024).toFixed(1) + 'MB)',
      }
    }

    return { valid: true }
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const validation = validateFile(file)

    if (!validation.valid) {
      toast.error(validation.error || 'Arquivo inválido')
      return
    }

    await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    setState('uploading')
    setProgress('Enviando arquivo...')

    try {
      const { data: sessionData, error: sessionError } = await (
        await import('@/lib/supabase')
      ).supabase.auth.getSession()

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error('Sessão expirada')
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace(/\.[^/.]+$/, '')) // Remove extension
      formData.append('type', materialType)

      setProgress('Enviando arquivo...')

      const response = await fetch('/api/agents/' + agentId + '/materials/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + sessionData.session.access_token,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao fazer upload')
      }

      setProgress('Extraindo conteúdo...')
      const material: AgentMaterial = await response.json()

      toast.success('Material adicionado com sucesso!')
      setState('idle')
      setProgress('')

      if (onMaterialAdded) {
        onMaterialAdded(material)
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    } catch (err) {
      console.error('Upload error:', err)
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload')
      setState('error')
      setProgress('')
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      const validation = validateFile(file)

      if (!validation.valid) {
        toast.error(validation.error || 'Arquivo inválido')
        return
      }

      await uploadFile(file)
    }
  }

  return (
    <div className="mb-6">
      <div
        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition hover:border-[#e0521d] hover:bg-opacity-5"
        style={{ borderColor: state === 'uploading' ? '#e0521d' : '#333333', backgroundColor: state === 'uploading' ? 'rgba(224, 82, 29, 0.05)' : 'transparent' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !['uploading', 'extracting'].includes(state) && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleChange}
          accept=".pdf,.csv,.xlsx,.xls,.docx,.doc"
          disabled={['uploading', 'extracting'].includes(state)}
          className="hidden"
        />

        {state === 'idle' && (
          <>
            <div className="text-3xl mb-2">📎</div>
            <p className="text-white font-semibold">Arraste arquivo aqui ou clique</p>
            <p className="text-gray-500 text-sm mt-1">PDF, CSV, XLSX ou DOCX (máx 10MB)</p>
          </>
        )}

        {['uploading', 'extracting'].includes(state) && (
          <>
            <div className="inline-block">
              <div className="w-8 h-8 border-4 border-gray-700 border-t-[#e0521d] rounded-full animate-spin" />
            </div>
            <p className="text-white font-semibold mt-3">{progress}</p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-3xl mb-2">❌</div>
            <p className="text-red-400">Erro no upload</p>
          </>
        )}
      </div>
    </div>
  )
}
