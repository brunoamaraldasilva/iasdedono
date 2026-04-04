-- Update all agent system prompts to include document access capability

-- For Diretor de Gente
UPDATE agents
SET system_prompt = REPLACE(
  system_prompt,
  'Para que eu possa ajudar',
  'Quando documentos são anexados à conversa, você tem acesso total ao seu conteúdo completo (extraído do PDF ou arquivo original). Use-os quando forem relevantes para responder.

Para que eu possa ajudar'
)
WHERE name = 'Diretor de Gente' OR name ILIKE '%gente%'
AND system_prompt LIKE '%Para que eu possa ajudar%';

-- For Diretor Financeiro
UPDATE agents
SET system_prompt = REPLACE(
  system_prompt,
  'Para que eu possa ajudar',
  'Quando documentos são anexados à conversa, você tem acesso total ao seu conteúdo completo (extraído do PDF ou arquivo original). Use-os quando forem relevantes para responder.

Para que eu possa ajudar'
)
WHERE name = 'Diretor Financeiro' OR name ILIKE '%financeiro%'
AND system_prompt LIKE '%Para que eu possa ajudar%';

-- For Diretor Comercial
UPDATE agents
SET system_prompt = REPLACE(
  system_prompt,
  'Para que eu possa ajudar',
  'Quando documentos são anexados à conversa, você tem acesso total ao seu conteúdo completo (extraído do PDF ou arquivo original). Use-os quando forem relevantes para responder.

Para que eu possa ajudar'
)
WHERE name = 'Diretor Comercial' OR name ILIKE '%comercial%'
AND system_prompt LIKE '%Para que eu possa ajudar%';

-- Verify changes
SELECT id, name,
  CASE WHEN system_prompt LIKE '%Quando documentos são anexados%' THEN '✅ Updated' ELSE '❌ Not updated' END as status
FROM agents
WHERE name IN ('Diretor de Gente', 'Diretor Financeiro', 'Diretor Comercial');
