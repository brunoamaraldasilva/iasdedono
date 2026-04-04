-- Get complete database schema overview
-- Execute this in Supabase SQL Editor to see all tables and their columns

SELECT
  t.table_name,
  STRING_AGG(
    c.column_name || ' (' || c.data_type ||
    CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE ' nullable' END ||
    CASE WHEN c.column_default IS NOT NULL THEN ', default: ' || c.column_default ELSE '' END || ')',
    E'\n  - '
    ORDER BY c.ordinal_position
  ) as columns,
  COUNT(c.column_name) as column_count
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

-- Also check for Foreign Keys
SELECT
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM
  information_schema.key_column_usage
WHERE
  table_schema = 'public'
  AND referenced_table_name IS NOT NULL
ORDER BY
  table_name;
