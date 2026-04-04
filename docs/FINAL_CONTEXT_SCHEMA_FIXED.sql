-- CORRECTED: Final migration for business_context table
-- Simpler approach that works reliably
-- Safe to run multiple times

-- Step 1: Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_calculate_context_completion ON business_context;
DROP FUNCTION IF EXISTS calculate_context_completion() CASCADE;

-- Step 2: Ensure columns exist and are TEXT type (not arrays)
-- First, check and convert any array columns to TEXT
ALTER TABLE business_context
ALTER COLUMN main_goals TYPE TEXT USING COALESCE(main_goals::text, NULL);

ALTER TABLE business_context
ALTER COLUMN main_challenges TYPE TEXT USING COALESCE(main_challenges::text, NULL);

-- Step 3: Add any missing columns
ALTER TABLE business_context
ADD COLUMN IF NOT EXISTS business_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS founded_year INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS target_market TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS main_competitors TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS additional_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;

-- Step 4: Create SIMPLE trigger function
CREATE OR REPLACE FUNCTION calculate_context_completion()
RETURNS TRIGGER AS $$
DECLARE
  completed_fields INTEGER := 0;
BEGIN
  -- Count non-null and non-empty fields
  IF NEW.business_name IS NOT NULL AND TRIM(NEW.business_name) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.business_type IS NOT NULL AND TRIM(NEW.business_type) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.description IS NOT NULL AND TRIM(NEW.description) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.industry IS NOT NULL AND TRIM(NEW.industry) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.main_goals IS NOT NULL AND TRIM(NEW.main_goals) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.main_challenges IS NOT NULL AND TRIM(NEW.main_challenges) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.target_market IS NOT NULL AND TRIM(NEW.target_market) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.team_size IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.annual_revenue IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.founded_year IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.main_competitors IS NOT NULL AND TRIM(NEW.main_competitors) != '' THEN completed_fields := completed_fields + 1; END IF;

  -- Calculate percentage (11 fields total)
  NEW.completion_percentage := ROUND((completed_fields::NUMERIC / 11.0) * 100)::INTEGER;

  -- Set is_completed if >= 75%
  NEW.is_completed := (NEW.completion_percentage >= 75);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger
CREATE TRIGGER trigger_calculate_context_completion
BEFORE INSERT OR UPDATE ON business_context
FOR EACH ROW
EXECUTE FUNCTION calculate_context_completion();

-- Step 6: Recalculate all existing records by touching them
-- This will trigger the function on all existing rows
UPDATE business_context
SET updated_at = CURRENT_TIMESTAMP
WHERE TRUE;

-- Step 7: Verify the schema
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_context'
ORDER BY ordinal_position;
