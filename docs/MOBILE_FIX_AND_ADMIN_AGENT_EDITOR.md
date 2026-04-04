# Responsividade Mobile + Admin Agent Editor

## 📱 PROBLEMA IDENTIFICADO

### Dashboard (Ruim no mobile)
- ❌ Sidebar muito larga (ocupa 20%+ da tela)
- ❌ Conversas truncadas ou invisíveis
- ❌ Personas desaparecem
- ❌ Layout não responsivo

### Chat (Ruim no mobile)
- ❌ Painel de context overflow
- ❌ MessageInput não se adapta
- ❌ Botões muito pequenos

### Context Page (Médio)
- ⚠️ Funciona mas poderia melhorar

---

## ✅ SOLUÇÃO: Mobile-First Responsive

### Estratégia por Breakpoint

```
MOBILE (< 640px)
├─ Sidebar collapsa (⛁ ícone para toggle)
├─ Conversas em full width
├─ Personas em scroll horizontal (carousel)
├─ Chat em full width
└─ Context page otimizada

TABLET (640px - 1024px)
├─ Sidebar pequeno com ícones
├─ Mais espaço para conversas
├─ Personas em grid 2 colunas
└─ Chat com sidebar visível

DESKTOP (> 1024px)
├─ Sidebar completo
├─ Layout atual
└─ Tudo visível
```

### Arquivos a Modificar

**1. `app/dashboard/layout.tsx`**
```typescript
// Estado de sidebar aberto/fechado
const [sidebarOpen, setSidebarOpen] = useState(false)

// Mobile: toggle sidebar
// Tablet/Desktop: sempre visível
```

**2. `components/Sidebar.tsx`**
```typescript
// Mobile: width-[250px] → w-[60px] (ícones apenas)
// Desktop: w-[250px] (texto + ícones)
// Com transition suave
```

**3. `components/PersonaSelector.tsx`**
```typescript
// Mobile: scroll horizontal (carousel)
// Desktop: grid 3 colunas
// Touch-friendly: mais espaço entre items
```

**4. `components/ChatWindow.tsx`**
```typescript
// Mobile: padding reduzido
// Mensagens com font menor mas legível
// Sem overflow
```

**5. `components/MessageInput.tsx`**
```typescript
// Mobile: 100% width
// Botão anexo maior (touch-friendly)
// Teclado não quebra layout
```

---

## 🛠️ ADMIN AGENT EDITOR (Especificação Detalhada)

### Estrutura da Página

```
/admin/agents/[id]/page.tsx

┌─────────────────────────────────────────────────────┐
│ ← Voltar | Editar Agent: Diretor Comercial | ✕     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ SEÇÃO 1: Agent Detalhes                            │
│ ┌─────────────────────────────────────────────┐   │
│ │ Nome do Agent *                             │   │
│ │ [Diretor Comercial_____________]            │   │
│ │                                             │   │
│ │ System Prompt (Instruções da IA) *          │   │
│ │ ┌──────────────────────────────────────┐   │   │
│ │ │ Você é um especialista em...         │   │   │
│ │ │ [textarea grande]                    │   │   │
│ │ │                                      │   │   │
│ │ └──────────────────────────────────────┘   │   │
│ │                                             │   │
│ │ Status:                                     │   │
│ │ [Rádio] ● Publicado  ○ Rascunho            │   │
│ │                                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ SEÇÃO 2: Materiais do Agent (Knowledge Base)      │
│ ┌─────────────────────────────────────────────┐   │
│ │ Materiais (Contextos e Documentos)          │   │
│ │                                             │   │
│ │ Material Existente 1                        │   │
│ │ ┌──────────────────────────────────────┐   │   │
│ │ │ 📄 "Go-to-Market 2025.pdf"           │ ✕ │   │
│ │ │ Type: document | 2.3MB | 15 min ago  │   │   │
│ │ └──────────────────────────────────────┘   │   │
│ │                                             │   │
│ │ Material Existente 2                        │   │
│ │ ┌──────────────────────────────────────┐   │   │
│ │ │ 📝 "Estratégia de Vendas"            │ ✕ │   │
│ │ │ Type: context | Customizado          │   │   │
│ │ └──────────────────────────────────────┘   │   │
│ │                                             │   │
│ │ [+ Adicionar Material]                      │   │
│ │                                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ SEÇÃO 3: Upload de Novo Material                   │
│ ┌─────────────────────────────────────────────┐   │
│ │ 📁 Arrastar arquivo ou clicar               │   │
│ │ (PDF, DOCX, TXT, até 10MB)                 │   │
│ │                                             │   │
│ │ [Upload progress bar]                       │   │
│ │ ███████░░░░░ 70%                           │   │
│ │                                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ OU                                                  │
│                                                     │
│ SEÇÃO 3B: Adicionar Contexto Customizado           │
│ ┌─────────────────────────────────────────────┐   │
│ │ Título do Material *                        │   │
│ │ [________________]                          │   │
│ │                                             │   │
│ │ Conteúdo *                                  │   │
│ │ ┌──────────────────────────────────────┐   │   │
│ │ │ [textarea grande]                    │   │   │
│ │ │                                      │   │   │
│ │ └──────────────────────────────────────┘   │   │
│ │                                             │   │
│ │ [Adicionar Contexto]                        │   │
│ │                                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ [Salvar Agent]  [Deletar Agent]                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### SEÇÃO 1: Agent Detalhes

**Campos:**
- `name` (TEXT, required)
  - Input simples
  - Placeholder: "ex: Diretor Comercial"
  - Max 50 caracteres

- `system_prompt` (TEXT, required)
  - Textarea grande (400x300px)
  - Placeholder: "Você é um especialista em..."
  - Character counter

- `is_published` (BOOLEAN)
  - Radio buttons: Publicado / Rascunho
  - Default: Rascunho (false)
  - Tooltip: "Publicado = visível para usuários"

**Ações:**
- [Salvar Agent] (POST/PUT /api/admin/agents/[id])
- [Deletar Agent] (DELETE /api/admin/agents/[id]) - com confirmação

---

### SEÇÃO 2: Materiais Existentes

**Para cada material:**
```
┌────────────────────────────────────┐
│ 📄/📝 Título do Material            │ ✕
│ Type: document/context              │
│ 2.3MB | Criado: 5 min atrás         │
└────────────────────────────────────┘
```

**Actions:**
- ✕ = Delete material (DELETE /api/admin/agents/[id]/materials/[material_id])

**List:**
- Scrollável se > 5 materiais
- Ordenação por created_at DESC

---

### SEÇÃO 3: Upload de Novo Material

**Opção A: Upload de Arquivo**
```
┌──────────────────────────────────────┐
│ 📁 Arraste arquivo aqui ou clique   │
│ Aceita: PDF, DOCX, TXT (até 10MB)   │
└──────────────────────────────────────┘
```

**Opção B: Contexto Customizado**
```
Nome: [_________________]
Conteúdo:
┌──────────────────────────────────┐
│ [textarea]                       │
└──────────────────────────────────┘
[Adicionar Contexto]
```

**Fluxo de Upload:**
1. User seleciona arquivo
2. Mostra preview: "Go-to-Market 2025.pdf (2.3MB)"
3. Clica [Upload]
4. Progress bar mostra %
5. Quando completo: novo item aparece na SEÇÃO 2

**Fluxo de Contexto Customizado:**
1. User preenche Nome + Conteúdo
2. Clica [Adicionar Contexto]
3. Item aparece na SEÇÃO 2 com type='context'

---

## 🔄 Integração com Banco de Dados

### Tabelas Necessárias

```sql
-- Agents (já deveria existir ou criar)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  icon TEXT DEFAULT '🤖',
  color TEXT DEFAULT '#e0521d',
  is_published BOOLEAN DEFAULT false,
  is_beta BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent Materials
CREATE TABLE agent_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('document', 'context', 'reference')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  file_path TEXT,
  file_type TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### APIs Necessárias

```typescript
// Agents CRUD
POST   /api/admin/agents              → Create
GET    /api/admin/agents              → List all
GET    /api/admin/agents/[id]         → Get one
PUT    /api/admin/agents/[id]         → Update
DELETE /api/admin/agents/[id]         → Delete

// Agent Materials
POST   /api/admin/agents/[id]/materials           → Upload/Add
GET    /api/admin/agents/[id]/materials           → List
DELETE /api/admin/agents/[id]/materials/[matId]   → Delete
```

---

## 🎨 Componentes a Criar

### 1. `components/admin/AgentEditor.tsx`
- Seção 1: Detalhes
- Seção 2: Materiais Existentes
- Seção 3: Upload novo

### 2. `components/admin/MaterialsList.tsx`
- Lista de materiais
- Delete button
- Loading state

### 3. `components/admin/MaterialUpload.tsx`
- Drag-and-drop
- File preview
- Progress bar

### 4. `components/admin/CustomContextForm.tsx`
- Nome + Conteúdo
- Validação
- Submit

---

## 📋 Implementação em Fases

### FASE 1: Mobile Responsiveness (2-3h)
- [ ] Ajustar Sidebar (collapse no mobile)
- [ ] Ajustar Conversas list
- [ ] Ajustar PersonaSelector (carousel)
- [ ] Ajustar Chat (full width)
- [ ] Ajustar Context Page

### FASE 2: Admin Layout Base (1h)
- [ ] `/admin/layout.tsx` com sidebar admin
- [ ] `/admin/dashboard/page.tsx`
- [ ] `/admin/users/page.tsx`
- [ ] `/admin/agents/page.tsx`

### FASE 3: Agent Editor (2h)
- [ ] `/admin/agents/[id]/page.tsx` (form agent)
- [ ] `components/admin/AgentEditor.tsx`
- [ ] APIs: Create/Update/Delete agents

### FASE 4: Materials Management (2h)
- [ ] `components/admin/MaterialsList.tsx`
- [ ] `components/admin/MaterialUpload.tsx`
- [ ] `components/admin/CustomContextForm.tsx`
- [ ] APIs: Upload/Delete materials

### FASE 5: Integração no Chat (30 min)
- [ ] Carregar agents dinâmicos
- [ ] Injetar materials no prompt

**Total: 7-8 horas**

---

## ✅ Próximos Passos

1. **Você confirma que quer começar pela responsividade mobile?** (mais urgente)
2. **Depois partir para Admin Agent Editor**
3. **Depois integração no chat**

Qual você quer que eu comece? Recomendo:
```
ORDEM: Mobile → Admin → Integração
```

