/*
  # Add Topic Source Tracking

  1. Changes
    - Add `topic_source` column to distinguish between:
      - 'enterprise_catalog': The 67 official completed enterprise topics from SharePoint
      - 'kafka_sync': Topics automatically synced from Kafka clusters
      - 'manual': Topics manually added through the UI
    
  2. Data Migration
    - Mark existing 67 completed PROD topics as 'enterprise_catalog'
    - Mark all other existing topics as 'kafka_sync' (they came from Kafka)
    
  3. Purpose
    - Prevents mixing enterprise catalog topics with Kafka-synced PROD topics
    - Allows filtering and reporting on official enterprise catalog separately
    - Maintains integrity of the 67 completed enterprise topics
*/

-- Add topic_source column
ALTER TABLE topics
ADD COLUMN IF NOT EXISTS topic_source text DEFAULT 'kafka_sync';

-- Mark the 67 completed enterprise catalog topics
UPDATE topics
SET topic_source = 'enterprise_catalog'
WHERE environment = 'prod'
  AND cluster_name = 'EEB Production'
  AND status = 'complete';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_topics_source ON topics(topic_source);

-- Add comment for documentation
COMMENT ON COLUMN topics.topic_source IS 'Source of the topic: enterprise_catalog (official 67), kafka_sync (auto-synced), or manual (UI-added)';
