-- Final migration to ensure business_context has all required columns
-- This is safe to run multiple times (uses IF NOT EXISTS patterns)

-- Step 1: Add missing columns if they don't exist
ALTER TABLE business_context
ADD COLUMN IF NOT EXISTS business_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS annual_revenue NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS founded_year INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS main_goals TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS main_challenges TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS target_market TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS main_competitors TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS additional_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;

-- Step 2: Create a function to calculate completion_percentage
CREATE OR REPLACE FUNCTION calculate_context_completion()
RETURNS TRIGGER AS $$
DECLARE
  completed_fields INTEGER := 0;
  total_fields INTEGER := 11; -- Number of key fields
BEGIN
  -- Count non-null key fields
  IF NEW.business_name IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.business_type IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.description IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.industry IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.main_goals IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.main_challenges IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.target_market IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.team_size IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.annual_revenue IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.founded_year IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.main_competitors IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;

  -- Calculate percentage
  NEW.completion_percentage := ROUND((completed_fields::NUMERIC / total_fields::NUMERIC) * 100)::INTEGER;

  -- Set is_completed if >= 75%
  IF NEW.completion_percentage >= 75 THEN
    NEW.is_completed := TRUE;
  ELSE
    NEW.is_completed := FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop existing trigger if it exists (safe because of DROP IF EXISTS)
DROP TRIGGER IF EXISTS trigger_calculate_context_completion ON business_context;

-- Step 4: Create trigger to auto-calculate on insert/update
CREATE TRIGGER trigger_calculate_context_completion
BEFORE INSERT OR UPDATE ON business_context
FOR EACH ROW
EXECUTE FUNCTION calculate_context_completion();

-- Step 5: Recalculate completion_percentage for existing records
UPDATE business_context
SET completion_percentage = (
  SELECT ROUND((
    (
      (CASE WHEN business_name IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN business_type IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN description IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN industry IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN main_goals IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN main_challenges IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN target_market IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN team_size IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN annual_revenue IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN founded_year IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN main_competitors IS NOT NULL THEN 1 ELSE 0 END)
    )::NUMERIC / 11.0
  ) * 100)::INTEGER
);

-- Verify the schema
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'business_context'
ORDER BY ordinal_position;
