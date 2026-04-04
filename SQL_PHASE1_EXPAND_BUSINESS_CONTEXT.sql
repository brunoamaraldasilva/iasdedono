-- FASE 1: Expandir tabela business_context existente
-- Esta é uma migração segura que mantém dados existentes

-- 1. Adicionar colunas faltantes à tabela business_context
ALTER TABLE business_context
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS annual_revenue DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS team_size INTEGER,
ADD COLUMN IF NOT EXISTS founded_year INTEGER,
ADD COLUMN IF NOT EXISTS main_goals TEXT[], -- Array de goals
ADD COLUMN IF NOT EXISTS main_challenges TEXT[], -- Array de desafios
ADD COLUMN IF NOT EXISTS target_market TEXT,
ADD COLUMN IF NOT EXISTS main_competitors TEXT,
ADD COLUMN IF NOT EXISTS additional_info JSONB,
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_business_context_user_id ON business_context(user_id);
CREATE INDEX IF NOT EXISTS idx_business_context_is_completed ON business_context(is_completed);
CREATE INDEX IF NOT EXISTS idx_business_context_completion_percentage ON business_context(completion_percentage);

-- 3. Criar função para calcular completion_percentage automaticamente
CREATE OR REPLACE FUNCTION calculate_business_context_completion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.completion_percentage :=
    (COALESCE(CASE WHEN NEW.business_name IS NOT NULL THEN 1 ELSE 0 END, 0) +
     COALESCE(CASE WHEN NEW.business_type IS NOT NULL THEN 1 ELSE 0 END, 0) +
     COALESCE(CASE WHEN NEW.description IS NOT NULL THEN 1 ELSE 0 END, 0) +
     COALESCE(CASE WHEN NEW.annual_revenue IS NOT NULL THEN 1 ELSE 0 END, 0) +
     COALESCE(CASE WHEN NEW.team_size IS NOT NULL THEN 1 ELSE 0 END, 0) +
     COALESCE(CASE WHEN NEW.main_goals IS NOT NULL AND array_length(NEW.main_goals, 1) > 0 THEN 1 ELSE 0 END, 0) +
     COALESCE(CASE WHEN NEW.main_challenges IS NOT NULL AND array_length(NEW.main_challenges, 1) > 0 THEN 1 ELSE 0 END, 0) +
     COALESCE(CASE WHEN NEW.target_market IS NOT NULL THEN 1 ELSE 0 END, 0)
    ) * 100 / 8;

  NEW.is_completed := NEW.completion_percentage >= 75; -- 75% = completo

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para atualizar completion_percentage
DROP TRIGGER IF EXISTS trigger_calculate_business_context_completion ON business_context;
CREATE TRIGGER trigger_calculate_business_context_completion
  BEFORE INSERT OR UPDATE ON business_context
  FOR EACH ROW
  EXECUTE FUNCTION calculate_business_context_completion();

-- 5. Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_business_context_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_business_context_updated_at ON business_context;
CREATE TRIGGER trigger_update_business_context_updated_at
  BEFORE UPDATE ON business_context
  FOR EACH ROW
  EXECUTE FUNCTION update_business_context_updated_at();

-- 6. Verificação: listar estrutura final da tabela
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM
  information_schema.columns
WHERE
  table_name = 'business_context' AND table_schema = 'public'
ORDER BY
  ordinal_position;
