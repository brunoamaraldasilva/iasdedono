# Plano: Responsividade Mobile + Admin Interface + Agent Materials

## 🔍 PASSO 0: Verificar Estrutura Atual do BD

**Execute no Supabase SQL Editor:**
```
Arquivo: docs/DATABASE_SCHEMA_CHECK.sql
```

Isso vai te mostrar:
- ✅ Todas as tabelas existentes
- ✅ Todas as colunas e tipos
- ✅ Foreign keys e relações

**Depois de rodar, compartilhe a saída para eu ter clareza do estado atual.**

---

## 📱 PONTO 1: Responsividade Mobile

### Problema Atual
- App não funciona bem em telefone
- Layout quebrado ou ilegível

### O que precisa ser ajustado?

Para te ajudar, preciso saber:
1. **Qual parte está ruim?**
   - Login/Signup?
   - Dashboard?
   - Chat?
   - Sidebar?

2. **Que tipo de problema?**
   - Texto muito pequeno?
   - Botões muito grandes/pequenos?
   - Layout quebrado?
   - Overflow de conteúdo?

**Solução rápida (que provavelmente resolve):**
```typescript
// app/layout.tsx adicionar no <head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

Mas como você é mais específico sobre o problema, posso fazer ajustes diretos.

---

## 🗂️ PONTO 2: Agent Materials

### Estrutura Esperada

Baseado no plano anterior, a tabela deveria ser:

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,                    -- "Diretor Comercial"
  description TEXT,                              -- Descrição do agent
  system_prompt TEXT,                            -- Prompt específico
  icon TEXT,                                     -- ícone/emoji
  color TEXT,                                    -- cor do agent
  is_published BOOLEAN DEFAULT false,
  is_beta BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE agent_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('document', 'context', 'reference')),
  title TEXT NOT NULL,                           -- "Go-to-Market Strategy"
  content TEXT NOT NULL,                         -- Conteúdo do material
  source TEXT,                                   -- Origem (URL, filename)
  order_index INTEGER DEFAULT 0,                 -- Para ordenação
  file_path TEXT,                                -- Se foi upload (storage path)
  file_type TEXT,                                -- 'pdf', 'txt', 'docx', etc
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### QUESTÕES A RESPONDER

1. **Essas tabelas já existem?** ← Saberemos após rodar o DATABASE_SCHEMA_CHECK.sql
2. **Se existem, têm as mesmas colunas?** ← Precisamos comparar
3. **Faltam colunas importantes?** ← Podemos adicionar com migration

---

## 👨‍💼 PONTO 3: Admin Interface (Simplificada)

### Estrutura Planejada

```
/admin
├── /dashboard          [Stats básicas]
│   ├─ Total usuários
│   ├─ Usuários ativos/inativos
│   ├─ Último login
│   └─ Total agents
│
├── /users              [CRUD Usuários]
│   ├─ Listar (email, status, último login)
│   ├─ Filtro ativo/inativo
│   └─ Bloquear/desbloquear
│
└── /agents             [CRUD Agents]
    ├─ Listar (nome, status published/beta/draft)
    ├─ Criar novo agent
    ├─ Editar agent
    │  ├─ Nome
    │  ├─ Descrição
    │  ├─ System Prompt (textarea)
    │  ├─ Icon
    │  └─ Cor
    │
    └── /:id/materials  [Upload de Contextos]
        ├─ Listar materials
        ├─ Upload arquivo (PDF, TXT, DOCX)
        ├─ Adicionar contexto customizado
        ├─ Reordenar (drag-drop ou order)
        └─ Deletar material
```

### Fluxo Admin para Criar Agent

```
1. Admin clica "Novo Agent"
   ↓
2. Preenche formulário:
   - Nome: "Diretor Comercial"
   - Descrição: "Especialista em..."
   - System Prompt: (textarea grande)
   - Icon: "📊"
   - Cor: "#FF6B35"
   ↓
3. Clica "Salvar como Draft"
   ↓
4. Agent criado com is_published=false
   ↓
5. Seção "Materiais" aparece
   - Upload PDF/DOCX
   - Adicionar contexto (textarea)
   - Drag-drop para reordenar
   ↓
6. Clica "Publicar"
   ↓
7. Agent fica visível para users (is_published=true)
```

---

## 🏗️ Arquitetura de Upload de Materiais

### Opção A: Upload Direto (Simples)
```
Admin clica "Upload Material"
  ↓
Seleciona arquivo (PDF/DOCX/TXT)
  ↓
Upload para Supabase Storage: /agent-materials/{agent_id}/{file_id}
  ↓
Backend extrai texto (pdf-parse, docx, etc)
  ↓
Salva em agent_materials com:
  - type: 'document'
  - title: 'Estratégia GTM 2025'
  - content: [texto extraído]
  - file_path: 'storage/path'
  ↓
Mostra na UI com opção de deletar/reordenar
```

**Vantagens:**
- ✅ Simples
- ✅ Funciona com PDF/DOCX/TXT
- ✅ Reutiliza código de `lib/documentProcessing.ts`

**Desvantagens:**
- ❌ Se arquivo muito grande, pode timeout

### Opção B: Com Edge Functions (Robusto)
```
Admin clica "Upload"
  ↓
Upload para Storage (sem processar)
  ↓
Trigger Edge Function na Supabase
  ↓
Edge Function extrai texto assincronamente
  ↓
Salva em agent_materials quando pronto
  ↓
Status em real-time (pending → processed)
```

**Vantagens:**
- ✅ Funciona com arquivos grandes
- ✅ Assincronamente (não bloqueia)
- ✅ Mais robusto

**Desvantagens:**
- ❌ Mais complexo
- ❌ Custa um pouco mais (Edge Functions)

### RECOMENDAÇÃO
Para MVP: **Opção A (Upload Simples)**
- Funciona para maioria dos casos
- Se arquivo > 5MB, faz upload sem extrair (salva como reference)
- Depois escalamos para Edge Functions se necessário

---

## 📋 Sequência de Implementação Recomendada

### FASE 1: Verificação (15 min)
- [ ] Rodar DATABASE_SCHEMA_CHECK.sql
- [ ] Ver estrutura atual
- [ ] Identificar tabelas faltando vs presentes

### FASE 2: Responsividade Mobile (30-45 min)
- [ ] Identificar problema específico em mobile
- [ ] Ajustar CSS/layout
- [ ] Testar em iPhone/Android

### FASE 3: Admin Layout Base (45 min)
- [ ] Criar `/admin/layout.tsx` com sidebar admin
- [ ] Criar `/admin/page.tsx` com dashboard simples
- [ ] Criar `/admin/users/page.tsx` com listagem
- [ ] Criar `/admin/agents/page.tsx` com listagem

### FASE 4: Agent CRUD (1h)
- [ ] Criar `/admin/agents/create/page.tsx`
- [ ] Criar `/admin/agents/[id]/page.tsx` (editar)
- [ ] API: `POST /api/admin/agents` (criar)
- [ ] API: `PUT /api/admin/agents/[id]` (editar)

### FASE 5: Agent Materials (1h)
- [ ] Criar `/admin/agents/[id]/materials/page.tsx`
- [ ] Upload file handler
- [ ] API: `POST /api/admin/agents/[id]/materials` (upload)
- [ ] API: `DELETE /api/admin/agents/[id]/materials/[material_id]`

### FASE 6: Integração no Chat (30 min)
- [ ] Carregar agents dinâmicos (não hardcoded)
- [ ] Injetar agent_materials no prompt
- [ ] Testar chat com materials

**Total estimado: 3-4 horas**

---

## 🚀 Próximo Passo Imediato

1. **Execute** `docs/DATABASE_SCHEMA_CHECK.sql` no Supabase
2. **Compartilhe** a saída para eu ver o estado atual
3. **Descreva** qual parte do mobile tá ruim
4. **Decide** se quer Opção A ou B para upload de materiais

Com essas infos, podemos começar direto! 🎯

---

## 💡 Notas Técnicas Importantes

### Sobre Agent Materials
- `type` = classify tipo de conteúdo ('document' = arquivo, 'context' = texto customizado, 'reference' = link)
- `order_index` = para ordenação (permite drag-drop depois)
- `content` = sempre texto (extraído de PDF/DOCX ou customizado)
- `file_path` = só preenchido se veio de upload
- `file_type` = ajuda a debugar origem

### Sobre Admin Auth
- Necessário adicionar role check no middleware
- Apenas `role='admin'` acessa `/admin/*`
- Usuários normais redirecionam para `/dashboard`

### Sobre Upload
- Reutilizar `lib/documentProcessing.ts` (já tem extraction logic)
- Salvar em Storage: `agent-materials/{agent_id}/{uuid}.{ext}`
- MAX file size: 10MB por arquivo, 50MB por agent

