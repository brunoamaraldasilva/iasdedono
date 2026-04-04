# Plano de Limpeza do Projeto - c-lvls

**Data:** 4 de Abril de 2026
**Objetivo:** Limpeza conservadora APENAS de arquivos órfãos/debug
**Risco:** ZERO - nenhum arquivo essencial será removido

---

## 1. ANÁLISE DE ARQUIVOS CANDIDATOS À REMOÇÃO

### 1.1 DEBUG ENDPOINTS (NÃO USADOS)

```
❌ REMOVER:
  /app/api/debug/document-text/route.ts      ← Debug temporário
  /app/api/debug/documents/route.ts          ← Debug temporário

Razão: Apenas para testing durante desenvolvimento
Impacto: ZERO - não é usado em produção
```

### 1.2 ORPHANED ENDPOINTS (REFERENCIADO MAS MORTO)

```
❌ REMOVER:
  /app/api/documents/[id]/process/route.ts   ← Chamado de lugar nenhum
                                              ← processDocument() não existe mais em lib/documentProcessing.ts

Razão: Função que deveria chamar foi removida
Impacto: ZERO - nada chama este endpoint
```

### 1.3 VERIFICAR - DOCUMENTOS PAGE (TALVEZ REMOVER)

```
⚠️ INVESTIGAR:
  /app/dashboard/documents/page.tsx          ← Existe mas...

Status: MANTER POR ENQUANTO
Razão: Documents agora são scoped por conversation (chat)
      Mas pode ser útil como histórico global depois

Recomendação: KEEP (não machuca nada)
```

---

## 2. ARQUIVOS QUE PARECEM DUPLICADOS MAS NÃO SÃO

```
✅ MANTER - Não são duplicados:

  /app/api/documents/[id]/route.ts    ← GET single document
  /app/api/documents/list/route.ts    ← GET all documents
  /app/api/documents/upload/route.ts  ← POST upload

  Cada um tem propósito específico, não remove!

  /app/api/admin/agents/create/route.ts  ← POST criar
  /app/api/admin/agents/update/route.ts  ← PUT editar
  /app/api/admin/agents/delete/route.ts  ← DELETE deletar
  /app/api/admin/agents/publish/route.ts ← PUT toggle publish

  Cada um é essencial! NÃO REMOVE!
```

---

## 3. COMPONENTES & LIBS - Verificação

```
✅ MANTER - Tudo é usado:

components/
  ├── (user/)           ← Chat, Sidebar, MessageInput, etc (USADO)
  ├── admin/            ← Dashboard, Users, Agents, Logs (USADO)
  ├── ContextRequiredModal.tsx (USADO)
  ├── ChatDocumentUpload.tsx   (USADO no chat)
  └── etc              (TODOS USADOS)

lib/
  ├── supabase.ts             (ESSENCIAL - auth + queries)
  ├── openai.ts               (ESSENCIAL - chat API)
  ├── documentProcessing.ts   (ESSENCIAL - extract/embed)
  ├── personas.ts             (ESSENCIAL - personas base)
  └── etc                     (TODOS USADOS)

hooks/
  ├── useAuth.ts              (ESSENCIAL)
  ├── useChat.ts              (ESSENCIAL)
  ├── useContext.ts           (ESSENCIAL)
  └── useAdmin.ts             (ESSENCIAL)
```

---

## 4. PLANO FINAL - O QUE REMOVER

### ✅ SAFE TO REMOVE (3 arquivos apenas):

```
1. /app/api/debug/document-text/route.ts
   Size: ~1KB
   Usage: ZERO
   Risk: ZERO

2. /app/api/debug/documents/route.ts
   Size: ~1KB
   Usage: ZERO
   Risk: ZERO

3. /app/api/documents/[id]/process/route.ts
   Size: ~500B
   Usage: ZERO (função que chama não existe)
   Risk: ZERO
```

**Total a remover:** 3 arquivos, ~2.5KB
**Arquivos mantidos:** ~41 arquivos (todos essenciais)

---

## 5. ESTRUTURA APÓS LIMPEZA

```
c-lvls/
├── app/
│   ├── (público)/ ← login page
│   ├── dashboard/
│   │   ├── chat/[id]/page.tsx
│   │   ├── context/page.tsx
│   │   ├── documents/page.tsx
│   │   ├── layout.tsx
│   │   ├── logout/route.ts
│   │   └── page.tsx
│   ├── admin/
│   │   ├── agents/
│   │   ├── users/
│   │   ├── logs/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── api/
│   │   ├── auth/      ✅ mantém
│   │   ├── chat/      ✅ mantém
│   │   ├── context/   ✅ mantém
│   │   ├── documents/ ✅ mantém (sem /process)
│   │   ├── admin/     ✅ mantém
│   │   ├── agents/    ✅ mantém
│   │   ├── debug/     ❌ REMOVER
│   │   └── conversations/ ✅ mantém
│   ├── auth/callback/route.ts ✅
│   ├── beta/[token]/page.tsx  ✅
│   ├── layout.tsx     ✅
│   └── page.tsx       ✅
├── components/        ✅ todos usados
├── lib/              ✅ todos essenciais
├── hooks/            ✅ todos usados
├── types/            ✅ todos usados
├── docs/             ✅ melhor organizado
└── middleware.ts     ✅ essencial
```

---

## 6. CHECKLIST PRE-REMOVAL

- [ ] Usar `grep` para confirmar que `/process` nunca é chamado
- [ ] Confirmar que debug endpoints não são importados em lugar nenhum
- [ ] Backup das 3 linhas de código (por paranoia)
- [ ] Remover arquivos

---

## 7. PRÓXIMA ETAPA: SerpAPI

Após limpeza:
- [ ] Criar `/app/api/search/web/route.ts` (SerpAPI integration)
- [ ] Criar `/lib/serpapi.ts` (helper functions)
- [ ] Adicionar `web_search_cache` table (Supabase)
- [ ] Integrar no chat

---

## RESUMO

| Ação | Quantidade |
|------|-----------|
| Remover | 3 arquivos |
| Manter | 41 arquivos |
| Criar (próx) | 2+ arquivos |
| Risco | **ZERO** |
