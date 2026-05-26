/*
  # Add ICD and Schema Fields to Topics

  1. Changes to topics table
    - `icd_teams_url` (text) - Direct link to ICD document in Microsoft Teams
    - `icd_document_id` (uuid) - Foreign key to onboarding_documents table for uploaded ICDs
    - `schema_registry_url` (text) - URL to schema in Confluent Schema Registry
    - `latest_schema` (jsonb) - Cached copy of the latest schema from Schema Registry
    - `schema_version` (integer) - Current schema version number
    - `schema_last_synced` (timestamptz) - When schema was last fetched from registry
  
  2. Purpose
    - Link ICDs (Interface Control Documents) to PROD topics
    - Support both Teams links and uploaded documents
    - Sync and cache schemas from Kafka Schema Registry
    - Enable easy access to ICD and schema information from topic details
*/

-- Add ICD and schema fields to topics table
DO $$
BEGIN
  -- ICD Teams URL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'icd_teams_url'
  ) THEN
    ALTER TABLE topics ADD COLUMN icd_teams_url text;
  END IF;

  -- ICD Document Reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'icd_document_id'
  ) THEN
    ALTER TABLE topics ADD COLUMN icd_document_id uuid REFERENCES onboarding_documents(id) ON DELETE SET NULL;
  END IF;

  -- Schema Registry URL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'schema_registry_url'
  ) THEN
    ALTER TABLE topics ADD COLUMN schema_registry_url text;
  END IF;

  -- Latest Schema (cached)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'latest_schema'
  ) THEN
    ALTER TABLE topics ADD COLUMN latest_schema jsonb;
  END IF;

  -- Schema Version
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'schema_version'
  ) THEN
    ALTER TABLE topics ADD COLUMN schema_version integer;
  END IF;

  -- Schema Last Synced
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'schema_last_synced'
  ) THEN
    ALTER TABLE topics ADD COLUMN schema_last_synced timestamptz;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_topics_icd_document_id ON topics(icd_document_id);
CREATE INDEX IF NOT EXISTS idx_topics_environment_with_icd ON topics(environment) WHERE icd_teams_url IS NOT NULL OR icd_document_id IS NOT NULL;