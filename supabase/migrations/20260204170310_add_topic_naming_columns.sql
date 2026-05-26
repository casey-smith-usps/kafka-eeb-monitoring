/*
  # Add Topic Naming Columns

  1. Changes
    - Add `domain` column to store the domain segment from topic names
    - Add `subdomain` column to store the subdomain segment from topic names
    - Add `dataset` column to store the dataset segment from topic names
    
  2. Notes
    - These columns support parsing of structured topic names (e.g., env.domain.subdomain.dataset)
    - Existing topics will have NULL values initially
    - Column values will be populated during Kafka sync
*/

DO $$
BEGIN
  -- Add domain column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'domain'
  ) THEN
    ALTER TABLE topics ADD COLUMN domain text;
  END IF;

  -- Add subdomain column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'subdomain'
  ) THEN
    ALTER TABLE topics ADD COLUMN subdomain text;
  END IF;

  -- Add dataset column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'dataset'
  ) THEN
    ALTER TABLE topics ADD COLUMN dataset text;
  END IF;
END $$;