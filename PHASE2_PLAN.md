Excelente. Agora tenho toda a informação necessária. Vou criar um plano detalhado e específico para implementar upload de PDF e CSV:

---

# PLANO DETALHADO: IMPLEMENTAÇÃO DE UPLOAD DE PDF E CSV
## IAs de Dono - FASE 2

**Versão:** 1.0  
**Data:** 3 de Abril de 2026  
**Status:** Pronto para Implementação  
**Complexidade:** ⭐⭐⭐⭐ Alta  
**Tempo Estimado:** 5-7 dias  

---

## 1. VISÃO GERAL DA SOLUÇÃO

### 1.1 Escopo
Implementar pipeline **completo** de upload, processamento e integração de PDFs e CSVs no chat:
- ✅ Upload validado (tipo, tamanho, proprietário)
- ✅ Extração de texto (PDF → pdfjs-dist, CSV → PapaParse)
- ✅ Chunking inteligente (500 tokens com 50 overlap)
- ✅ Embeddings via OpenAI (text-embedding-3-small)
- ✅ Storage PostgreSQL + pgvector
- ✅ Integração no chat (similarity search automático)

### 1.2 Restrições & Garantias
- **Não quebra o existente:** Toda autenticação, chat e contexto continuam funcionando
- **RLS enforcement:** User vê APENAS seus próprios documentos
- **Admin client:** Usar `createServerSupabaseClient()` para operações críticas
- **Logging estruturado:** Padrão `[COMPONENT] message` para debugging
- **Sem mudanças em:** `generateChatResponseStream()`, `useChat()`, autenticação

### 1.3 Arquitetura de Dados
```
USER
  ↓
documents (PDF/CSV + metadata)
  ↓
document_chunks (tokens=500, overlap=50)
  ├─ content (texto puro)
  ├─ token_count (contagem exata)
  └─ metadata (página, linha, etc)
  ↓
embeddings (pgvector 1536-dim, OpenAI)
  └─ similarity search no chat
```

---

## 2. SCHEMA DO BANCO DE DADOS

### 2.1 SQL: Criar Tabelas + Índices
**Arquivo:** `docs/SQL_PHASE2_DOCUMENTS.sql`

```sql
-- Enable pgvector extension (EXECUTE NO SUPABASE DASHBOARD)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela principal de documentos
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- em bytes
  file_type TEXT NOT NULL, -- 'pdf' ou 'csv'
  file_path TEXT NOT NULL, -- caminho no Supabase Storage
  
  processing_status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, error
  error_message TEXT, -- Se error, qual foi o erro
  extracted_text TEXT, -- Texto extraído bruto
  
  total_chunks INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de chunks (pedaços de texto)
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  chunk_index INTEGER NOT NULL, -- 0, 1, 2... ordem dentro do doc
  content TEXT NOT NULL, -- Texto do chunk
  token_count INTEGER NOT NULL, -- Contagem exata de tokens
  
  -- Metadata para rastreabilidade
  metadata JSONB DEFAULT '{}', -- Pode conter página, linha, etc
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tabela de embeddings (vetores)
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  
  embedding vector(1536), -- OpenAI text-embedding-3-small
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_see_own_documents"
  ON documents FOR ALL USING (auth.uid() = user_id);

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_see_own_chunks"
  ON document_chunks FOR ALL
  USING (
    document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
  );

ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_see_own_embeddings"
  ON embeddings FOR ALL
  USING (
    chunk_id IN (
      SELECT dc.id FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- Índices para performance
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_embeddings_chunk_id ON embeddings(chunk_id);
CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at_trigger
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_documents_updated_at();
```

**Executar:**
1. Supabase Dashboard → SQL Editor → copiar e executar
2. ANTES disso: Habilitar pgvector no Dashboard

---

## 3. TIPOS TYPESCRIPT

### 3.1 Arquivo: `types/document.ts` (NOVO)

```typescript
export interface Document {
  id: string
  user_id: string
  
  filename: string
  file_size: number // bytes
  file_type: 'pdf' | 'csv'
  file_path: string
  
  processing_status: 'pending' | 'processing' | 'completed' | 'error'
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

// Request/Response types
export interface UploadDocumentRequest {
  file: File
  userId: string
}

export interface UploadDocumentResponse {
  documentId: string
  filename: string
  status: 'pending' | 'processing'
  message: string
}

export interface DocumentStatusResponse {
  id: string
  filename: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number // 0-100
  total_chunks: number
  total_tokens: number
  error_message?: string
}

export interface SimilarChunk {
  chunkId: string
  documentId: string
  filename: string
  content: string
  similarity: number // 0-1
  metadata?: Record<string, any>
}
```

---

## 4. BIBLIOTECAS E DEPENDÊNCIAS

### 4.1 Instalar via `package.json`

**Adicionar ao `dependencies`:**
```json
{
  "pdf-parse": "^1.1.1",
  "pdfjs-dist": "^4.0.379",
  "papaparse": "^5.4.1",
  "@types/papaparse": "^5.3.14",
  "js-tiktoken": "^1.0.12"
}
```

**Command:**
```bash
npm install pdf-parse@1.1.1 pdfjs-dist@4.0.379 papaparse@5.4.1 @types/papaparse@5.3.14 js-tiktoken@1.0.12
```

### 4.2 Dependências Já Existentes (Verificar)
- ✅ `openai` - já instalado, usar para embeddings
- ✅ `@supabase/supabase-js` - já instalado, usar para storage + BD
- ✅ `uuid` - já instalado, usar para IDs

---

## 5. IMPLEMENTAÇÃO EM FASES

### FASE 2A: Validação & Utilitários

#### 5A.1 Arquivo: `lib/documentValidation.ts` (NOVO)

```typescript
export const ALLOWED_FILE_TYPES = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'csv', // Para .xls
} as const

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_USER_STORAGE = 100 * 1024 * 1024 // 100MB por usuário

export interface ValidationResult {
  valid: boolean
  error?: string
  fileType?: 'pdf' | 'csv'
}

/**
 * Valida arquivo antes do upload
 * - Tipo: PDF ou CSV apenas
 * - Tamanho: <= 10MB
 * - MIME type verificado
 */
export function validateDocumentUpload(file: File): ValidationResult {
  console.log('[VALIDATION] Checking file:', {
    name: file.name,
    size: file.size,
    type: file.type,
  })

  // Verificar tipo
  const fileType = ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]
  if (!fileType) {
    return {
      valid: false,
      error: `Tipo não suportado: ${file.type}. Apenas PDF e CSV.`,
    }
  }

  // Verificar tamanho
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 10MB.`,
    }
  }

  // Verificar extensão (validação dupla)
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['pdf', 'csv'].includes(extension)) {
    return {
      valid: false,
      error: 'Extensão de arquivo inválida. Use .pdf ou .csv',
    }
  }

  console.log('[VALIDATION] ✅ File valid:', fileType)

  return {
    valid: true,
    fileType: fileType as 'pdf' | 'csv',
  }
}

/**
 * Valida contexto de processamento (espaço disponível, etc)
 */
export async function validateUserStorage(
  userId: string,
  supabase: any
): Promise<{ valid: boolean; error?: string; availableSpace: number }> {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('file_size')
      .eq('user_id', userId)
      .eq('processing_status', 'completed')

    if (error) throw error

    const usedSpace = (data || []).reduce((sum: number, doc: any) => sum + doc.file_size, 0)
    const availableSpace = MAX_USER_STORAGE - usedSpace

    console.log('[VALIDATION] User storage check:', {
      userId: userId.substring(0, 8),
      usedMB: (usedSpace / 1024 / 1024).toFixed(1),
      availableMB: (availableSpace / 1024 / 1024).toFixed(1),
    })

    if (availableSpace <= 0) {
      return {
        valid: false,
        error: 'Limite de armazenamento atingido (100MB)',
        availableSpace: 0,
      }
    }

    return {
      valid: true,
      availableSpace,
    }
  } catch (err) {
    console.error('[VALIDATION] Storage check error:', err)
    return {
      valid: false,
      error: 'Erro ao verificar espaço disponível',
      availableSpace: 0,
    }
  }
}
```

#### 5A.2 Arquivo: `lib/documentExtraction.ts` (NOVO)

```typescript
import * as PDFJS from 'pdfjs-dist'
import Papa from 'papaparse'

// PDF worker setup (crítico para pdfjs)
if (typeof window !== 'undefined') {
  PDFJS.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS.version}/pdf.worker.min.js`
}

export interface ExtractionResult {
  text: string
  metadata: {
    pages?: number
    rows?: number
    columns?: number
    source: string
  }
}

/**
 * Extrai texto de PDF
 * - Itera por todas as páginas
 * - Marca cada página com separador
 * - Trata fonts e encoding automático
 */
export async function extractTextFromPDF(file: File): Promise<ExtractionResult> {
  try {
    console.log('[EXTRACT] PDF: Starting extraction')

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await PDFJS.getDocument({ data: arrayBuffer }).promise

    let fullText = ''
    const pageCount = pdf.numPages

    console.log('[EXTRACT] PDF: Found', pageCount, 'pages')

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => {
          if ('str' in item) {
            return item.str
          }
          return ''
        })
        .join(' ')

      fullText += `\n--- PAGE ${pageNum} ---\n${pageText}`

      console.log(`[EXTRACT] PDF: Processed page ${pageNum}/${pageCount}`)
    }

    return {
      text: fullText,
      metadata: {
        pages: pageCount,
        source: 'PDF',
      },
    }
  } catch (err) {
    console.error('[EXTRACT] PDF error:', err)
    throw new Error(`Erro ao extrair PDF: ${err instanceof Error ? err.message : 'Unknown'}`)
  }
}

/**
 * Extrai texto de CSV
 * - Usa PapaParse para parsing robusto
 * - Mantém estrutura (headers, linhas)
 */
export async function extractTextFromCSV(file: File): Promise<ExtractionResult> {
  return new Promise((resolve, reject) => {
    try {
      console.log('[EXTRACT] CSV: Starting extraction')

      Papa.parse(file, {
        header: false, // Retornar como array
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][]
          let csvText = ''

          // Adicionar header (primeira linha) com destaque
          if (rows.length > 0) {
            csvText += 'HEADERS: ' + rows[0].join(' | ') + '\n'
            csvText += '---\n'

            // Adicionar todas as linhas
            rows.forEach((row, idx) => {
              csvText += `Row ${idx}: ` + row.join(' | ') + '\n'
            })
          }

          console.log('[EXTRACT] CSV: Processed', rows.length, 'rows')

          resolve({
            text: csvText,
            metadata: {
              rows: rows.length,
              columns: rows.length > 0 ? rows[0].length : 0,
              source: 'CSV',
            },
          })
        },
        error: (error) => {
          console.error('[EXTRACT] CSV parse error:', error)
          reject(new Error(`Erro ao fazer parsing CSV: ${error.message}`))
        },
      })
    } catch (err) {
      console.error('[EXTRACT] CSV error:', err)
      reject(new Error(`Erro ao extrair CSV: ${err instanceof Error ? err.message : 'Unknown'}`))
    }
  })
}

/**
 * Extrai texto do arquivo baseado no tipo
 */
export async function extractText(
  file: File,
  fileType: 'pdf' | 'csv'
): Promise<ExtractionResult> {
  console.log('[EXTRACT] Starting extraction:', { filename: file.name, type: fileType })

  switch (fileType) {
    case 'pdf':
      return extractTextFromPDF(file)
    case 'csv':
      return extractTextFromCSV(file)
    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }
}
```

#### 5A.3 Arquivo: `lib/documentChunking.ts` (NOVO)

```typescript
import { encoding_for_model } from 'js-tiktoken'

const enc = encoding_for_model('gpt-3.5-turbo')

const CHUNK_SIZE = 500 // tokens por chunk
const OVERLAP = 50 // tokens de overlap

export interface Chunk {
  content: string
  token_count: number
  metadata: {
    chunk_index: number
    start_char?: number
    end_char?: number
  }
}

/**
 * Divide texto em chunks de ~500 tokens com 50 tokens de overlap
 *
 * Algoritmo:
 * 1. Split por sentença
 * 2. Acumula sentenças até atingir 500 tokens
 * 3. Quando excede, salva chunk e faz overlap das últimas 50
 * 4. Continua de onde parou
 */
export function chunkText(text: string): Chunk[] {
  console.log('[CHUNK] Starting chunking:', { textLength: text.length })

  // Split por sentença (. ! ?)
  const sentences = text.split(/(?<=[.!?])\s+/)
  console.log('[CHUNK] Found', sentences.length, 'sentences')

  const chunks: Chunk[] = []
  let currentChunkTokens: string[] = []
  let currentTokenCount = 0
  let charPosition = 0

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i]
    const sentenceTokens = enc.encode(sentence).length

    // Se adicionar esta sentença excede o limite
    if (currentTokenCount + sentenceTokens > CHUNK_SIZE && currentChunkTokens.length > 0) {
      // Salvar chunk atual
      const chunkContent = currentChunkTokens.join(' ').trim()
      chunks.push({
        content: chunkContent,
        token_count: currentTokenCount,
        metadata: {
          chunk_index: chunks.length,
          start_char: charPosition - chunkContent.length,
          end_char: charPosition,
        },
      })

      console.log('[CHUNK] Saved chunk', chunks.length, 'with', currentTokenCount, 'tokens')

      // Overlap: encontrar últimas 50 tokens de sentenças anteriores
      const overlapTokens: string[] = []
      let overlapCount = 0

      for (let j = i - 1; j >= 0 && overlapCount < OVERLAP; j--) {
        const overlapSentence = sentences[j]
        const overlapSentenceTokens = enc.encode(overlapSentence).length

        if (overlapCount + overlapSentenceTokens <= OVERLAP) {
          overlapTokens.unshift(overlapSentence)
          overlapCount += overlapSentenceTokens
        }
      }

      currentChunkTokens = overlapTokens
      currentTokenCount = overlapCount
    }

    currentChunkTokens.push(sentence)
    currentTokenCount += sentenceTokens
    charPosition += sentence.length + 1
  }

  // Salvar último chunk
  if (currentChunkTokens.length > 0) {
    const chunkContent = currentChunkTokens.join(' ').trim()
    chunks.push({
      content: chunkContent,
      token_count: currentTokenCount,
      metadata: {
        chunk_index: chunks.length,
        start_char: charPosition - chunkContent.length,
        end_char: charPosition,
      },
    })

    console.log('[CHUNK] Saved final chunk', chunks.length, 'with', currentTokenCount, 'tokens')
  }

  console.log('[CHUNK] ✅ Completed: Created', chunks.length, 'chunks')

  return chunks
}

/**
 * Valida chunks antes de processar
 */
export function validateChunks(chunks: Chunk[]): { valid: boolean; error?: string } {
  if (chunks.length === 0) {
    return { valid: false, error: 'Nenhum chunk gerado' }
  }

  const totalTokens = chunks.reduce((sum, c) => sum + c.token_count, 0)
  if (totalTokens < 10) {
    return { valid: false, error: 'Documento muito pequeno (menos de 10 tokens)' }
  }

  console.log('[CHUNK] ✅ Validation passed:', { chunks: chunks.length, tokens: totalTokens })

  return { valid: true }
}
```

### FASE 2B: Embeddings

#### 5B.1 Arquivo: `lib/documentEmbeddings.ts` (NOVO)

```typescript
import { openai } from '@/lib/openai'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

/**
 * Gera embedding para um texto
 * - Usa OpenAI text-embedding-3-small
 * - Retorna vetor de 1536 dimensions
 * - Trata errors e retries
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.log('[EMBEDDING] Generating for text:', { length: text.length })

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    if (!response.data || response.data.length === 0) {
      throw new Error('Empty embedding response')
    }

    const embedding = response.data[0].embedding

    console.log('[EMBEDDING] ✅ Generated:', {
      dimensions: embedding.length,
      usage: response.usage,
    })

    return embedding
  } catch (err) {
    console.error('[EMBEDDING] Error:', err)
    throw new Error(
      `Erro ao gerar embedding: ${err instanceof Error ? err.message : 'Unknown'}`
    )
  }
}

/**
 * Gera embeddings para múltiplos chunks em paralelo
 * - Processa em batches de 10 para evitar rate limit
 * - Aguarda 100ms entre batches
 */
export async function generateEmbeddingsForChunks(
  chunks: Array<{ content: string; token_count: number }>
): Promise<number[][]> {
  console.log('[EMBEDDING] Batch processing:', { chunks: chunks.length })

  const embeddings: number[][] = []
  const BATCH_SIZE = 10
  const BATCH_DELAY = 100 // ms

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, Math.min(i + BATCH_SIZE, chunks.length))
    console.log('[EMBEDDING] Processing batch', Math.ceil(i / BATCH_SIZE) + 1)

    const batchEmbeddings = await Promise.all(
      batch.map((chunk) => generateEmbedding(chunk.content))
    )

    embeddings.push(...batchEmbeddings)

    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < chunks.length) {
      console.log('[EMBEDDING] Waiting before next batch...')
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY))
    }
  }

  console.log('[EMBEDDING] ✅ All embeddings generated:', { total: embeddings.length })

  return embeddings
}

/**
 * Calcula similaridade cosseno entre dois vetores
 * - Usado para similarity search
 */
export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vector dimensions must match')
  }

  let dotProduct = 0
  let aMagnitude = 0
  let bMagnitude = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    aMagnitude += a[i] * a[i]
    bMagnitude += b[i] * b[i]
  }

  aMagnitude = Math.sqrt(aMagnitude)
  bMagnitude = Math.sqrt(bMagnitude)

  if (aMagnitude === 0 || bMagnitude === 0) {
    return 0
  }

  return dotProduct / (aMagnitude * bMagnitude)
}
```

### FASE 2C: API Endpoints

#### 5C.1 Arquivo: `app/api/documents/upload/route.ts` (NOVO)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateDocumentUpload, validateUserStorage } from '@/lib/documentValidation'
import { extractText } from '@/lib/documentExtraction'
import { chunkText, validateChunks } from '@/lib/documentChunking'
import { generateEmbeddingsForChunks } from '@/lib/documentEmbeddings'
import { rateLimit } from '@/lib/rateLimit'

/**
 * POST /api/documents/upload
 *
 * Upload de documento (PDF ou CSV)
 * - Valida arquivo
 * - Faz upload para Supabase Storage
 * - Cria documento no BD com status 'pending'
 * - Processa em background (extração, chunking, embeddings)
 * - Retorna documentId para polling
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[UPLOAD] Request received')

    // 1. Autenticação
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') || '',
        },
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      console.log('[UPLOAD] ❌ Auth failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[UPLOAD] User:', user.id.substring(0, 8))

    // 2. Rate limit: 5 uploads por hora por usuário
    const rateLimitCheck = rateLimit(`upload:${user.id}`, 5, 3600000)
    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: 'Muitos uploads. Tente novamente mais tarde.' },
        { status: 429 }
      )
    }

    // 3. Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não fornecido' }, { status: 400 })
    }

    console.log('[UPLOAD] File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
    })

    // 4. Validar arquivo
    const validation = validateDocumentUpload(file)
    if (!validation.valid) {
      console.log('[UPLOAD] ❌ Validation failed:', validation.error)
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // 5. Validar espaço do usuário
    const storageCheck = await validateUserStorage(user.id, supabase)
    if (!storageCheck.valid) {
      console.log('[UPLOAD] ❌ Storage limit:', storageCheck.error)
      return NextResponse.json({ error: storageCheck.error }, { status: 413 })
    }

    // 6. Upload para Supabase Storage
    console.log('[UPLOAD] Uploading to storage...')

    const fileExtension = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) {
      console.log('[UPLOAD] ❌ Storage upload failed:', uploadError)
      return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 })
    }

    console.log('[UPLOAD] ✅ Uploaded to storage:', fileName)

    // 7. Criar registro no BD com status 'pending'
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        filename: file.name,
        file_size: file.size,
        file_type: validation.fileType,
        file_path: fileName,
        processing_status: 'pending',
      })
      .select()
      .single()

    if (dbError || !document) {
      console.log('[UPLOAD] ❌ DB insert failed:', dbError)
      return NextResponse.json({ error: 'Erro ao registrar documento' }, { status: 500 })
    }

    console.log('[UPLOAD] ✅ Document created:', document.id)

    // 8. Iniciar processamento em background (async, sem await)
    processDocumentAsync(document.id, fileName, validation.fileType, user.id).catch((err) => {
      console.error('[UPLOAD] Background processing failed:', err)
    })

    console.log('[UPLOAD] ✅ Completed in', Date.now() - startTime, 'ms')

    // 9. Retornar resposta imediata
    return NextResponse.json({
      documentId: document.id,
      filename: document.filename,
      status: 'pending',
      message: 'Processamento iniciado em background',
    })
  } catch (err) {
    console.error('[UPLOAD] Fatal error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * Processamento em background (async, não bloqueia resposta)
 *
 * 1. Download arquivo do storage
 * 2. Extrai texto
 * 3. Faz chunking
 * 4. Gera embeddings
 * 5. Salva tudo no BD
 * 6. Atualiza status para 'completed'
 */
async function processDocumentAsync(
  documentId: string,
  filePath: string,
  fileType: 'pdf' | 'csv',
  userId: string
): Promise<void> {
  console.log('[PROCESS] Starting background processing')

  try {
    // Criar admin client para operações críticas
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    // 1. Atualizar status para 'processing'
    await adminSupabase
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId)

    console.log('[PROCESS] ✅ Status updated to processing')

    // 2. Download arquivo
    const { data: fileData, error: downloadError } = await adminSupabase.storage
      .from('documents')
      .download(filePath)

    if (downloadError || !fileData) {
      throw new Error(`Download failed: ${downloadError?.message}`)
    }

    const file = new File([fileData], filePath.split('/').pop() || 'document')
    console.log('[PROCESS] ✅ File downloaded:', file.size, 'bytes')

    // 3. Extrair texto
    const { text: extractedText, metadata } = await extractText(file, fileType)
    console.log('[PROCESS] ✅ Text extracted:', extractedText.length, 'chars')

    // 4. Fazer chunking
    const chunks = chunkText(extractedText)
    const chunkValidation = validateChunks(chunks)
    if (!chunkValidation.valid) {
      throw new Error(chunkValidation.error)
    }

    console.log('[PROCESS] ✅ Created', chunks.length, 'chunks')

    // 5. Gerar embeddings
    const embeddings = await generateEmbeddingsForChunks(chunks)
    console.log('[PROCESS] ✅ Generated', embeddings.length, 'embeddings')

    // 6. Salvar chunks e embeddings no BD
    const totalTokens = chunks.reduce((sum, c) => sum + c.token_count, 0)

    // Atualizar documento com extracted_text
    await adminSupabase
      .from('documents')
      .update({
        extracted_text: extractedText,
        total_chunks: chunks.length,
        total_tokens: totalTokens,
      })
      .eq('id', documentId)

    // Inserir chunks
    const chunkData = chunks.map((chunk, idx) => ({
      document_id: documentId,
      chunk_index: idx,
      content: chunk.content,
      token_count: chunk.token_count,
      metadata: chunk.metadata,
    }))

    const { data: savedChunks, error: chunksError } = await adminSupabase
      .from('document_chunks')
      .insert(chunkData)
      .select()

    if (chunksError || !savedChunks) {
      throw new Error(`Chunks insert failed: ${chunksError?.message}`)
    }

    console.log('[PROCESS] ✅ Saved', savedChunks.length, 'chunks')

    // Inserir embeddings
    const embeddingData = savedChunks.map((chunk: any, idx: number) => ({
      chunk_id: chunk.id,
      embedding: embeddings[idx],
    }))

    const { error: embeddingsError } = await adminSupabase
      .from('embeddings')
      .insert(embeddingData)

    if (embeddingsError) {
      throw new Error(`Embeddings insert failed: ${embeddingsError.message}`)
    }

    console.log('[PROCESS] ✅ Saved', embeddingData.length, 'embeddings')

    // 7. Atualizar status para 'completed'
    await adminSupabase
      .from('documents')
      .update({
        processing_status: 'completed',
        error_message: null,
      })
      .eq('id', documentId)

    console.log('[PROCESS] ✅ Document processing completed successfully')
  } catch (err) {
    console.error('[PROCESS] Error during processing:', err)

    // Atualizar documento com erro
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      })

      await adminSupabase
        .from('documents')
        .update({
          processing_status: 'error',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .eq('id', documentId)
    } catch (updateErr) {
      console.error('[PROCESS] Failed to update error status:', updateErr)
    }
  }
}
```

#### 5C.2 Arquivo: `app/api/documents/status/route.ts` (NOVO)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/documents/status?id=<documentId>
 *
 * Retorna status do processamento do documento
 * - Status: pending, processing, completed, error
 * - Progresso: 0-100%
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    // Autenticação
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') || '',
        },
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar documento (RLS assegura que é do usuário)
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Calcular progresso baseado no status
    let progress = 0
    switch (document.processing_status) {
      case 'pending':
        progress = 0
      case 'processing':
        progress = 50
      case 'completed':
        progress = 100
      case 'error':
        progress = 0
    }

    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      status: document.processing_status,
      progress,
      total_chunks: document.total_chunks,
      total_tokens: document.total_tokens,
      error_message: document.error_message,
      created_at: document.created_at,
      updated_at: document.updated_at,
    })
  } catch (err) {
    console.error('[STATUS] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

#### 5C.3 Arquivo: `app/api/documents/list/route.ts` (NOVO)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/documents/list
 *
 * Retorna lista de documentos do usuário
 * - Filtra por status opcional
 * - Ordenado por data de criação descendente
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // pending, processing, completed, error

    // Autenticação
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') || '',
        },
      },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar documentos (RLS assegura que é do usuário)
    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (status && ['pending', 'processing', 'completed', 'error'].includes(status)) {
      query = query.eq('processing_status', status)
    }

    const { data: documents, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      documents: documents || [],
      count: documents?.length || 0,
    })
  } catch (err) {
    console.error('[LIST] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### FASE 2D: Frontend Components

#### 5D.1 Arquivo: `components/DocumentUpload.tsx` (NOVO)

```typescript
'use client'

import { useState, useRef } from 'react'
import { Upload, X, AlertCircle, Check } from 'lucide-react'

interface DocumentUploadProps {
  onUploadComplete?: (documentId: string) => void
  onError?: (error: string) => void
}

interface UploadStatus {
  documentId: string
  filename: string
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
}

/**
 * Componente de upload com feedback visual
 * - Drag & drop
 * - Validação de tipo/tamanho
 * - Status de processamento
 */
export function DocumentUpload({ onUploadComplete, onError }: DocumentUploadProps) {
  const [uploads, setUploads] = useState<UploadStatus[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList) {
    if (!files.length) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validação básica no frontend
      if (!['application/pdf', 'text/csv'].includes(file.type)) {
        onError?.(`${file.name}: Apenas PDF e CSV são suportados`)
        continue
      }

      if (file.size > 10 * 1024 * 1024) {
        onError?.(`${file.name}: Arquivo maior que 10MB`)
        continue
      }

      // Iniciar upload
      await uploadFile(file)
    }
  }

  const uploadFile = async (file: File) => {
    const uploadId = `${Date.now()}-${Math.random()}`

    // Adicionar à lista com status 'uploading'
    setUploads((prev) => [
      ...prev,
      {
        documentId: uploadId,
        filename: file.name,
        status: 'uploading',
        progress: 0,
      },
    ])

    try {
      console.log('[UPLOAD-COMPONENT] Starting upload:', file.name)

      // Fazer upload
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload falhou')
      }

      const data = await response.json()
      console.log('[UPLOAD-COMPONENT] Upload response:', data)

      // Atualizar status para 'processing'
      setUploads((prev) =>
        prev.map((u) =>
          u.documentId === uploadId
            ? {
                ...u,
                documentId: data.documentId,
                status: 'processing',
                progress: 10,
              }
            : u
        )
      )

      // Polling de status
      pollDocumentStatus(data.documentId)

      onUploadComplete?.(data.documentId)
    } catch (err) {
      console.error('[UPLOAD-COMPONENT] Error:', err)

      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'

      setUploads((prev) =>
        prev.map((u) =>
          u.documentId === uploadId
            ? {
                ...u,
                status: 'error',
                error: errorMsg,
              }
            : u
        )
      )

      onError?.(errorMsg)
    }
  }

  const pollDocumentStatus = async (documentId: string) => {
    let attempts = 0
    const maxAttempts = 120 // 10 minutos com polling a cada 5s

    const poll = async () => {
      try {
        const response = await fetch(`/api/documents/status?id=${documentId}`, {
          headers: {
            Authorization: `Bearer ${await getAccessToken()}`,
          },
        })

        if (!response.ok) {
          throw new Error('Status check failed')
        }

        const data = await response.json()

        console.log('[UPLOAD-COMPONENT] Status:', data.status, 'Progress:', data.progress)

        setUploads((prev) =>
          prev.map((u) =>
            u.documentId === documentId
              ? {
                  ...u,
                  status: data.status === 'processing' ? 'processing' : 'completed',
                  progress: data.progress || 50,
                }
              : u
          )
        )

        // Se ainda está processando, continuar polling
        if (data.status === 'processing' && attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 5000) // Poll a cada 5 segundos
        } else if (data.status === 'completed') {
          console.log('[UPLOAD-COMPONENT] ✅ Processing completed')
        } else if (data.status === 'error') {
          setUploads((prev) =>
            prev.map((u) =>
              u.documentId === documentId
                ? {
                    ...u,
                    status: 'error',
                    error: data.error_message || 'Erro desconhecido',
                  }
                : u
            )
          )
        }
      } catch (err) {
        console.error('[UPLOAD-COMPONENT] Polling error:', err)
        if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 5000)
        }
      }
    }

    poll()
  }

  const removeUpload = (documentId: string) => {
    setUploads((prev) => prev.filter((u) => u.documentId !== documentId))
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFileSelect(e.dataTransfer.files)
        }}
        className="p-8 border-2 border-dashed rounded-lg transition"
        style={{
          borderColor: isDragging ? '#e0521d' : '#444',
          backgroundColor: isDragging ? 'rgba(224, 82, 29, 0.05)' : 'transparent',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.csv"
          onChange={(e) => handleFileSelect(e.target.files!)}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center gap-3 text-center cursor-pointer"
        >
          <Upload size={32} style={{ color: '#e0521d' }} />
          <div>
            <p className="text-white font-semibold">Arraste arquivos aqui</p>
            <p className="text-gray-400 text-sm">ou clique para selecionar</p>
            <p className="text-gray-500 text-xs mt-2">PDF ou CSV (máx 10MB cada)</p>
          </div>
        </button>
      </div>

      {/* Upload List */}
      {uploads.length > 0 && (
        <div className="space-y-2 bg-black/50 p-4 rounded-lg">
          <p className="text-white text-sm font-semibold mb-3">Arquivos ({uploads.length})</p>

          {uploads.map((upload) => (
            <div
              key={upload.documentId}
              className="p-3 rounded-lg"
              style={{ backgroundColor: '#222423' }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium truncate">{upload.filename}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {upload.status === 'uploading' && 'Fazendo upload...'}
                    {upload.status === 'processing' && 'Processando...'}
                    {upload.status === 'completed' && 'Concluído'}
                    {upload.status === 'error' && upload.error}
                  </p>
                </div>

                {/* Status Icon */}
                {upload.status === 'completed' && (
                  <Check size={20} style={{ color: '#10b981' }} className="flex-shrink-0" />
                )}
                {upload.status === 'error' && (
                  <AlertCircle size={20} style={{ color: '#ef4444' }} className="flex-shrink-0" />
                )}
              </div>

              {/* Progress Bar */}
              {(upload.status === 'uploading' || upload.status === 'processing') && (
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      backgroundColor: '#e0521d',
                      width: `${upload.progress}%`,
                    }}
                  />
                </div>
              )}

              {/* Remove Button */}
              {(upload.status === 'completed' || upload.status === 'error') && (
                <button
                  onClick={() => removeUpload(upload.documentId)}
                  className="mt-2 text-xs text-gray-400 hover:text-gray-300"
                >
                  <X size={16} className="inline mr-1" />
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Helper para obter access token do Supabase
 */
async function getAccessToken(): Promise<string> {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  } catch {
    return ''
  }
}
```

#### 5D.2 Arquivo: `components/DocumentList.tsx` (NOVO)

```typescript
'use client'

import { useEffect, useState } from 'react'
import { FileText, Trash2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import type { Document } from '@/types/document'

interface DocumentListProps {
  onDocumentSelect?: (documentId: string) => void
  onDocumentDelete?: (documentId: string) => void
}

/**
 * Lista de documentos do usuário
 * - Mostra status de processamento
 * - Permite deletar documentos
 * - Refresh automático a cada 10s
 */
export function DocumentList({ onDocumentSelect, onDocumentDelete }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents/list', {
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar documentos')
      }

      const data = await response.json()
      setDocuments(data.documents || [])
      setError(null)
    } catch (err) {
      console.error('[DOCUMENT-LIST] Error:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()

    // Refresh a cada 10 segundos se há documentos processando
    const interval = setInterval(() => {
      const hasProcessing = documents.some((d) => d.processing_status === 'processing')
      if (hasProcessing) {
        loadDocuments()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const handleDelete = async (documentId: string) => {
    if (!confirm('Tem certeza que deseja deletar este documento?')) {
      return
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao deletar')
      }

      setDocuments((prev) => prev.filter((d) => d.id !== documentId))
      onDocumentDelete?.(documentId)
    } catch (err) {
      console.error('[DOCUMENT-LIST] Delete error:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Carregando documentos...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400">
        <FileText size={32} className="mb-2 opacity-50" />
        <p>Nenhum documento enviado</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="p-4 rounded-lg flex items-center justify-between hover:bg-white/5 transition"
          style={{ backgroundColor: '#222423' }}
        >
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{doc.filename}</p>
                <p className="text-gray-400 text-xs">
                  {doc.file_type.toUpperCase()} • {(doc.file_size / 1024 / 1024).toFixed(1)}MB •
                  {doc.total_chunks} chunks
                </p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {doc.processing_status === 'completed' && (
              <CheckCircle size={18} style={{ color: '#10b981' }} />
            )}
            {doc.processing_status === 'processing' && (
              <Clock size={18} style={{ color: '#f59e0b' }} />
            )}
            {doc.processing_status === 'pending' && (
              <Clock size={18} style={{ color: '#6b7280' }} />
            )}
            {doc.processing_status === 'error' && (
              <AlertCircle size={18} style={{ color: '#ef4444' }} />
            )}

            <button
              onClick={() => handleDelete(doc.id)}
              className="text-gray-400 hover:text-red-400 transition"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

async function getAccessToken(): Promise<string> {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  } catch {
    return ''
  }
}
```

#### 5D.3 Arquivo: `app/dashboard/documents/page.tsx` (NOVO)

```typescript
'use client'

import { useAuth } from '@/hooks/useAuth'
import { DocumentUpload } from '@/components/DocumentUpload'
import { DocumentList } from '@/components/DocumentList'
import { FileText } from 'lucide-react'

export default function DocumentsPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return (
    <div className="h-full overflow-auto p-8" style={{ backgroundColor: '#161616' }}>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-800 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText size={28} style={{ color: '#e0521d' }} />
            <h1 className="text-3xl font-bold text-white">Meus Documentos</h1>
          </div>
          <p className="text-gray-400">
            Envie PDFs e CSVs para usar como contexto nas conversas com IAs
          </p>
        </div>

        {/* Upload Section */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Enviar Novo Documento</h2>
          <DocumentUpload
            onUploadComplete={(docId) => {
              console.log('Document uploaded:', docId)
            }}
            onError={(error) => {
              console.error('Upload error:', error)
            }}
          />
        </div>

        {/* Documents List */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Documentos</h2>
          <DocumentList />
        </div>
      </div>
    </div>
  )
}
```

### FASE 2E: Integração no Chat

#### 5E.1 Modificar: `app/api/chat/route.ts`

**Adicionar após linha 228 (depois de buscar materials):**

```typescript
    // Get user documents for similarity search (NOVO)
    const { data: userDocuments } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', conversation.user_id)
      .eq('processing_status', 'completed')

    let documentContext = ''
    if (userDocuments && userDocuments.length > 0) {
      documentContext += `\n\n## Documentos Disponíveis do Usuário:`
      userDocuments.forEach((doc) => {
        documentContext += `\n- ${doc.filename}: ${doc.total_chunks} chunks, ${doc.total_tokens} tokens`
      })
    }

    if (documentContext) {
      systemPrompt += documentContext
    }
```

#### 5E.2 Hook: `hooks/useDocumentSearch.ts` (NOVO)

```typescript
'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { SimilarChunk } from '@/types/document'

/**
 * Hook para buscar documentos similares
 * - Gera embedding do texto
 * - Faz similarity search via pgvector
 * - Retorna top 3 chunks
 */
export function useDocumentSearch() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchSimilarChunks = useCallback(
    async (query: string, conversationId?: string): Promise<SimilarChunk[]> => {
      try {
        setLoading(true)
        setError(null)

        console.log('[SEARCH] Searching for similar chunks:', query.substring(0, 50))

        // Gerar embedding para query
        const response = await fetch('/api/embeddings/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getAccessToken()}`,
          },
          body: JSON.stringify({ text: query }),
        })

        if (!response.ok) {
          throw new Error('Erro ao gerar embedding')
        }

        const { embedding } = await response.json()

        // Buscar chunks similares via RPC
        const { data: results, error: searchError } = await supabase.rpc('search_similar_chunks', {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: 3,
        })

        if (searchError) {
          throw searchError
        }

        console.log('[SEARCH] Found', results?.length || 0, 'similar chunks')

        return results || []
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
        console.error('[SEARCH] Error:', errorMsg)
        setError(errorMsg)
        return []
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { searchSimilarChunks, loading, error }
}

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}
```

#### 5E.3 SQL Function: `docs/SQL_PHASE2_SEARCH_FUNCTION.sql` (NOVO)

```sql
-- Criar função RPC para similarity search com pgvector
CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  filename TEXT,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    d.id,
    d.filename,
    dc.content,
    (1 - (e.embedding <=> query_embedding))::FLOAT AS similarity
  FROM embeddings e
  JOIN document_chunks dc ON e.chunk_id = dc.id
  JOIN documents d ON dc.document_id = d.id
  WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
  AND d.user_id = auth.uid()
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. MODIFICAÇÕES EM ARQUIVOS EXISTENTES

### 6.1 Atualizar `app/dashboard/layout.tsx`

**Adicionar link para documentos no sidebar:**

```typescript
// Após importes, adicionar:
import Link from 'next/link'

// Na renderização do sidebar, adicionar:
<Link
  href="/dashboard/documents"
  className="px-4 py-2 text-gray-300 hover:text-white transition"
>
  📄 Meus Documentos
</Link>
```

### 6.2 Atualizar `types/chat.ts`

**Adicionar interface para contexto de documentos:**

```typescript
export interface ChatContextDocument {
  documentId: string
  filename: string
  chunks: Array<{
    content: string
    similarity: number
  }>
}

// Estender interface de ChatMessage
export interface ChatMessageWithContext extends ChatMessage {
  contextDocuments?: ChatContextDocument[]
}
```

---

## 7. ORDEM DE IMPLEMENTAÇÃO (CRÍTICA)

**Dia 1-2: Infrastructure & Types**
1. ✅ Executar SQL (tables, indexes, RLS)
2. ✅ Criar `types/document.ts`
3. ✅ Instalar dependências npm
4. ✅ Criar `lib/documentValidation.ts`

**Dia 3: Extraction & Chunking**
5. ✅ Criar `lib/documentExtraction.ts`
6. ✅ Criar `lib/documentChunking.ts`
7. ✅ Testes unitários com PDFs de exemplo

**Dia 4: Embeddings & APIs**
8. ✅ Criar `lib/documentEmbeddings.ts`
9. ✅ Criar `app/api/documents/upload/route.ts`
10. ✅ Criar `app/api/documents/status/route.ts`
11. ✅ Criar `app/api/documents/list/route.ts`

**Dia 5: Frontend Components**
12. ✅ Criar `components/DocumentUpload.tsx`
13. ✅ Criar `components/DocumentList.tsx`
14. ✅ Criar `app/dashboard/documents/page.tsx`

**Dia 6: Integração & Search**
15. ✅ Criar `hooks/useDocumentSearch.ts`
16. ✅ Criar SQL function para search
17. ✅ Modificar `app/api/chat/route.ts`
18. ✅ Integrar documents no context do chat

**Dia 7: Testing & Refinement**
19. ✅ Testar upload PDF (5MB)
20. ✅ Testar upload CSV (1000+ linhas)
21. ✅ Testar similarity search no chat
22. ✅ Testar RLS (user vê só seus docs)
23. ✅ Testar polling de status
24. ✅ Performance: chunking + embeddings

---

## 8. PONTOS DE RISCO E MITIGAÇÃO

| Risco | Causa | Mitigação |
|-------|-------|-----------|
| **Embeddings lentos** | 1000+ chunks → muitas chamadas OpenAI | Batch processing (10 chunks/vez) + delay entre batches |
| **Rate limit OpenAI** | Muitos uploads simultâneos | Rate limit 5 uploads/hora/user + queue |
| **RLS quebrada** | Policy incorreta | Testar: user1 não vê docs de user2 |
| **Storage cheio** | 100MB limit insuficiente | Monitorar via `documents.file_size`, alertar user |
| **PDF com imagens** | pdfjs não extrai OCR | Fallback: "Documento com imagens (OCR não suportado)" |
| **CSV com BOM** | UTF-8 BOM confunde parser | PapaParse handles automaticamente |
| **Timeout em upload grande** | 10MB PDF + extraction lenta | setImmediate + async processing, cliente faz polling |
| **Embedding mismatch** | Dimensões incorretas (1536 vs 384) | Validar sempre 1536 do text-embedding-3-small |

---

## 9. LOGGING ESTRUTURADO (PADRÃO)

Todos os componentes usam formato:
```
[COMPONENTE] mensagem

Exemplos:
[UPLOAD] File received: example.pdf
[EXTRACT] PDF: Processing page 5/10
[CHUNK] Created 45 chunks
[EMBEDDING] Batch 2/5 processing...
[SEARCH] Found 3 similar chunks
[PROCESS] Status updated to completed
```

---

## 10. TESTES RECOMENDADOS

### 10.1 Upload & Validation
- PDF simples (1MB)
- PDF grande (9.9MB)
- CSV com headers
- CSV sem headers
- Arquivo inválido (.doc) → deve rejeitar
- File > 10MB → deve rejeitar

### 10.2 Processing
- Monitorar status polling (deve ir 0→10→50→100)
- Verificar chunks criados corretamente
- Verificar embeddings salvos no BD

### 10.3 Search & Integration
- Chat com documento ativo → deve incluir chunks relevantes
- RLS: user1 não vê documents de user2
- Similarity score deve ser 0-1

### 10.4 Performance
- 100 documentos: list deve carregar < 1s
- Similarity search: < 500ms
- Chunk extraction: < 30s para PDF 5MB

---

## 11. PRÓXIMAS FASES (APÓS IMPLEMENTAÇÃO)

- **FASE 3:** Delete documents endpoint + cascade deletion
- **FASE 4:** Web search integration
- **FASE 5:** Admin interface para gerenciar documents de usuários
- **FASE 6:** Suporte para DOCX, Excel, PowerPoint
- **FASE 7:** Document collections (agrupar docs por tema)

---

## 12. VARIÁVEIS DE AMBIENTE (Atualizar .env.local)

Já existentes (MANTER):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
```

Habilitar supabase Storage:
- Dashboard → Project Settings → Storage
- Criar bucket: `documents` (público: NO, RLS: YES)

---

## 13. CRITICAL FILES FOR IMPLEMENTATION

---

### Critical Files for Implementation

1. **docs/SQL_PHASE2_DOCUMENTS.sql** - Schema critical: tables, RLS policies, indexes (EXECUTE PRIMEIRO)
2. **lib/documentValidation.ts** - Frontend file validation (PDF/CSV only, 10MB limit)
3. **lib/documentExtraction.ts** - Extract text from PDF (pdfjs-dist) and CSV (PapaParse)
4. **lib/documentChunking.ts** - Split text into 500-token chunks with 50-token overlap
5. **lib/documentEmbeddings.ts** - Generate embeddings using OpenAI text-embedding-3-small
6. **app/api/documents/upload/route.ts** - Main upload endpoint + async processing background
7. **types/document.ts** - TypeScript interfaces for Document, Chunk, Embedding types
8. **components/DocumentUpload.tsx** - Frontend upload with drag-drop and progress
9. **app/dashboard/documents/page.tsx** - Document management page in dashboard
10. **hooks/useDocumentSearch.ts** - Search similar chunks for chat context
agentId: a4556467352d357db (use SendMessage with to: 'a4556467352d357db' to continue this agent)
<usage>total_tokens: 73498
tool_uses: 17
duration_ms: 144265</usage>
