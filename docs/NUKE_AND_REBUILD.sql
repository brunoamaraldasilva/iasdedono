-- NUCLEAR OPTION: Drop all old triggers/functions and rebuild cleanly

-- Step 1: DROP OLD TRIGGER AND FUNCTION (different names!)
DROP TRIGGER IF EXISTS trigger_calculate_business_context_completion ON business_context;
DROP TRIGGER IF EXISTS trigger_calculate_context_completion ON business_context;
DROP FUNCTION IF EXISTS calculate_business_context_completion() CASCADE;
DROP FUNCTION IF EXISTS calculate_context_completion() CASCADE;

-- Step 2: Convert array columns to TEXT (safe conversion)
ALTER TABLE business_context
ALTER COLUMN main_goals TYPE TEXT USING COALESCE(main_goals::text, NULL);

ALTER TABLE business_context
ALTER COLUMN main_challenges TYPE TEXT USING COALESCE(main_challenges::text, NULL);

-- Step 3: Ensure all columns exist
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

-- Step 4: Create NEW clean trigger function
CREATE FUNCTION calculate_context_completion()
RETURNS TRIGGER AS $$
DECLARE
  completed_fields INTEGER := 0;
BEGIN
  -- Count non-null and non-empty fields (11 total)
  IF NEW.business_name IS NOT NULL AND TRIM(COALESCE(NEW.business_name, '')) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.business_type IS NOT NULL AND TRIM(COALESCE(NEW.business_type, '')) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.description IS NOT NULL AND TRIM(COALESCE(NEW.description, '')) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.industry IS NOT NULL AND TRIM(COALESCE(NEW.industry, '')) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.main_goals IS NOT NULL AND TRIM(COALESCE(NEW.main_goals, '')) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.main_challenges IS NOT NULL AND TRIM(COALESCE(NEW.main_challenges, '')) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.target_market IS NOT NULL AND TRIM(COALESCE(NEW.target_market, '')) != '' THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.team_size IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.annual_revenue IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.founded_year IS NOT NULL THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.main_competitors IS NOT NULL AND TRIM(COALESCE(NEW.main_competitors, '')) != '' THEN completed_fields := completed_fields + 1; END IF;

  -- Calculate percentage
  NEW.completion_percentage := ROUND((completed_fields::NUMERIC / 11.0) * 100)::INTEGER;

  -- Set is_completed
  NEW.is_completed := (NEW.completion_percentage >= 75);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger with SAME name as function
CREATE TRIGGER trigger_calculate_context_completion
BEFORE INSERT OR UPDATE ON business_context
FOR EACH ROW
EXECUTE FUNCTION calculate_context_completion();

-- Step 6: Recalculate all existing records
UPDATE business_context SET updated_at = NOW();

-- Step 7: Verify it worked
SELECT COUNT(*) as total_records,
       COUNT(CASE WHEN completion_percentage > 0 THEN 1 END) as with_completion,
       COUNT(CASE WHEN is_completed THEN 1 END) as fully_completed
FROM business_context;
