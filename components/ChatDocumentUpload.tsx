'use client'

import { useRef, useState, useImperativeHandle, forwardRef } from 'react'
import toast from 'react-hot-toast'
import { Paperclip, X } from 'lucide-react'

interface ChatDocumentUploadProps {
  conversationId: string
  disabled?: boolean
}

type FileState = 'idle' | 'validating' | 'uploading' | 'error'

interface PendingFile {
  file: File
  name: string
  id: string
}

export const ChatDocumentUpload = forwardRef<
  { getPendingFiles: () => PendingFile[]; clearPendingFiles: () => void },
  ChatDocumentUploadProps
>(function ChatDocumentUpload({ conversationId, disabled = false }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<FileState>('idle')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useImperativeHandle(ref, () => ({
    getPendingFiles: () => pendingFiles,
    clearPendingFiles: () => setPendingFiles([]),
  }))

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
        error: '❌ PDF, CSV, XLSX ou DOCX',
      }
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `❌ Máx 10MB (seu: ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      }
    }

    return { valid: true }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      const file = files[0]
      const validation = validateFile(file)

      if (!validation.valid) {
        toast.error(validation.error || 'Arquivo inválido')
        return
      }

      // Add to pending files (not uploading yet)
      const newPending: PendingFile = {
        file,
        name: file.name,
        id: crypto.randomUUID(),
      }

      setPendingFiles(prev => [...prev, newPending])

      // Toast outside of setState
      setTimeout(() => {
        toast.success(`${file.name} pronto para enviar`)
      }, 0)

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      setIsOpen(false)
    }
  }

  const handleClick = () => {
    if (disabled || state === 'uploading') return
    inputRef.current?.click()
  }

  const removeFile = (fileId: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const getPendingFiles = () => pendingFiles
  const clearPendingFiles = () => setPendingFiles([])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        onChange={handleChange}
        accept=".pdf,.csv,.xlsx,.xls,.docx,.doc"
        className="hidden"
        disabled={disabled}
      />

      {/* Icon Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title="Anexar documento (PDF ou CSV)"
        className="p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
        style={{
          color: pendingFiles.length > 0 ? '#e0521d' : '#999',
          backgroundColor: 'transparent'
        }}
      >
        <Paperclip size={20} />
        {pendingFiles.length > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
            {pendingFiles.length}
          </span>
        )}
      </button>

      {/* Pending Files List - Dropdown */}
      {pendingFiles.length > 0 && (
        <div
          className="absolute bottom-full right-0 mb-2 p-2 rounded-lg shadow-lg border min-w-max max-w-xs"
          style={{
            backgroundColor: '#222423',
            borderColor: '#444'
          }}
        >
          <div className="text-xs font-semibold text-gray-400 mb-2 px-2">
            📎 Prontos para enviar ({pendingFiles.length})
          </div>
          <div className="space-y-1">
            {pendingFiles.map(file => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded text-xs"
                style={{ backgroundColor: '#161616' }}
              >
                <span className="text-gray-300 truncate flex-1" title={file.name}>
                  📄 {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="text-gray-500 hover:text-red-400 transition flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
