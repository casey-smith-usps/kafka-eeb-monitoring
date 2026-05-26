/*
  # Update Environment Options

  1. Changes
    - Update topics table environment constraint to support DEV, SIT, CAT, PROD
    - Remove old environment options (qa, staging)
    - Add new environment options (sit, cat)

  2. Notes
    - Existing data with 'qa' or 'staging' will be preserved but should be updated manually if needed
    - The CHECK constraint will only apply to new inserts/updates
*/

-- Drop the old CHECK constraint on environment
ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_environment_check;

-- Add new CHECK constraint with updated environments
ALTER TABLE topics ADD CONSTRAINT topics_environment_check 
  CHECK (environment IN ('dev', 'sit', 'cat', 'prod'));