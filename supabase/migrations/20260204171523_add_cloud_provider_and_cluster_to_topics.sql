/*
  # Add Cloud Provider and Cluster Tracking to Topics

  1. Changes
    - Add `cloud_provider` column to store the cloud platform (Azure, GCP, AWS)
    - Add `cluster_id` column to store the Confluent cluster ID
    - Add `cluster_name` column for human-readable cluster names
    - Drop existing unique constraint on name
    - Add new composite unique constraint on (name, cluster_id)
    
  2. Notes
    - Topics can exist in multiple clusters (Azure and GCP)
    - Each topic+cluster combination is unique
    - Existing topics will need cluster_id populated
*/

-- Add cloud provider column
ALTER TABLE topics ADD COLUMN IF NOT EXISTS cloud_provider text;

-- Add cluster tracking columns
ALTER TABLE topics ADD COLUMN IF NOT EXISTS cluster_id text;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS cluster_name text;

-- Drop the old unique constraint on name if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'topics_name_key'
  ) THEN
    ALTER TABLE topics DROP CONSTRAINT topics_name_key;
  END IF;
END $$;

-- Add composite unique constraint on name and cluster_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'topics_name_cluster_id_key'
  ) THEN
    ALTER TABLE topics ADD CONSTRAINT topics_name_cluster_id_key UNIQUE (name, cluster_id);
  END IF;
END $$;

-- Create index for querying by cloud provider
CREATE INDEX IF NOT EXISTS idx_topics_cloud_provider ON topics(cloud_provider);

-- Create index for querying by cluster
CREATE INDEX IF NOT EXISTS idx_topics_cluster_id ON topics(cluster_id);