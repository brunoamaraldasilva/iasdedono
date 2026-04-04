-- Fix business_context table: convert array columns to text

-- Change main_goals from TEXT[] to TEXT
ALTER TABLE business_context
ALTER COLUMN main_goals TYPE TEXT USING
  CASE
    WHEN main_goals IS NULL THEN NULL
    WHEN array_length(main_goals, 1) > 0 THEN array_to_string(main_goals, ', ')
    ELSE NULL
  END;

-- Change main_challenges from TEXT[] to TEXT
ALTER TABLE business_context
ALTER COLUMN main_challenges TYPE TEXT USING
  CASE
    WHEN main_challenges IS NULL THEN NULL
    WHEN array_length(main_challenges, 1) > 0 THEN array_to_string(main_challenges, ', ')
    ELSE NULL
  END;

-- Verify the changes
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'business_context'
AND column_name IN ('main_goals', 'main_challenges');
