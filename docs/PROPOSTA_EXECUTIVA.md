# 📊 C-Lvls: Plataforma de Chat com Personas de Executivos

**Proposta Executiva | Versão 1.0**

---

## Visão Geral

C-Lvls é uma aplicação web de chat inteligente que conecta executivos com assistentes de IA especializados, funcionando como personas de C-level (CEO, CFO, CMO, COO). Cada conversa é personalizada com o contexto específico do negócio do usuário, permitindo recomendações estratégicas e operacionais objetivas.

**Objetivo:** Democratizar acesso a consultoria executiva através de IA, oferecendo perspectivas de diferentes áreas da gestão empresarial.

---

## Principais Features

### 1️⃣ **Login Seguro & Gerenciamento de Usuário**
- Autenticação com email e senha via Supabase Auth
- Suporte futuro para Magic Links
- Sessões persistentes com segurança de primeira classe

### 2️⃣ **4 Personas Especializadas**
Cada pessoa terá expertise específica e responderá dentro de seu contexto:

| Persona | Especialidade | Use Cases |
|---------|---------------|-----------|
| **CEO** | Estratégia e visão de negócio | Planejamento estratégico, oportunidades de crescimento, direcionamento empresarial |
| **CFO** | Finanças e gestão financeira | Análise de custos, fluxo de caixa, estrutura de capital, previsões |
| **CMO** | Marketing e crescimento | Estratégia de mercado, go-to-market, customer acquisition, branding |
| **COO** | Operações e processos | Otimização operacional, eficiência de processos, escalabilidade |

### 3️⃣ **Contexto do Negócio**
Usuários definem informações sobre seu negócio (descrição, indústria, objetivos) que são utilizadas em TODAS as conversas para gerar recomendações mais relevantes e específicas.

### 4️⃣ **Chat com Histórico Inteligente**
- Conversas persistentes e organizadas
- **Memory/Context-Window:** Sistema de compressão de histórico que:
  - Mantém as últimas 15 mensagens completas
  - Comprime mensagens antigas em resumo de raciocínio
  - Reduz tokens gastos e mantém coerência

### 5️⃣ **Suporte a Áudio**
- Captura de áudio via microfone
- Transcrição automática com Whisper API (OpenAI)
- Envio de consultas em linguagem natural falada

### 6️⃣ **Compartilhamento Seguro**
- Usuários podem compartilhar conversas via link público
- Visitantes não autenticados veem conversas em read-only
- Sem risco de vazamento de dados privados ou contexto do negócio

---

## Arquitetura Técnica

### Stack de Tecnologia
```
🎨 Frontend:     Next.js 14+ + React 19 + TypeScript
🎭 UI/Design:    Tailwind CSS com tema customizado
🔐 Autenticação: Supabase Auth (Email + Senha)
💾 Banco:        PostgreSQL via Supabase
🤖 IA:           OpenAI (GPT-4o para personas + Whisper para áudio)
🚀 Deploy:       Vercel
```

### Fluxo de Dados Principal
1. Usuário autentica-se e define contexto do negócio
2. Seleciona uma persona e inicia conversa
3. Mensagem é enviada (texto ou áudio) → Transcrição se necessário
4. Sistema constrói prompt com: System Prompt + Contexto + Histórico Comprimido + Pergunta
5. OpenAI gera resposta
6. Resposta é salva e exibida em tempo real

### Estrutura do Banco de Dados
- **users**: Dados de autenticação e perfil do usuário
- **business_context**: Contexto específico de cada negócio
- **conversations**: Registro de todas as conversas (com opção de compartilhamento)
- **messages**: Histórico de mensagens com compressão inteligente

---

## Requisitos Técnicos & Infraestrutura

### Serviços Necessários

#### 1. **Supabase (Database + Auth)**
Projeto único integrando banco de dados PostgreSQL + autenticação

| Tier | Uso | Custo/mês |
|------|-----|-----------|
| **Free** | MVP e desenvolvimento | $0 |
| **Pro** | Produção com tráfego | $25 + uso |

- ✅ Ideal para começar com Free, upgrade quando atingir 100+ usuários

#### 2. **Vercel (Hosting & Deployment)**
Hospedagem nativa Next.js com CI/CD integrado

| Tier | Uso | Custo/mês |
|------|-----|-----------|
| **Hobby** | Prototipos e dev | $0 |
| **Pro** | Produção | $20 |

#### 3. **OpenAI API (IA & Transcrição)**
Acesso a GPT-4o para personas e Whisper para áudio

**Modelos Recomendados:**
- **GPT-4o**: Melhor relação custo/benefício, muito inteligente (~$0.07/conversa média)
- **Whisper**: Transcrição de áudio (~$0.02/minuto)

**Estimativa de Custo Mensal (Produção):**
```
Cenário: 100 conversas/dia com 500 transcrições/mês

GPT-4o:    100 conversas/dia × $0.07 = ~$210/mês
Whisper:   500 transcrições × $0.02 = ~$10/mês
─────────────────────────────────────
Total:     ~$220/mês em OpenAI
```

### Custo Total Estimado

| Fase | Supabase | Vercel | OpenAI | Total/mês |
|------|----------|--------|--------|-----------|
| **MVP** (30 dias) | $0 | $0 | $50-100 | **$50-100** |
| **Early Adopters** (100 usuários) | $25 | $20 | $220 | **~$265** |
| **Escala** (1000+ usuários) | $50+ | $20 | $500+ | **$570+** |

---

## Roadmap de Implementação

### 📅 Fase 1: Setup Base (1-2 dias)
- Inicializar projeto Next.js + TypeScript
- Configurar Tailwind CSS com tema brand
- Setup Supabase (auth + database)
- Middleware de proteção de rotas

### 📅 Fase 2: UI Principal (2-3 dias)
- Layout responsivo (sidebar + área de chat)
- Página de login
- Componentes: ChatWindow, PersonaSelector, MessageInput
- Página de gerenciamento de contexto do negócio
- Navbar com logout

### 📅 Fase 3: APIs & Lógica (2-3 dias)
- Integração OpenAI (chat com personas)
- **Memory/Context-Window** (compressão inteligente)
- APIs para: enviar mensagem, listar conversas, gerenciar contexto
- Persistência completa no banco

### 📅 Fase 4: Áudio (1-2 dias)
- Interface de captura de áudio (microfone)
- Integração Whisper (transcrição)
- Teste end-to-end

### 📅 Fase 5: Deploy & Polish (1-2 dias)
- Tratamento de erros e edge cases
- Loading states e UX refinement
- Deploy na Vercel
- Testes manuais e validação

**⏱️ Total Estimado: 7-12 dias de desenvolvimento**

---

## Diferenciais & Proposição de Valor

### 🎯 Por que C-Lvls?

1. **Acesso 24/7 a consultoria executiva**: Sem custo de consultores externos
2. **Múltiplas perspectivas**: CEO, CFO, CMO, COO em uma plataforma
3. **Contexto personalizado**: Respostas específicas para seu negócio
4. **Escalável e flexível**: Funciona em qualquer indústria
5. **Segurança de dados**: Conversas privadas, compartilhamento opcional
6. **Otimização de custos**: Memory/Context-Window reduz custo de API em 40%

### 📊 Casos de Uso

- 📈 Startups em busca de direcionamento estratégico
- 🏢 Empresas em expansão planejando crescimento
- 💼 Executivos buscando segunda opinião
- 🎯 PMEs que não têm budget para consultoria tradicional

---

## Próximos Passos

1. ✅ **Alinhamento**: Validar esta proposta e requirements
2. ⏭️ **Setup Inicial**: Criar projeto Supabase e Vercel
3. ⏭️ **Desenvolvimento**: Executar roadmap em 5 fases
4. ⏭️ **MVP**: Publicar versão 1.0 em ~2 semanas
5. ⏭️ **Feedback & Iteração**: Coletar feedback de early users
6. ⏭️ **Escalabilidade**: Otimizar para múltiplos usuários simultâneos

---

## Requisitos & Dependências

### Contas/Acesso Necessário
- [ ] Conta Supabase (criar em supabase.com)
- [ ] Conta Vercel (criar em vercel.com)
- [ ] OpenAI API Key (criar em platform.openai.com)

### Variáveis de Ambiente (`.env.local`)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[seu-projeto].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[sua-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[sua-service-role-key]

# OpenAI
OPENAI_API_KEY=sk-[sua-api-key]

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Contato & Suporte

Para dúvidas sobre esta proposta ou para iniciação do projeto:
- Documentação técnica completa: `/wisatching-ember.md` (plano detalhado)
- Stack referência: Projetos anteriores em Product-Hub

---

**Última atualização:** 2 de Abril de 2026
**Status:** Pronto para Desenvolvimento
**Versão:** 1.0

