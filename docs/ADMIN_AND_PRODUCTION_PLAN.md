# Admin Interface + Production Plan (5k Usuários em 10 dias)

## 🚨 REALIDADE: Não é mais MVP!

**Lançamento:** 14 de Abril (10 dias)
**Usuários esperados:** 5.000 (nem todos simultâneos, mas precisa suportar)
**Implicação:** Tudo precisa ser **escalável, resiliente e auditado**

---

## 📋 PASSO 0: VERIFICAR SCHEMA ATUAL

Execute **AGORA** no Supabase SQL Editor:

```sql
SELECT
  t.table_name,
  STRING_AGG(
    c.column_name || ' (' || c.data_type ||
    CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END || ')',
    E'\n  '
    ORDER BY c.ordinal_position
  ) as columns
FROM
  information_schema.tables t
  LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE
  t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY
  t.table_name
ORDER BY
  t.table_name;
```

**Compartilhe a saída para eu ver o estado atual.**

---

## 🏗️ SCHEMA NECESSÁRIO PARA 5K USUÁRIOS

### Tabela: `users` (MODIFICAR)

```sql
-- Adicionar coluna role à tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'support'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Índices para performance em 5k+ usuários
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
```

### Tabela: `agents` (CRIAR/VERIFICAR)

```sql
CREATE TABLE IF NOT EXISTS agents (
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

CREATE INDEX IF NOT EXISTS idx_agents_is_published ON agents(is_published);
CREATE INDEX IF NOT EXISTS idx_agents_created_by ON agents(created_by);
```

### Tabela: `agent_materials` (CRIAR/VERIFICAR)

```sql
CREATE TABLE IF NOT EXISTS agent_materials (
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

CREATE INDEX IF NOT EXISTS idx_agent_materials_agent_id ON agent_materials(agent_id);
```

### Tabela: `admin_audit_logs` (CRIAR - CRÍTICO!)

```sql
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'create_agent', 'update_user_status', 'delete_material', etc
  resource_type TEXT NOT NULL, -- 'agent', 'user', 'material', etc
  resource_id UUID,
  changes JSONB, -- { old: {...}, new: {...} }
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);
```

---

## 👥 ROLES & PERMISSIONS (RBAC)

### User Roles

| Role | Acesso | Função |
|------|--------|--------|
| `user` | `/dashboard/*` | Chat, documentos, contexto |
| `admin` | `/admin/*` | Criar/editar agents, materials, users |
| `support` | `/admin/users`, `/admin/agents` (read-only) | Ver usuários, agents (sem editar) |

### Middleware de Proteção

```typescript
// middleware.ts
const adminRoutes = ['/admin']
const supportRoutes = ['/admin/users', '/admin/agents'] // read-only

export async function middleware(request: NextRequest) {
  const user = await getUser() // from auth

  if (adminRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    if (user?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (supportRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    if (user?.role !== 'admin' && user?.role !== 'support') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}
```

---

## 🎯 ADMIN INTERFACE SPECIFICATION

### Estrutura de Rotas

```
/admin
├── /dashboard              [Stats: usuários, agents, activity]
├── /users                  [Listar, filtrar, status, bloqueadores]
├── /agents                 [CRUD agents + materials]
│   └── /[id]/edit         [Editar agent + materials]
└── /logs                   [Audit logs - read-only]
```

---

## 📊 DASHBOARD ADMIN

### Stats Críticas (para 5k usuários)

```
┌─────────────────────────────────────────┐
│ Usuários Ativos: 1.245 / 5.000         │
│ Agentes Publicados: 3                   │
│ Total de Conversas (últimos 7 dias): 847│
│ Mensagens por segundo (now): 2.3        │
│ Status: 🟢 HEALTHY                      │
└─────────────────────────────────────────┘

Últimas Ações Admin:
  14:32 - Admin criou agent "Diretor de Vendas"
  14:20 - Admin bloqueou user@spam.com
  14:15 - Admin adicionou material a agent
```

---

## 👤 GERENCIAMENTO DE USUÁRIOS

### Listagem de Usuários

```
Email                      | Status    | Role    | Último Login | Ações
bruno@manual.com.br        | active    | admin   | 14:35        | [Edit] [Block]
gabriel@manual.com.br      | active    | admin   | 13:20        | [Edit] [Block]
student1@example.com       | active    | user    | 12:50        | [Edit] [Block]
student2@example.com       | inactive  | user    | 2 days ago   | [Edit] [Unblock]
spammer@bad.com            | suspended | user    | 1 week ago   | [Edit] [Delete]
```

### Ações Disponíveis
- ✅ Ativar / Desativar usuário
- ✅ Bloquear / Desbloquear
- ✅ Deletar (com confirmação)
- ✅ Mudar role (user → admin, etc)
- ✅ Ver último login
- ✅ Reset de dados (futuro)

---

## 🤖 AGENT CRUD ADMIN

### Criar/Editar Agent

```
Nome do Agent *
[Diretor Comercial________________]

Descrição
[_________________________________]

System Prompt *
[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]
[Você é um especialista em...     ]
[com 15+ anos de experiência...  ]
[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]

Status:
 ● Publicado   ○ Rascunho   ○ Beta

[+ Adicionar Material]

Lista de Materiais:
  1. 📄 "GTM 2025.pdf" (2.3MB)          [↑] [↓] [✕]
  2. 📝 "Estratégia de vendas"          [↑] [↓] [✕]

[Salvar Agent] [Deletar Agent]
```

---

## 🚀 IMPLEMENTAÇÃO (10 DIAS)

### FASE 1: Schema + Segurança (1 dia)
- [ ] Executar migrações SQL (role, status, indices)
- [ ] Criar tabela `admin_audit_logs`
- [ ] Criar tabela `agents` + `agent_materials`
- [ ] Testar índices (performance check)

### FASE 2: Middleware + Auth (1 dia)
- [ ] Implementar RBAC middleware
- [ ] Atualizar função `getUser()` para carregar role
- [ ] Proteger rotas `/admin/*`
- [ ] Testar acesso por role

### FASE 3: Admin Dashboard (2 dias)
- [ ] Layout admin com sidebar
- [ ] Dashboard com stats (queries otimizadas)
- [ ] Listagem de usuários (pagination)
- [ ] Filtros: status, role, search
- [ ] Ações: ativar/bloquear usuários

### FASE 4: Agent CRUD (2 dias)
- [ ] Listar agents
- [ ] Criar agent (form)
- [ ] Editar agent
- [ ] Deletar agent
- [ ] Material upload/delete

### FASE 5: Integração + Testes (2 dias)
- [ ] Agents dinâmicos no chat
- [ ] Materiais injetados no prompt
- [ ] Testes com 5k usuários (load test)
- [ ] Ajustes de performance

### FASE 6: Deploy + Monitoring (2 dias)
- [ ] Setup Vercel + produção
- [ ] Monitorar logs
- [ ] Health checks
- [ ] Rollback plan

**Total: 10 dias** ✅ (apertado mas viável)

---

## ⚡ OPTIMIZAÇÕES CRÍTICAS PARA 5K USUÁRIOS

### 1. Database Queries
```typescript
// ❌ RUIM: N+1 problem
const users = await supabase.from('users').select('*')
for (const user of users) {
  const conversations = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', user.id)
}

// ✅ BOM: Join / batch
const { data } = await supabase.from('users').select(`
  id, email, role, status,
  conversations(count)
`)
```

### 2. Pagination (OBRIGATÓRIO)
```typescript
// Sempre com limit + offset
const { data, count } = await supabase
  .from('users')
  .select('*', { count: 'exact' })
  .range(0, 49) // 50 per page
```

### 3. Caching (Redis/Vercel KV)
```typescript
// Cache dashboard stats por 5 minutos
const stats = await cache.get('admin:stats')
if (!stats) {
  stats = await calculateStats()
  await cache.set('admin:stats', stats, 300) // 5 min
}
```

### 4. Indices Críticas
```sql
-- Users
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Conversations
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- Messages
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
```

---

## 🔐 SEGURANÇA PARA PRODUÇÃO

### Rate Limiting (crítico!)
```typescript
// Limitar requests por IP
const rateLimit = require('express-rate-limit')
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
})
```

### Audit Logs (obrigatório!)
```typescript
// Toda ação admin registra
async function createAgent(agent, adminId) {
  // criar agent

  // registrar em audit
  await supabase.from('admin_audit_logs').insert({
    admin_id: adminId,
    action: 'create_agent',
    resource_type: 'agent',
    resource_id: agent.id,
    changes: { new: agent },
  })
}
```

---

## 📊 NEXT STEPS IMEDIATOS

1. **Execute o schema check** → me compartilhe a saída
2. **Responda:**
   - Quantos admins você vai ter? (Gabriel + Bruno? Mais?)
   - Precisa de "support" role além de admin?
   - Tem API externa pra alimentar dados de usuários? (CSV, Google Sheets, etc)

3. **Depois:** Começo o admin interface (FASE 1-2 hoje se possível)

---

## ⏰ TIMELINE CRÍTICA

```
Hoje (04/04)      → Schemas + Middleware
Amanhã (05/04)    → Admin Dashboard + Users
07/04             → Agent CRUD + Materials
08/04             → Integração + Testes
09/04             → Deploy + Monitoring
14/04             → 🚀 LANÇAMENTO
```

**Isso é APERTADO. Preciso que você:**
- Execute as queries de schema hoje
- Valide o plano com seu cliente HOJE
- Autorize "go/no-go" para começar admin

Tá pronto? 🚀
