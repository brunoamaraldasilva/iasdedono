# 📚 IAs de Dono - Documentação Completa

**Última atualização:** 3 de Abril de 2026

---

## 🎯 Visão Geral do Projeto

**IAs de Dono** é uma plataforma de chat com personas IA especializadas para donos de negócio. Cada persona (Diretor Comercial, Diretor Financeiro, Diretor de Gente) fornece insights especializados baseados no contexto do negócio do usuário.

**Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS + Supabase + OpenAI

---

## ✅ FASE 1: Autenticação & Contexto (COMPLETO)

### 1.1 Autenticação (Login/Signup)

**Arquivo:** `app/page.tsx`

**Fluxo:**
- Usuário abre app → vê login/signup
- Clica "Criar Conta" → form de signup
- Validação de senha robusta: 6+ caracteres, 1+ maiúscula, 1+ minúscula, 1+ número
- Feedback visual em tempo real (checklist)
- Rate limit: 5 signups/hora/IP
- Signup bem-sucedido → login automático → redirect /dashboard

**Endpoints:**
- `POST /api/auth/signup` - Criar conta (com rate limit)

**Hooks:**
- `useAuth()` - Gerencia sessão, cria perfil de usuário, redireciona não-autenticados

**Segurança:**
- ✅ Bearer token authentication
- ✅ Rate limiting implementado
- ✅ Passwords hashed by Supabase
- ✅ Session management com BroadcastChannel (sync entre abas)

---

### 1.2 Validação de Contexto do Negócio

**Objetivo:** Usuário preenche informações da empresa para melhorar respostas das IAs.

**Página:** `app/dashboard/context/page.tsx`

**Campos (15 totais):**
1. business_name (obrigatório)
2. business_type (obrigatório)
3. description (texto livre)
4. industry
5. annual_revenue (número)
6. team_size (número)
7. founded_year (número)
8. main_goals (texto livre - NÃO array)
9. main_challenges (texto livre - NÃO array)
10. target_market
11. main_competitors
+ completion_percentage (0-100%)
+ is_completed (boolean)

**Features:**
- ✅ Auto-save com debounce de 1s
- ✅ Progress bar visual (0-100%, verde quando >= 75%)
- ✅ Modal pop-up quando < 75%
- ✅ Formulário limpo e responsivo

---

## 🔄 Chat & Personas

### 2.1 Personas Base (3 Dinâmicas)

**Arquivo:** `app/dashboard/page.tsx`

**Personas:**
1. **Diretor Comercial** - Marketing, Vendas, Go-to-market
2. **Diretor Financeiro** - Finanças, Fluxo de caixa, Análise
3. **Diretor de Gente** - RH, Cultura, Retenção

### 2.2 Chat em Tempo Real

**Arquivo:** `hooks/useChat.ts`

**Features:**
- ✅ Streaming de respostas
- ✅ Bearer token authentication
- ✅ Detecção de first message
- ✅ Histórico carregado (últimas 15 mensagens)
- ✅ Realtime subscriptions para conversas

**Endpoint:** `POST /api/chat`
- Body: { conversationId, agentId, message, isFirstMessage }
- Returns: Streaming response (text/plain; charset=utf-8)

### 2.3 Geração Automática de Títulos (First Message)

**Arquivo:** `app/api/chat/route.ts`

**Solução:**
1. isFirstMessage = true
2. Stream de resposta completa
3. DEPOIS (não durante), setImmediate(() => { generateTitleAsync(...) })
4. Background task:
   - Chama OpenAI: "Crie um título curto em 5 palavras"
   - Atualiza conversation.title no BD
   - Usa ADMIN CLIENT (service role) para bypass RLS
5. Frontend ouve CustomEvent → recarrega conversas
6. Sidebar mostra novo título

**⚠️ CRÍTICO:** Usa SUPABASE_SERVICE_ROLE_KEY no createAdminSupabaseClient()

---

## 🏗️ Arquitetura & Database

### Database Tables

**conversations**: id, user_id, agent_id, title, created_at, updated_at
**messages**: id, conversation_id, role, content, created_at
**business_context**: id, user_id, [...15 campos...], completion_percentage, is_completed, created_at, updated_at
**agents**: id, name, description, system_prompt, is_published, is_beta, created_by, created_at, updated_at

### Variáveis de Ambiente (.env.local)

CRÍTICAS:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx... ← NECESSÁRIO para admin operations
OPENAI_API_KEY=sk-xxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🎨 Design System

**Cores:**
- Laranja (primária): `#e0521d`
- Preto (background): `#161616`
- Cinza (cards): `#222423`
- Verde (success): `#10b981`
- Vermelho (error): `#ef4444`

---

## 📁 Arquivos Críticos (NÃO REMOVER)

```
app/api/chat/route.ts ⭐⭐⭐ (streaming + title generation com admin client)
app/api/auth/signup/route.ts ⭐ (rate limit)
app/dashboard/layout.tsx ⭐⭐ (sidebar + contexto modal)
app/dashboard/context/page.tsx ⭐ (preenchimento contexto)
app/page.tsx ⭐ (login/signup)

hooks/useAuth.ts ⭐ (gerencia autenticação)
hooks/useChat.ts ⭐⭐ (streaming + custom event para title refresh)
hooks/useContext.ts ⭐ (gerencia business context)

components/ContextRequiredModal.tsx ⭐ (modal contexto)
components/Sidebar.tsx (list conversas)

lib/supabase.ts ⭐ (cliente + createAdminSupabaseClient)
lib/openai.ts ⭐⭐ (generateChatResponseStream, generateConversationTitle)
lib/rateLimit.ts ⭐ (rate limiting)
```

---

## 🚫 Armadilhas Conhecidas

### Problema 1: Conversas não atualizam título
**Causa:** RLS bloqueia updates do user anon client
**Solução:** `createAdminSupabaseClient()` em app/api/chat/route.ts (usa SERVICE_ROLE_KEY)

### Problema 2: Title generation silenciosa
**Causa:** Background task sem await → pode não completar antes de request terminar
**Solução:** Usar `setImmediate()` + `CustomEvent` + refetch no frontend

### Problema 3: Realtime subscription não funciona
**Causa:** RLS bloqueia some updates
**Solução:** Emitir CustomEvent 'conversationTitleUpdated' do chat → ouve no layout

---

## 📊 Logs Estruturados (NÃO REMOVER)

**Backend:**
```
🚀 [BACKGROUND] START
📝 [BACKGROUND] Generating title
🤖 [BACKGROUND] Calling OpenAI
✅ [BACKGROUND] Title generated
💾 [BACKGROUND] Updating database
✅ [BACKGROUND] Conversation title updated successfully
```

**Frontend:**
```
📨 [Hook] Sending message
🔄 [Hook] First message complete, triggering refresh
📢 [Layout] Received title update event
💬 [Sidebar] Loaded conversations
```

---

## ✨ Features Implementadas

| Feature | Status | Arquivo |
|---------|--------|---------|
| Login/Signup | ✅ | app/page.tsx |
| Validação Senha | ✅ | app/page.tsx |
| Rate Limit | ✅ | lib/rateLimit.ts |
| Chat Streaming | ✅ | hooks/useChat.ts |
| Personas Base | ✅ | app/dashboard/page.tsx |
| Contexto Negócio | ✅ | app/dashboard/context/page.tsx |
| Auto-save Contexto | ✅ | useContext.ts |
| Geração Títulos | ✅ | app/api/chat/route.ts |
| Realtime Updates | ✅ | hooks/useChat.ts |
| Modal Contexto | ✅ | ContextRequiredModal.tsx |

---

## 📞 Próximos Passos (FASE 2+)

- [ ] **FASE 2:** Upload de Documentos (PDF, CSV)
  - Document upload UI
  - Text extraction pipeline
  - Chunk storage
  - Embedding generation

- [ ] **FASE 3:** Web Search integration

- [ ] **FASE 4:** Email Whitelist

- [ ] **FASE 5:** Admin Interface

---

**Mantido por:** Claude Code
**Última revisão:** 3 de Abril de 2026
**Versão:** 1.0

---

## 🚀 FASE 2: Document Upload (PDF + CSV) - IMPLEMENTAÇÃO INICIADA

### Status
- [x] Database schema criado (SQL)
- [x] TypeScript types definidos
- [x] Dependências instaladas (pdf-parse, papaparse, js-tiktoken)
- [x] Document processing library criado
- [x] Upload API endpoint criado
- [x] List API endpoint criado
- [ ] Frontend upload component (próximo)
- [ ] Chat integration (próximo)

### Arquivos Criados
**Backend:**
- `app/api/documents/upload/route.ts` - Upload + background processing
- `app/api/documents/list/route.ts` - Listar documentos
- `lib/documentProcessing.ts` - Extração + chunking + tokens
- `types/document.ts` - Tipos TypeScript

**Database:**
- `docs/PHASE2_SQL_DOCUMENTS.sql` - Schema + RLS + indexes + triggers

**Setup:**
- `PHASE2_PLAN.md` - Plano completo (2078 linhas)
- `PHASE2_SETUP_CHECKLIST.md` - Checklist para setup

### Fluxo Implementado

```
Upload:
  User → POST /api/documents/upload
  → Validação (tipo, tamanho, auth)
  → Salva em Supabase Storage
  → Cria document record (status: pending)
  → Inicia background task

Processing (async):
  Buffer → processDocument()
  → extractTextFromPDF/CSV()
  → chunkText() (500 tokens, 50 overlap)
  → countTokens() (js-tiktoken)
  → INSERT document_chunks
  → Gera embeddings (OpenAI)
  → INSERT embeddings
  → Update status: completed

List:
  GET /api/documents/list
  → Retorna documents do user
  → Status, chunks, tokens
```

### Próximo Passo
1. Executar SQL em Supabase Dashboard
2. Criar bucket "documents" em Storage
3. Testar endpoints (curl)
4. Implementar frontend (upload button + list)
5. Integrar com chat (similarity search)

Ver: `PHASE2_SETUP_CHECKLIST.md`

