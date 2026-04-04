-- Debug: See what constraints exist
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'documents'
ORDER BY constraint_name;

-- Drop the old constraint (if it exists)
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_file_type_check CASCADE;

-- Create new constraint that accepts all file types
ALTER TABLE documents
ADD CONSTRAINT documents_file_type_check
CHECK (file_type IN ('pdf', 'csv', 'xlsx', 'xls', 'docx', 'doc'));

-- Verify it's there
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'documents' AND constraint_type = 'CHECK';
