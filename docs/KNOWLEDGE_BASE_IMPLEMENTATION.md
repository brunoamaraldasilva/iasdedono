# Knowledge Base (Agent Materials) - Implementação

## 🎯 O Que É?

**Knowledge Base** = Documentos + contextos que cada Agent (persona IA) tem acesso.

Exemplo:
- **Diretor Comercial** pode ter acesso a:
  - Materiais sobre Go-to-Market
  - Case studies de clientes
  - Estratégias de vendas
  - Métricas de pipeline

- **Diretor Financeiro** pode ter acesso a:
  - Templates de análise de custos
  - Modelos de fluxo de caixa
  - Ferramentas de previsão
  - Regulamentações financeiras

- **Diretor de Gente** pode ter acesso a:
  - Políticas de RH
  - Modelos de avaliação
  - Planos de desenvolvimento
  - Dados de cultura/clima

---

## 🏗️ Arquitetura

### Tabelas Necessárias (já criadas?)

```sql
-- Agents (personas base + customizadas)
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  system_prompt TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP
);

-- Materials da cada Agent
CREATE TABLE agent_materials (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('document', 'context', 'reference')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT, -- URL, filename, etc
  order INTEGER DEFAULT 0,
  created_at TIMESTAMP
);
```

**Status:** ⏳ Verificar se já existem

---

## 🔄 Fluxo de Funcionamento

### 1. **No Dashboard do Admin**

```
Admin → /admin/agents
  ├─ Lista de agents (Diretor Comercial, Financeiro, Gente)
  ├─ Clica em um agent
  └─ → /admin/agents/[id]
      ├─ Edit agent details (name, system_prompt, etc)
      ├─ Seção "Materials"
      │  ├─ Listar materials existentes
      │  ├─ Upload novo document
      │  ├─ Adicionar contexto customizado
      │  └─ Drag-and-drop para reordenar
      └─ Salvar
```

### 2. **No Chat do Usuário**

```
User seleciona Agent (ex: Diretor Comercial)
  ↓
Sistema carrega:
  ├─ System prompt do agent
  ├─ Todos os materials (documents + contextos)
  ├─ Business context do usuário (preenchido na PHASE 1)
  └─ Histórico de conversa
  ↓
Monta prompt para OpenAI:
  ┌─────────────────────────────────────┐
  │ System Prompt (Agent)               │ 500 tokens
  ├─────────────────────────────────────┤
  │ Materials (documentos + contextos)  │ 1000 tokens
  ├─────────────────────────────────────┤
  │ Business Context (do usuário)       │ 300 tokens
  ├─────────────────────────────────────┤
  │ Histórico de Conversa               │ 2000 tokens
  ├─────────────────────────────────────┤
  │ Pergunta do Usuário                 │ 200 tokens
  └─────────────────────────────────────┘
  ↓
OpenAI responde
  ↓
Mostrar resposta com badge: "📚 Baseado em materials de [Agent]"
```

---

## 🛠️ Implementação em 3 Passos

### **PASSO 1: Verificar Tabelas (5 min)**

Execute no Supabase SQL Editor:

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('agents', 'agent_materials');
```

**Resultado esperado:**
- Se ambas existem → Continue para PASSO 2
- Se não existem → Execute SQL de criação (vou gerar)
- Se agentes existem mas sem materials → Continue para PASSO 2

---

### **PASSO 2: Migrar Personas Base para DB (10 min)**

**Antes (code hardcoded):**
```typescript
// lib/personas.ts
export const personas = [
  { id: 'cfo', name: 'Diretor Financeiro', ... },
  { id: 'cco', name: 'Diretor Comercial', ... },
  ...
]
```

**Depois (from database):**
```typescript
// lib/personas.ts (refatorado)
import { supabase } from './supabase'

export async function getAgents() {
  const { data } = await supabase
    .from('agents')
    .select('*, agent_materials(*)')
    .eq('is_published', true)

  return data
}
```

---

### **PASSO 3: Integrar Materials no Chat (20 min)**

**Antes (só system prompt):**
```typescript
const messages = [
  {
    role: 'system',
    content: agent.system_prompt
  },
  ...
]
```

**Depois (system prompt + materials):**
```typescript
const materialContext = agent.agent_materials
  ?.map(m => `[${m.type}] ${m.title}:\n${m.content}`)
  .join('\n\n')

const messages = [
  {
    role: 'system',
    content: `${agent.system_prompt}\n\n## Materiais Disponíveis:\n${materialContext}`
  },
  ...
]
```

---

## 📋 Checklist de Implementação

### Fase 1: Setup (15 min)
- [ ] Verificar se tabelas `agents` e `agent_materials` existem
- [ ] Se não existem, criar com SQL
- [ ] Inserir 3 agents base (Diretor Comercial, Financeiro, Gente)
- [ ] Inserir materials exemplo para cada agent

### Fase 2: Backend (30 min)
- [ ] Refatorar `lib/personas.ts` para carregar de BD
- [ ] Criar API: `GET /api/agents` (retorna agents + materials)
- [ ] Criar API: `GET /api/agents/[id]/materials`
- [ ] Atualizar `app/api/chat/route.ts` para injetar materials

### Fase 3: Frontend (30 min)
- [ ] Atualizar `PersonaSelector.tsx` para carregar agents dinâmicos
- [ ] Atualizar `ChatWindow.tsx` para mostrar badge "Baseado em materials"
- [ ] Testar chat com materials injetados

### Fase 4: Admin (45 min)
- [ ] Criar `app/admin/agents/page.tsx` (listar agents)
- [ ] Criar `app/admin/agents/[id]/page.tsx` (editar agent)
- [ ] Criar UI para upload/edit de materials
- [ ] Criar drag-and-drop para reordenar materials

---

## 🚀 Próximos Passos Imediatos

1. **Rodar a query de CHECK** para ver se tabelas já existem
2. **Se existem:** Vamos criar os agents base + materials
3. **Se não existem:** Vamos criar as tabelas primeiro
4. **Depois:** Refatorar o chat para injetar materials

**Tempo estimado:** 1-2 horas para ficar 100% funcional

---

## 💡 Integração com Web Search

**Importante:** Knowledge Base + Web Search funcionam juntos!

```
User pergunta: "Qual é a melhor estratégia de Go-to-Market?"
  ↓
Sistema processa:
  1. Carrega materials do agent (ex: templates do Manual de Donos)
  2. Se ativar web search: busca tendências atuais de GTM
  3. Combina ambos no prompt
  ↓
IA responde com:
  📚 "Baseado em materials e tendências de 2026..."
  - De materials: X
  - De web search: Y
```

---

## 📊 Comparativo: Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Personas** | Hardcoded | Dinâmicas do BD |
| **Materials** | Não existem | Gerenciáveis via admin |
| **Conhecimento** | Só prompt do agent | Prompt + documentos |
| **Admin** | Sem UI | Interface completa |
| **Escalabilidade** | Fixa (3 agents) | Ilimitada |

