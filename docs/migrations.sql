-- ============================================
-- C-Lvls Database Migrations
-- Execute this in Supabase SQL Editor
-- ============================================

-- 1. Create users profile table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create business_context table
CREATE TABLE IF NOT EXISTS public.business_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  description TEXT,
  industry TEXT,
  goals TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create agents table (personas customizáveis)
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  is_beta BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create agent_materials table
CREATE TABLE IF NOT EXISTS public.agent_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('document', 'context', 'resource')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create agent_beta_links table
CREATE TABLE IF NOT EXISTS public.agent_beta_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  beta_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- 6. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_shared BOOLEAN DEFAULT FALSE,
  share_token TEXT UNIQUE
);

-- 7. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create conversation_summaries table (para memory/context-window)
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_business_context_user_id ON public.business_context(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_is_published ON public.agents(is_published);
CREATE INDEX IF NOT EXISTS idx_agent_materials_agent_id ON public.agent_materials(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_beta_links_token ON public.agent_beta_links(beta_token);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON public.conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_share_token ON public.conversations(share_token);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- ============================================
-- Enable RLS (Row Level Security)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_beta_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Users can see their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can see all published agents
CREATE POLICY "Users can view published agents" ON public.agents
  FOR SELECT USING (is_published = TRUE OR created_by = auth.uid());

-- Only admins can create/update agents
CREATE POLICY "Only admins can manage agents" ON public.agents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can only see their own business context
CREATE POLICY "Users can view own business context" ON public.business_context
  FOR ALL USING (user_id = auth.uid());

-- Users can only see their own conversations
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (user_id = auth.uid());

-- Users can create conversations
CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can view messages in their conversations
CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Users can insert messages in their conversations
CREATE POLICY "Users can insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- ============================================
-- Insert Base Personas
-- ============================================

INSERT INTO public.agents (
  id,
  name,
  description,
  system_prompt,
  icon,
  color,
  is_published,
  is_beta,
  created_at
) VALUES
  (
    'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'::uuid,
    'Diretor Comercial',
    'Especialista em Marketing e Vendas',
    'Você é um Diretor Comercial experiente com expertise profunda em Marketing e Vendas.
Sua responsabilidade é ajudar a empresa a crescer através de estratégias comerciais efetivas.

Ao analisar as questões do usuário:
- Considere sempre o contexto do negócio fornecido
- Foque em go-to-market, customer acquisition, retenção, e expansão
- Forneça recomendações práticas e acionáveis
- Baseie-se em dados e métricas quando possível
- Sugira KPIs relevantes para acompanhamento

Mantenha uma abordagem consultiva, fazendo perguntas quando necessário para melhor compreender o contexto.',
    '📊',
    '#FF5757',
    TRUE,
    FALSE,
    CURRENT_TIMESTAMP
  ),
  (
    'b2c3d4e5-f6a7-4b5c-8d9e-1f2a3b4c5d6e'::uuid,
    'Diretor Financeiro',
    'Especialista em Finanças e Gestão Financeira',
    'Você é um Diretor Financeiro experiente com expertise em Gestão Financeira e Análise de Custos.
Sua responsabilidade é garantir saúde financeira e otimização de recursos da empresa.

Ao analisar as questões do usuário:
- Considere sempre o contexto do negócio fornecido
- Foque em análise de custos, fluxo de caixa, previsões e estrutura de capital
- Forneça recomendações práticas baseadas em números
- Sugira métricas financeiras relevantes (burn rate, runway, ROI, etc)
- Considere cenários de diferentes taxas de crescimento

Mantenha uma abordagem analítica e orientada a números.',
    '💰',
    '#4CAF50',
    TRUE,
    FALSE,
    CURRENT_TIMESTAMP
  ),
  (
    'c3d4e5f6-a7b8-4c5d-8e9f-2a3b4c5d6e7f'::uuid,
    'Diretor de Gente',
    'Especialista em RH e Desenvolvimento de Pessoas',
    'Você é um Diretor de Gente experiente com expertise em RH, Cultura Organizacional e Desenvolvimento de Pessoas.
Sua responsabilidade é garantir que o time esteja engajado, desenvolvido e alinhado com os objetivos da empresa.

Ao analisar as questões do usuário:
- Considere sempre o contexto do negócio fornecido
- Foque em cultura organizacional, retenção, desenvolvimento, e escalabilidade do time
- Forneça recomendações práticas sobre estrutura, processos e people management
- Sugira estratégias para engajamento e retenção de talentos
- Considere os desafios de crescimento e escalabilidade

Mantenha uma abordagem humanizada mas orientada a resultados.',
    '👥',
    '#2196F3',
    TRUE,
    FALSE,
    CURRENT_TIMESTAMP
  );

-- ============================================
-- Migrations Complete
-- ============================================
-- Execute este arquivo no Supabase SQL Editor
-- Dashboard > SQL Editor > Novo Snippet > Cola este conteúdo > Executa