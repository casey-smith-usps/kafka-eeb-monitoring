/*
  # Add comprehensive incident tracking fields to alerts table

  1. Changes
    - Add v1_story column for V1 Story reference
    - Add story_type column (OV, DS, US, etc.)
    - Add category column (Defect, Original Scope, Additional Scope, etc.)
    - Add team_assigned column for team ownership
    - Add release_date column for planned release date
    - Add functional_impact column for impact description
    - Add date_identified column for actual incident date (THIS is the display date)
    - Add age column for days since identification
    - Add identified_by column for who reported it
    
  2. Notes
    - date_identified is the PRIMARY date field that should be displayed
    - created_at remains for system tracking
    - All fields nullable to support various incident types
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'v1_story'
  ) THEN
    ALTER TABLE alerts ADD COLUMN v1_story text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'story_type'
  ) THEN
    ALTER TABLE alerts ADD COLUMN story_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'category'
  ) THEN
    ALTER TABLE alerts ADD COLUMN category text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'team_assigned'
  ) THEN
    ALTER TABLE alerts ADD COLUMN team_assigned text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'release_date'
  ) THEN
    ALTER TABLE alerts ADD COLUMN release_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'functional_impact'
  ) THEN
    ALTER TABLE alerts ADD COLUMN functional_impact text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'date_identified'
  ) THEN
    ALTER TABLE alerts ADD COLUMN date_identified timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'age'
  ) THEN
    ALTER TABLE alerts ADD COLUMN age integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'identified_by'
  ) THEN
    ALTER TABLE alerts ADD COLUMN identified_by text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alerts_date_identified ON alerts(date_identified DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_story_type ON alerts(story_type);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
