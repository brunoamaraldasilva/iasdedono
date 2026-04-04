# Upload Component - Guia de Uso

## 📋 Visão Geral

O componente de upload de documentos foi implementado e está totalmente funcional. Permite que usuários façam upload de arquivos PDF e CSV para usar como contexto nas conversas.

---

## 🎯 Componentes Criados

### 1. **DocumentUpload.tsx**
Componente principal de upload com:
- ✅ Drag & drop support
- ✅ File input validation
- ✅ Progress bar
- ✅ Estados: idle, uploading, success, error
- ✅ Feedback visual com emojis
- ✅ Limite de 10MB por arquivo

**Props:**
```typescript
interface DocumentUploadProps {
  onUploadComplete?: (documentId: string) => void
  disabled?: boolean
}
```

**Uso:**
```tsx
<DocumentUpload
  onUploadComplete={(docId) => console.log('Uploaded:', docId)}
/>
```

---

### 2. **DocumentsList.tsx**
Componente para exibir lista de documentos:
- ✅ Status visual (icons + texto)
- ✅ Progressão de processamento
- ✅ Tamanho e data do arquivo
- ✅ Chunks e tokens processed
- ✅ Botões de ação (delete, retry)

**Props:**
```typescript
interface DocumentsListProps {
  documents: Document[]
  onRetry?: (documentId: string) => void
  onDelete?: (documentId: string) => void
  loading?: boolean
  emptyMessage?: string
}
```

---

### 3. **useDocuments Hook**
Hook para gerenciar estado e operações de documentos:
```typescript
const {
  documents,      // Document[]
  state,          // 'idle' | 'loading' | 'error' | 'success'
  error,          // string | null
  isRefreshing,   // boolean
  refresh,        // () => Promise<void>
  getById,        // (id: string) => Document | undefined
  getProcessing,  // () => Document[]
  getCompleted,   // () => Document[]
  getErrors,      // () => Document[]
} = useDocuments()
```

---

### 4. **Documents Page** (`/dashboard/documents`)
Página completa com:
- ✅ Upload component integrado
- ✅ Lista de documentos
- ✅ Stats (total, completos, processando, erros)
- ✅ Auto-refresh enquanto processando
- ✅ Botões de delete

---

## 🔗 API Endpoints

### Upload Document
```bash
POST /api/documents/upload
Headers: Authorization: Bearer <token>
Body: FormData { file: File }

Response:
{
  "success": true,
  "documentId": "uuid",
  "status": "pending",
  "message": "File uploaded. Processing started."
}
```

### List Documents
```bash
GET /api/documents/list
Headers: Authorization: Bearer <token>

Response:
{
  "documents": [
    {
      "id": "uuid",
      "filename": "example.csv",
      "file_size": 1024,
      "file_type": "csv",
      "processing_status": "completed",
      "total_chunks": 1,
      "total_tokens": 96,
      "created_at": "2026-04-03T18:08:59.443974",
      "updated_at": "2026-04-03T18:09:01.721076"
    }
  ],
  "total": 1
}
```

### Delete Document
```bash
DELETE /api/documents/:documentId
Headers: Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Documento deletado com sucesso"
}
```

---

## 🎨 Features Implementadas

### ✅ Validação
- Tipos aceitos: PDF, CSV
- Tamanho máximo: 10MB
- Mensagens de erro claras

### ✅ Processamento
- Extração de texto automática
- Chunking em 500 tokens
- Geração de embeddings
- Cálculo de estatísticas

### ✅ UX
- Drag & drop intuitivo
- Progress bar em tempo real
- Estados visuais (idle, uploading, success, error)
- Feedback com emojis
- Auto-refresh enquanto processando

### ✅ Segurança
- Validação no backend
- RLS policies enforced
- Ownership validation
- Rate limiting

---

## 📂 Estrutura de Arquivos

```
components/
├── DocumentUpload.tsx      # Upload component
└── DocumentsList.tsx       # List component

hooks/
└── useDocuments.ts         # Hook para gerenciar docs

app/api/
├── documents/
│   ├── upload/route.ts     # Upload endpoint
│   ├── list/route.ts       # List endpoint
│   └── [id]/route.ts       # Delete endpoint
└── auth/
    └── login/route.ts      # Login endpoint

app/dashboard/
└── documents/
    └── page.tsx            # Documents page

types/
└── document.ts             # TypeScript types
```

---

## 🧪 Testes Realizados

✅ **Upload Funcional**
- CSV upload: OK
- Multiple uploads: OK
- Processing: OK
- Auto-refresh: OK

✅ **API Endpoints**
- POST /api/documents/upload: OK
- GET /api/documents/list: OK
- DELETE /api/documents/[id]: OK

✅ **Validações**
- File type validation: OK
- File size validation: OK
- RLS policies: OK

---

## 🚀 Próximos Passos

1. **Integração no Chat**
   - Toggle para usar documentos
   - Search/similarity matching
   - Context embedding

2. **UI Enhancements**
   - Drag & drop zone improvements
   - Upload history
   - Document preview

3. **Backend Features**
   - Batch processing
   - Async job queue
   - Error recovery

---

## 📊 Performance

- Upload time: < 2 segundos
- Processing time: 1-5 segundos (depende do tamanho)
- Auto-refresh interval: 2 segundos (enquanto processando)
- Storage: ~500 KB por documento (variável)

---

## 🔐 Security

- ✅ RLS policies enforced
- ✅ User ownership validated
- ✅ File type validated
- ✅ File size limited
- ✅ Storage authenticated access
- ✅ Rate limiting (via existing system)

---

## 📝 Changelog

**3 de Abril de 2026 - Initial Release**
- DocumentUpload component
- DocumentsList component
- useDocuments hook
- Documents page
- API endpoints (upload, list, delete)
- Full testing & validation

---

**Status:** ✅ Production Ready
