# ✅ PHASE 2 Setup Checklist

## Pré-requisitos (Fazer ANTES de qualquer coisa)

### 1. Criar Bucket no Supabase Storage
```
1. Abra Supabase Dashboard
2. Vá para Storage
3. Clique "Create a new bucket"
4. Nome: documents
5. Public: OFF (privado)
6. Create bucket
```

### 2. Habilitar pgvector Extension
```
1. Supabase Dashboard → SQL Editor
2. Executar:
   CREATE EXTENSION IF NOT EXISTS vector;
3. Copie e execute TODO o conteúdo de:
   docs/PHASE2_SQL_DOCUMENTS.sql
```

### 3. Verificar se as tabelas foram criadas
```sql
-- No Supabase SQL Editor, execute:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('documents', 'document_chunks', 'embeddings');

-- Deve retornar 3 rows
```

---

## Arquivos Criados (NUNCA REMOVER)

### Backend
- ✅ `app/api/documents/upload/route.ts` - Upload endpoint
- ✅ `app/api/documents/list/route.ts` - List endpoint
- ✅ `lib/documentProcessing.ts` - PDF/CSV extraction + chunking
- ✅ `types/document.ts` - TypeScript types

### Database
- ✅ `docs/PHASE2_SQL_DOCUMENTS.sql` - Schema + RLS + triggers

### Documentation
- ✅ `PHASE2_PLAN.md` - Plano completo
- ✅ `PHASE2_SETUP_CHECKLIST.md` - Este arquivo

---

## Dependências Instaladas

```
✅ pdf-parse
✅ pdfjs-dist
✅ papaparse
✅ js-tiktoken
```

Verificar com: `npm list pdf-parse papaparse js-tiktoken`

---

## Status Atual

### ✅ Implementado
- [x] Database schema (tables + RLS + indexes)
- [x] TypeScript types
- [x] PDF extraction (via pdf-parse)
- [x] CSV extraction (via papaparse)
- [x] Text chunking (500 tokens, 50 overlap)
- [x] Token counting (via js-tiktoken)
- [x] Upload API (POST /api/documents/upload)
- [x] List API (GET /api/documents/list)
- [x] Background processing (async tasks)
- [x] Embedding generation (OpenAI API)
- [x] Storage validation (RLS enforced)

### 🚧 Próximo Passo (Frontend + Chat Integration)
- [ ] Frontend: Upload button + document list
- [ ] Frontend: Toggle para usar documentos no chat
- [ ] Backend: Similarity search endpoint
- [ ] Backend: Integração no /api/chat
- [ ] UI: Show document sources nas respostas

---

## Como Testar (Após Setup)

### 1. Teste o Upload (via API)
```bash
# Terminal
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@path/to/file.pdf"

# Deve retornar:
# { "success": true, "documentId": "...", "status": "pending" }
```

### 2. Teste a Listagem
```bash
curl -X GET http://localhost:3000/api/documents/list \
  -H "Authorization: Bearer YOUR_TOKEN"

# Deve retornar:
# { "documents": [...], "total": 1 }
```

### 3. Verificar processing status no dashboard
```sql
SELECT id, filename, processing_status, total_chunks, total_tokens
FROM documents
WHERE user_id = 'seu_user_id'
ORDER BY created_at DESC;
```

---

## Logs a Monitorar (Terminal & Console)

### Upload
```
📤 [UPLOAD] Starting document upload
📄 [UPLOAD] File received: { name, size, type }
💾 [UPLOAD] Uploading to storage: ...
📝 [UPLOAD] Creating document record
⏳ [UPLOAD] Queuing for processing
```

### Processing
```
🔄 [PROCESSING] START document
⏳ [PROCESSING] Updating status to processing
📖 [PROCESSING] Extracting and chunking text
📄 [PDF] Extracted N pages
📊 [CSV] Extracted N rows
✂️ [CHUNKING] Starting: maxTokens=500 overlap=50
  📍 Chunk 1: XXX tokens
💾 [PROCESSING] Saving extracted text
📍 [PROCESSING] Inserting N chunks
🧠 [PROCESSING] Generating embeddings
✅ [PROCESSING] COMPLETE document
```

---

## ⚠️ Cuidados Importantes

### NÃO FAZER
- ❌ Não deletar `PHASE2_SQL_DOCUMENTS.sql`
- ❌ Não modificar signature de `processDocument()`
- ❌ Não remover logs estruturados com emojis
- ❌ Não mudar SERVICE_ROLE_KEY em .env.local (necessário para embeddings)

### SIM FAZER
- ✅ Verificar que ngvector está habilitado
- ✅ Verificar que bucket "documents" foi criado
- ✅ Verificar RLS policies estão ativas
- ✅ Manter DOCUMENTATION.md atualizado

---

## Próximas Etapas (Após este checklist)

1. **Frontend: Upload Component** (2-3h)
   - Button para upload
   - Progress bar
   - Document list com status

2. **Frontend: Documents Selector** (1-2h)
   - Toggle para usar documentos no chat
   - Multi-select de documentos

3. **Backend: Similarity Search** (2-3h)
   - `POST /api/documents/search`
   - Vector similarity com pgvector
   - Top-K chunks

4. **Integration: Chat + Documents** (2-3h)
   - Modificar /api/chat para buscar documentos
   - Adicionar context ao prompt
   - Mostrar sources nas respostas

---

## Suporte

Se algo quebrou:

1. **Cheque os logs** (terminal + console)
2. **Verifique SQL** (Supabase Dashboard → SQL Editor)
3. **Teste endpoints manualmente** (curl ou Postman)
4. **Consulte PHASE2_PLAN.md** para detalhes completos

---

**Status:** ✅ Pronto para testes
**Última atualização:** 3 de Abril de 2026
