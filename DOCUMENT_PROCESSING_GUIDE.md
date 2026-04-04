# Guia de Processamento de Documentos - IAs de Dono

## 📋 Arquivos Suportados

### **Documentos Estruturados** (Prioritário)
```
✅ PDF (.pdf)           → pdf-parse, pdfjs-dist
✅ Excel (.xlsx, .xls)  → xlsx package
✅ CSV (.csv)           → papaparse ou csv-parser
✅ Word (.docx)         → docx package
⚠️  PowerPoint (.pptx)  → pptx package (mais complexo)
⚠️  Google Sheets/Docs  → Exportar como CSV/PDF primeiro
```

### **Imagens e OCR** (Secundário)
```
✅ PNG, JPG, JPEG       → Tesseract.js (OCR)
⚠️  TIFF, WebP          → Converter para PNG/JPG primeiro
```

### **Texto Simples** (Suportado)
```
✅ TXT (.txt)
✅ Markdown (.md)
✅ JSON (.json)
```

---

## 🔧 Stack Recomendado

### **Instalação Inicial**
```bash
npm install \
  pdf-parse \
  pdfjs-dist \
  xlsx \
  docx \
  tesseract.js \
  js-tiktoken \
  papaparse \
  sharp
```

### **Por tipo de arquivo:**

| Formato | Biblioteca | Tokens |
|---------|-----------|---------|
| PDF | `pdf-parse` + `pdfjs-dist` | ⭐⭐ Leve |
| Excel | `xlsx` | ⭐ Muito leve |
| CSV | `papaparse` | ⭐ Muito leve |
| Word | `docx` | ⭐⭐ Leve |
| PowerPoint | `pptx` | ⭐⭐⭐ Médio |
| Imagens | `tesseract.js` | ⭐⭐⭐⭐ Pesado |
| Contar tokens | `js-tiktoken` | ⭐ Muito leve |
| Resize imagens | `sharp` | ⭐⭐ Leve |

---

## 📊 Arquitetura de Processamento

```
USER UPLOAD
    ↓
[File Received] → Validar tipo/tamanho
    ↓
[Extract Text] → Converter formato → texto puro
    ↓
[Chunk Text] → Dividir em ~500 tokens (overlapping 50)
    ↓
[Generate Embeddings] → Usar OpenAI API
    ↓
[Store in DB] → Salvar chunks + embeddings em pgvector
    ↓
[Ready for RAG] → Pronto para similarity search
```

---

## 🏗️ Fluxo Técnico Detalhado

### **1. Upload & Validação**

```typescript
// lib/documentValidation.ts
const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/csv': '.csv',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_USER_STORAGE = 50 * 1024 * 1024 // 50MB

export function validateDocument(file: File): {
  valid: boolean
  error?: string
  extension?: string
} {
  if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
    return { valid: false, error: 'Tipo de arquivo não suportado' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Arquivo maior que 10MB' }
  }
  return {
    valid: true,
    extension: ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
  }
}
```

---

### **2. Extração de Texto**

```typescript
// lib/documentExtraction.ts
import * as PDFJS from 'pdfjs-dist'
import { read, utils } from 'xlsx'
import { Document } from 'docx'
import Tesseract from 'tesseract.js'

export async function extractText(
  file: File,
  fileType: string
): Promise<{ text: string; metadata: Record<string, any> }> {
  const buffer = await file.arrayBuffer()

  switch (fileType) {
    case 'pdf':
      return extractPDF(buffer)
    case 'xlsx':
    case 'xls':
      return extractExcel(buffer)
    case 'csv':
      return extractCSV(buffer)
    case 'docx':
      return extractWord(buffer)
    case 'txt':
    case 'md':
      return extractText(file, fileType)
    case 'png':
    case 'jpg':
    case 'jpeg':
      return extractImage(file)
    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }
}

async function extractPDF(buffer: ArrayBuffer) {
  const pdf = await PDFJS.getDocument(buffer).promise
  let text = ''
  const pageCount = pdf.numPages

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join(' ')
    text += `\n--- Página ${i} ---\n${pageText}`
  }

  return {
    text,
    metadata: {
      pages: pageCount,
      source: 'PDF'
    }
  }
}

async function extractExcel(buffer: ArrayBuffer) {
  const workbook = read(buffer)
  let text = ''

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = utils.sheet_to_csv(sheet)
    text += `\n--- Sheet: ${sheetName} ---\n${csv}`
  }

  return {
    text,
    metadata: {
      sheets: workbook.SheetNames,
      source: 'Excel'
    }
  }
}

async function extractCSV(buffer: ArrayBuffer) {
  const text = new TextDecoder().decode(buffer)
  return {
    text,
    metadata: { source: 'CSV' }
  }
}

async function extractWord(buffer: ArrayBuffer) {
  // Nota: docx parsing é complexo, considere usar bibliotecas especializadas
  return {
    text: 'Word extraction requires specialized library',
    metadata: { source: 'Word', warning: 'Partial support' }
  }
}

async function extractImage(file: File) {
  const result = await Tesseract.recognize(file, 'por')
  return {
    text: result.data.text,
    metadata: {
      confidence: result.data.confidence,
      source: 'Image (OCR)'
    }
  }
}
```

---

### **3. Chunking & Tokenization**

```typescript
// lib/documentChunking.ts
import { encoding_for_model } from 'js-tiktoken'

const enc = encoding_for_model('gpt-3.5-turbo')

const CHUNK_SIZE = 500 // tokens
const OVERLAP = 50 // tokens

export function chunkText(text: string): Array<{
  content: string
  token_count: number
  start_char: number
  end_char: number
}> {
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''
  let currentTokens = 0
  const chunks = []
  let charPosition = 0

  for (const sentence of sentences) {
    const sentenceTokens = enc.encode(sentence).length

    if (currentTokens + sentenceTokens > CHUNK_SIZE) {
      // Salvar chunk atual
      if (currentChunk) {
        const startChar = charPosition - currentChunk.length
        chunks.push({
          content: currentChunk.trim(),
          token_count: currentTokens,
          start_char: startChar,
          end_char: charPosition
        })
      }

      // Overlap: manter últimas 50 tokens
      const overlapSentences = []
      let overlapTokens = 0
      for (let i = sentences.indexOf(sentence) - 1; i >= 0; i--) {
        const tokens = enc.encode(sentences[i]).length
        if (overlapTokens + tokens <= OVERLAP) {
          overlapSentences.unshift(sentences[i])
          overlapTokens += tokens
        } else {
          break
        }
      }

      currentChunk = overlapSentences.join(' ')
      currentTokens = overlapTokens
    }

    currentChunk += ' ' + sentence
    currentTokens += sentenceTokens
    charPosition += sentence.length + 1
  }

  // Salvar último chunk
  if (currentChunk) {
    const startChar = charPosition - currentChunk.length
    chunks.push({
      content: currentChunk.trim(),
      token_count: currentTokens,
      start_char: startChar,
      end_char: charPosition
    })
  }

  return chunks
}
```

---

### **4. Geração de Embeddings**

```typescript
// lib/embeddings.ts
import { openai } from '@ai-sdk/openai'

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = openai.textEmbeddingModel('text-embedding-3-small')

  const embedding = await model.embed({
    value: text,
  })

  return embedding.embedding
}

export async function generateEmbeddingsForChunks(
  chunks: Array<{ content: string }>
): Promise<Array<{ chunk: string; embedding: number[] }>> {
  const results = []

  // Processa em batches de 10 para não sobrecarregar
  for (let i = 0; i < chunks.length; i += 10) {
    const batch = chunks.slice(i, i + 10)
    const embeddings = await Promise.all(
      batch.map(chunk => generateEmbedding(chunk.content))
    )

    batch.forEach((chunk, idx) => {
      results.push({
        chunk: chunk.content,
        embedding: embeddings[idx]
      })
    })

    // Aguardar um pouco entre batches para não atingir rate limit
    if (i + 10 < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}
```

---

### **5. Storage em Supabase**

```sql
-- Tabelas para armazenar documentos e embeddings

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  context_id UUID REFERENCES contexts(id) ON DELETE CASCADE,

  filename TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  file_path TEXT, -- path no Supabase Storage

  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, error
  error_message TEXT,
  extracted_text TEXT,

  total_chunks INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  chunk_index INTEGER,
  content TEXT NOT NULL,
  token_count INTEGER,

  start_char INTEGER,
  end_char INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,

  embedding vector(1536), -- OpenAI text-embedding-3-small usa 1536 dimensions

  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_embeddings_chunk_id ON embeddings(chunk_id);

-- Criar índice HNSW para similarity search
CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);
```

---

## ⚡ Performance & Otimizações

### **Processamento em Background**

Para não bloquear o usuário, use fila com Redis (Upstash):

**Setup:**
```bash
vercel integration add upstash
# Isso cria automaticamente as variáveis de ambiente
```

```typescript
// app/api/documents/upload/route.ts
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export async function POST(request: NextRequest) {
  // ... validação ...

  const documentId = crypto.randomUUID()

  // Adicionar à fila
  await redis.lpush('document_queue', JSON.stringify({
    documentId,
    userId: user.id,
    filePath,
  }))

  // Retornar imediatamente
  return NextResponse.json({
    documentId,
    status: 'processing'
  })
}

// API para checar status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const documentId = searchParams.get('id')

  const doc = await supabase
    .from('documents')
    .select('processing_status, error_message')
    .eq('id', documentId)
    .single()

  return NextResponse.json(doc.data)
}
```

### **Rate Limiting de Embeddings**

```typescript
// lib/documentQueue.ts
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const EMBEDDING_QUEUE_SIZE = 1

export async function processDocumentQueue() {
  const jobData = await redis.lpop('document_queue')
  if (!jobData) return

  const job = JSON.parse(jobData as string)

  try {
    await processDocument(job)
    // Processar próximo documento
    setTimeout(processDocumentQueue, 2000) // esperar 2s
  } catch (error) {
    // Retry ou marcar como erro
    console.error('Document processing failed:', error)
    // Opcionalmente: adicionar de volta à fila para retry
    await redis.rpush('document_queue_failed', JSON.stringify(job))
  }
}
```

---

## 💾 Estimativa de Custos

| Ação | Custo | Frequência |
|------|-------|-----------|
| Embeddings (1536 dim) | $0.02 / 1M tokens | Por documento |
| Armazenamento Supabase | Gratuito até 500MB | Contínuo |
| pgvector Indexing | Incluído no Supabase | Uma vez |
| Claude API (chat com docs) | Padrão + tokens dos docs | Por query |

---

## ✅ Checklist para Implementação

- [ ] Instalar dependências: `pdf-parse`, `xlsx`, `docx`, `tesseract.js`, `js-tiktoken`
- [ ] Criar schema SQL (tabelas + índices)
- [ ] Implementar `validateDocument()` function
- [ ] Implementar extractores de texto por tipo
- [ ] Implementar `chunkText()` com overlapping
- [ ] Implementar `generateEmbedding()` com OpenAI
- [ ] Criar fila de processamento com Vercel KV
- [ ] Criar endpoint `/api/documents/upload`
- [ ] Criar endpoint `/api/documents/status`
- [ ] Criar endpoint `/api/documents/list`
- [ ] Testar com diferentes tipos de arquivo
- [ ] Otimizar storage em Supabase Storage
- [ ] Implementar similarity search no chat

---

## 🔗 Próximas Tarefas

1. **Implementar Upload básico** (T2B.1-T2B.4)
2. **Extração de texto** (T2C.1)
3. **Chunking** (T2C.2)
4. **Embeddings** (T2C.3)
5. **Integrar no chat** (T3.1-T3.4)

