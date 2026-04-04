-- ADMIN SETUP SQL
-- Execute no Supabase SQL Editor

-- 1. Adicionar coluna status se não existir
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));

-- 2. Marcar os 2 admins (execute DEPOIS de confirmar os UUIDs)
-- Primeiro, encontre os UUIDs desses emails:
SELECT id, email, role FROM auth.users WHERE email IN ('bruno@danxa.com.br', 'gabriel.b@manualdedonos.com.br');

-- 3. Depois de copiar os UUIDs, execute:
-- UPDATE auth.users SET role = 'admin' WHERE email = 'bruno@danxa.com.br';
-- UPDATE auth.users SET role = 'admin' WHERE email = 'gabriel.b@manualdedonos.com.br';

-- 4. Criar índices para performance (5k usuários)
CREATE INDEX IF NOT EXISTS idx_users_role ON auth.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON auth.users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON auth.users(created_at DESC);

-- 5. Verificar resultado
SELECT email, role, status FROM auth.users WHERE role = 'admin';
