-- Add support for XLSX and DOCX file types
-- Drop the old constraint that only allows pdf and csv
-- Add new constraint that allows all supported file types

-- Step 1: Drop the old constraint
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_file_type_check;

-- Step 2: Add new constraint that allows all file types
ALTER TABLE documents
ADD CONSTRAINT documents_file_type_check
CHECK (file_type IN ('pdf', 'csv', 'xlsx', 'xls', 'docx', 'doc'));

-- Verify the constraint was added
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'documents';
