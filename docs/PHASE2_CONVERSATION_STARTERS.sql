-- ============================================================================
-- ADD CONVERSATION STARTERS TO AGENTS TABLE
-- ============================================================================
-- Purpose: Allow admins to define conversation starter suggestions for each agent
-- Structure: JSONB array of text strings
-- Example: ["Como posso aumentar minhas vendas?", "Qual é meu maior desafio?"]

-- Add column if it doesn't exist
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS conversation_starters TEXT[] DEFAULT '{}';

-- Example data migration (uncomment to populate):
-- UPDATE agents SET conversation_starters = ARRAY[
--   'Como posso aumentar minhas vendas?',
--   'Qual é meu maior desafio de crescimento?',
--   'Como melhorar a margem de lucro?'
-- ] WHERE name = 'Diretor Comercial';

-- Verify
-- SELECT id, name, conversation_starters FROM agents;
