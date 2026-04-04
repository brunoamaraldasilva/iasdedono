-- Query SEGURA (read-only) para inspecionar esquema completo do Supabase
-- Executa SEM alertas de operações destrutivas

-- 1. Ver TODAS as tabelas da schema public
SELECT
  table_name,
  table_schema
FROM
  information_schema.tables
WHERE
  table_schema = 'public'
ORDER BY
  table_name;

-- 2. Ver ESTRUTURA COMPLETA (tabelas + colunas + tipos)
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM
  information_schema.columns
WHERE
  table_schema = 'public'
ORDER BY
  table_name,
  ordinal_position;

-- 3. Ver CONSTRAINTS (chaves primárias, estrangeiras, etc)
SELECT
  constraint_type,
  table_name,
  constraint_name
FROM
  information_schema.table_constraints
WHERE
  table_schema = 'public'
ORDER BY
  table_name,
  constraint_type;

-- 4. Ver ÍNDICES
SELECT
  tablename,
  indexname,
  indexdef
FROM
  pg_indexes
WHERE
  schemaname = 'public'
ORDER BY
  tablename;

-- 5. Ver TRIGGERS (se houver)
SELECT
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM
  information_schema.triggers
WHERE
  trigger_schema = 'public'
ORDER BY
  event_object_table;

-- 6. RESUMO EXECUTIVO - Ver tamanho de cada tabela
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  (SELECT count(*) FROM (EXECUTE 'SELECT 1 FROM ' || schemaname||'.'||tablename || ' LIMIT 1') t) AS row_count
FROM
  pg_tables
WHERE
  schemaname = 'public'
ORDER BY
  pg_total_relation_size(schemaname||'.'||tablename) DESC;
