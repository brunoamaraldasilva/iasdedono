-- ADD STATUS COLUMN TO USERS TABLE
-- Execute no Supabase SQL Editor

-- 1. Adicionar coluna status à tabela public.users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
CHECK (status IN ('active', 'inactive', 'suspended'));

-- 2. Criar índice para performance (5k usuários)
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- 3. Verificar resultado
SELECT email, role, status FROM public.users LIMIT 5;
