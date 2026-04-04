// Document-related types for PHASE 2

export type FileType = 'pdf' | 'csv'
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'error'

export interface Document {
  id: string
  user_id: string

  filename: string
  file_size: number // bytes
  file_type: FileType
  file_path: string

  processing_status: ProcessingStatus
  error_message?: string
  extracted_text?: string

  total_chunks: number
  total_tokens: number

  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string

  chunk_index: number
  content: string
  token_count: number

  metadata?: Record<string, any>
  created_at: string
}

export interface Embedding {
  id: string
  chunk_id: string
  embedding: number[] // 1536 dimensions
  created_at: string
}

// API Response types
export interface DocumentUploadResponse {
  success: boolean
  documentId: string
  status: ProcessingStatus
  message: string
}

export interface DocumentListResponse {
  documents: Document[]
  total: number
}

export interface SimilarChunksResponse {
  chunks: (DocumentChunk & { similarity: number; source: string })[]
  count: number
}
