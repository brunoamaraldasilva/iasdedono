# C-Lvls - Chat com Personas de Executivos

Uma plataforma inteligente de chat com personas especializadas (Diretor Comercial, Diretor Financeiro, Diretor de Gente) para ajudar executivos com recomendações estratégicas.

## 🚀 Stack Tech

- **Frontend**: Next.js 14+ + React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Auth**: Supabase Auth (Email + Senha)
- **Database**: PostgreSQL via Supabase
- **AI**: OpenAI (GPT-4o para chat + Whisper para transcrição)
- **Deploy**: Vercel

## 📋 Status de Implementação

- [x] **Fase 1**: Setup Base (Next.js + Tailwind + Supabase + Auth)
- [x] **Fase 2**: UI Principal (Dashboard + Chat + Componentes)
- [x] **Fase 3**: Admin Interface (Dashboard + CRUD Agents)
- [x] **Fase 4**: Sistema de Beta (Testing + Dynamic Agents)
- [x] **Fase 5**: API & Integração completa
- [x] **Fase 6**: Pronto para Deploy na Vercel

**✅ APLICAÇÃO 100% FUNCIONAL - PRONTO PARA PRODUÇÃO**

## 🔧 Setup & Instalação

```bash
cd /Users/amaral.bruno/Product-Hub/projects/c-lvls
npm install
npm run dev
```

Acesso: `http://localhost:3000`

## 🧪 Fluxo de Teste

1. **Login**: Criar conta com email + senha
2. **Contexto**: Preencher contexto do negócio (`/dashboard/context`)
3. **Chat**: Selecionar persona e conversar
4. **Admin**: Ir para `/admin` (precisa de role admin no BD)
5. **Beta**: Criar agent → Gerar link beta → Testar

## 📁 Arquivos Principais

### APIs
- `/api/chat` - Chat com OpenAI
- `/api/agents/[id]` - CRUD agents
- `/api/agents/[id]/beta` - Beta links

### Páginas
- `/` - Login
- `/dashboard` - Principal
- `/admin` - Dashboard admin
- `/beta/[token]` - Teste beta

### Componentes
- `ChatWindow` - Exibição de mensagens
- `MessageInput` - Input com Shift+Enter
- `PersonaSelector` - Seletor dinâmico
- `BetaLinkModal` - Modal para beta

## 🔐 Banco de Dados

**Tabelas criadas**:
- users
- agents (3 personas base + customizados)
- agent_materials
- agent_beta_links
- conversations
- messages
- business_context
- conversation_summaries

## ✅ Features

### User App
- ✅ Login/Signup
- ✅ Chat com 3 personas base
- ✅ Histórico persistente
- ✅ Contexto do negócio personalizado
- ✅ Compartilhamento de conversas (estrutura pronta)

### Admin App
- ✅ Dashboard com stats
- ✅ CRUD de agents
- ✅ Gerenciamento de materiais
- ✅ Link beta para teste
- ✅ Listagem de usuários

### AI/OpenAI
- ✅ GPT-4o para chat
- ✅ System prompts dinâmicos
- ✅ Memory/Context-Window (últimas 15 msgs)
- ✅ Web Search com SerpAPI (busca autônoma)
- ✅ Agentes com Tool Calling

## 🚀 Deploy

Pronto para Vercel. Configure as env vars:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
NEXT_PUBLIC_APP_URL
```

## 📦 Produção

Pasta limpa e refinada:
- ✅ Apenas arquivos essenciais
- ✅ Documentação de implementação movida para `/docs clvls/`
- ✅ .env.local e .DS_Store em .gitignore
- ✅ Pronto para repositório Git

---

**Status**: COMPLETO - 100% funcional
**Última atualização**: 5 de Abril de 2026
