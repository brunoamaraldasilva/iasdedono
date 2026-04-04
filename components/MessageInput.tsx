'use client'

import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'
import { ChatDocumentUpload } from './ChatDocumentUpload'
import { supabase } from '@/lib/supabase'

interface MessageInputProps {
  onSendMessage: (message: string, documentIds?: string[], documentNames?: string[], useWebSearch?: boolean) => void
  disabled?: boolean
  loading?: boolean
  conversationId?: string
}

export function MessageInput({
  onSendMessage,
  disabled = false,
  loading = false,
  conversationId,
}: MessageInputProps) {
  const [input, setInput] = useState('')
  const [isProcessingDocs, setIsProcessingDocs] = useState(false)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const uploadRef = useRef<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || disabled || loading || isProcessingDocs) return

    try {
      setIsProcessingDocs(true)

      // Get pending files from upload component
      const pendingFiles = uploadRef.current?.getPendingFiles() || []
      let documentIds: string[] = []
      let documentNames: string[] = []

      // Upload and process each file
      if (pendingFiles.length > 0) {
        toast.loading(`Processando ${pendingFiles.length} arquivo(s)...`)

        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        if (!token) {
          throw new Error('Sessão expirada')
        }

        for (const pendingFile of pendingFiles) {
          const formData = new FormData()
          formData.append('file', pendingFile.file)
          formData.append('conversationId', conversationId || '')

          // Upload file
          const uploadRes = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!uploadRes.ok) {
            const error = await uploadRes.json()
            throw new Error(error.error || 'Upload failed')
          }

          const { documentId } = await uploadRes.json()
          documentIds.push(documentId)
          documentNames.push(pendingFile.name)
          console.log('Document uploaded:', documentId, pendingFile.name)
        }

        // Clear uploaded files
        uploadRef.current?.clearPendingFiles()
      }

      // Send message with document IDs, names, and web search flag
      onSendMessage(
        input.trim(),
        documentIds.length > 0 ? documentIds : undefined,
        documentNames.length > 0 ? documentNames : undefined,
        useWebSearch
      )
      setInput('')

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      toast.dismiss()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar documentos'
      toast.error(msg)
      console.error('Submit error:', err)
    } finally {
      setIsProcessingDocs(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(
        textareaRef.current.scrollHeight,
        120
      )
      textareaRef.current.style.height = `${newHeight}px`
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t p-3 md:p-4 rounded-lg flex-shrink-0"
      style={{ borderColor: '#333333', backgroundColor: '#222423' }}
    >
      <div className="flex gap-2 md:gap-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          rows={1}
          className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base text-white rounded-lg resize-none focus:ring-2 focus:ring-[#e0521d] focus:border-transparent outline-none disabled:cursor-not-allowed transition min-h-10"
          style={{ borderColor: '#161616', backgroundColor: '#161616' }}
          placeholder="Pergunte algo..."
        />

        <div className="flex gap-2 items-end">
          {conversationId && (
            <ChatDocumentUpload
              ref={uploadRef}
              conversationId={conversationId}
              disabled={disabled || loading || isProcessingDocs}
            />
          )}

          <button
            type="button"
            onClick={() => setUseWebSearch(!useWebSearch)}
            disabled={disabled || loading}
            className="p-2 md:p-3 rounded-lg transition hover:bg-opacity-80 flex items-center justify-center min-h-10 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: useWebSearch ? '#e0521d' : '#333333',
              color: useWebSearch ? 'white' : '#999999'
            }}
            title={useWebSearch ? 'Desativar busca na web' : 'Ativar busca na web'}
          >
            <Search size={20} />
          </button>

          <button
            type="submit"
            disabled={disabled || loading || isProcessingDocs || !input.trim()}
            className="text-white px-3 md:px-6 py-2 md:py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-10 font-semibold text-sm md:text-base"
            style={{ backgroundColor: '#e0521d' }}
          >
            {loading || isProcessingDocs ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Enviar</span>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
