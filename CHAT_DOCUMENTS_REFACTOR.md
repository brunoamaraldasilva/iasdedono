# Chat-Scoped Documents - Refactor Completo

## 📋 O Que Mudou

### ❌ Removido
- ~~Página global `/dashboard/documents`~~
- ~~Hook `useDocuments`~~
- ~~Componente `DocumentUpload`~~
- ~~Componente `DocumentsList`~~
- ~~UPLOAD_COMPONENT_GUIDE.md~~

### ✅ Novo
- **ChatDocumentUpload.tsx** - Upload integrado no chat
- **MessageInput** - Modificado com botão de anexo
- **SQL Migration** - Adiciona `conversation_id` aos documentos
- **Validação** - Conversas validam ownership

---

## 🎯 Novo Fluxo

### Antes (Global)
```
Dashboard → Documentos → Upload
(documentos disponíveis globalmente)
```

### Depois (Por Conversa)
```
Chat → Botão Anexo 📎 → Upload
(documentos vinculados àquela conversa)
```

---

## 🔧 Componentes Atualizados

### 1. **ChatDocumentUpload.tsx** (NOVO)
Componente de upload integrado ao chat:

```tsx
<ChatDocumentUpload
  conversationId={conversationId}
  onUploadComplete={(docId, fileName) => {
    console.log('Documento anexado:', fileName)
  }}
  disabled={false}
/>
```

**Features:**
- Ícone laranja 📎 (sem emoji no código)
- Dropdown mostrando documentos anexados
- Botão X para remover
- Badge com contador
- Validação de tipo (PDF/CSV) e tamanho (10MB)

---

### 2. **MessageInput.tsx** (MODIFICADO)
Agora recebe e passa `conversationId`:

```tsx
<MessageInput
  onSendMessage={handleSendMessage}
  conversationId={id}  // ← NOVO
/>
```

**Visual:**
```
┌─────────────────────────────────┐
│ Escreva sua mensagem...         │
├─────────────────────────────────┤
│ [📎 com 2 docs] [Enviar]       │
└─────────────────────────────────┘
```

---

### 3. **Upload API** (MODIFICADO)
Endpoint agora valida `conversation_id`:

```bash
POST /api/documents/upload
Headers: Authorization: Bearer <token>
Body: FormData {
  file: File,
  conversationId: string  # ← NOVO
}

Response:
{
  "success": true,
  "documentId": "uuid",
  "status": "pending"
}
```

**Validações:**
- ✅ conversationId é obrigatório
- ✅ Conversa deve existir
- ✅ Usuário deve ser owner da conversa
- ✅ File type (PDF/CSV)
- ✅ File size (max 10MB)

---

## 🗄️ Database Schema

### Nova Coluna: `documents.conversation_id`
```sql
ALTER TABLE documents
ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;
```

**Impacto:**
- Documentos agora são **per-conversation**
- Se conversa for deletada, documentos também são
- Index para performance: `idx_documents_conversation_id`

---

## 🔐 RLS Policies (ATUALIZADAS)

Documentos agora podem ser acessados por:
1. **Owner do documento** (user_id)
2. **Qualquer user na conversa** (conversation_id)

```sql
-- SELECT
auth.uid() = user_id OR
conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())

-- INSERT
auth.uid() = user_id AND
(conversation_id IS NULL OR
 conversation_id IN (...))
```

---

## 📝 Próximos Passos

### 1. Executar Migration (CRÍTICO!)
```sql
-- Abra Supabase Dashboard → SQL Editor
-- Cole e execute: docs/PHASE2_MIGRATE_CONVERSATION_DOCUMENTS.sql
```

**O que faz:**
- ✅ Adiciona coluna `conversation_id`
- ✅ Cria indexes
- ✅ Atualiza RLS policies

### 2. Testar End-to-End
1. Abra um chat
2. Clique no botão 📎
3. Selecione um PDF ou CSV
4. Veja aparecendo na lista de anexados
5. Remova com o X
6. Repita com outro documento

### 3. Integração com Chat
Próximo: Implementar search/RAG para usar documentos nas respostas

---

## 🐛 Troubleshooting

### "Conversation not found"
- Você está tentando anexar a um chat que não existe
- Solução: Criar novo chat primeiro

### "Access denied"
- Você não é owner da conversa
- Solução: Verificar conversation_id

### Upload silenciosamente falha
- Arquivo muito grande (> 10MB) ou tipo inválido
- Verificar console do browser para detalhes

---

## 📊 Dados Antes/Depois

### Antes
```
documents
├── id
├── user_id (owner global)
├── filename
└── ...
```

### Depois
```
documents
├── id
├── user_id (owner)
├── conversation_id  ← ✨ NOVO
├── filename
└── ...
```

---

## 🎨 Visual do Componente

```
Chat Header
───────────────────────────────
[Chat Title]                 [Share]

Message Window
───────────────────────────────
[Messages...]

Message Input
───────────────────────────────
[Type here...]  [📎]  [Send]
                 ↑
         Anexar Documento
         Shows: 📎 Attached (2)
```

---

## ✅ Checklist de Implementação

- [x] Remover página global de documentos
- [x] Remover link do sidebar
- [x] Criar ChatDocumentUpload component
- [x] Atualizar MessageInput
- [x] Modificar upload API
- [x] Adicionar conversation_id validation
- [x] Criar SQL migration
- [ ] **Executar SQL migration no Supabase** ← VOCÊ PRECISA FAZER
- [ ] Testar end-to-end
- [ ] Implementar RAG integration

---

## 📌 Arquivos Modificados

```
✨ NOVO:
- components/ChatDocumentUpload.tsx
- docs/PHASE2_MIGRATE_CONVERSATION_DOCUMENTS.sql
- CHAT_DOCUMENTS_REFACTOR.md (este arquivo)

📝 MODIFICADO:
- components/MessageInput.tsx
- app/api/documents/upload/route.ts
- app/dashboard/chat/[id]/page.tsx
- components/Sidebar.tsx (removido link)

❌ DELETADO:
- components/DocumentUpload.tsx
- components/DocumentsList.tsx
- hooks/useDocuments.ts
- app/dashboard/documents/page.tsx → redirecionado
- UPLOAD_COMPONENT_GUIDE.md
```

---

## 🚀 Status

**Backend:** ✅ Completo
- Upload API com validação de conversation_id
- RLS policies preparadas
- SQL migration pronto

**Frontend:** ✅ Completo
- ChatDocumentUpload component
- MessageInput integrado
- Validação e feedback

**Database:** ⏳ Aguardando
- Você precisa executar a migration no Supabase!

---

**Status:** Ready for SQL Migration ⏳

Próximo: Você executa o SQL e depois testamos!
