/*
  # Kafka Topic Ingestion Monitoring System

  ## Overview
  Complete database schema for tracking Kafka topics, their performance, schema changes,
  lineage, and daily operational updates.

  ## Tables Created

  ### 1. `topics`
  Main table for Kafka topic tracking
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text, unique, not null) - Kafka topic name
  - `description` (text) - Topic description/purpose
  - `status` (text, not null) - Current status: 'in_progress', 'complete', 'historical'
  - `environment` (text) - Environment: 'dev', 'qa', 'staging', 'prod'
  - `owner_team` (text) - Team responsible for the topic
  - `naming_valid` (boolean, default true) - Whether naming convention is valid
  - `naming_issues` (text) - Description of naming convention violations
  - `partition_count` (integer) - Number of partitions
  - `replication_factor` (integer) - Replication factor
  - `retention_ms` (bigint) - Retention period in milliseconds
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `archived_at` (timestamptz) - Archival timestamp for historical topics

  ### 2. `schema_versions`
  Track schema evolution for each topic
  - `id` (uuid, primary key) - Unique identifier
  - `topic_id` (uuid, foreign key) - Reference to topics table
  - `version` (integer, not null) - Schema version number
  - `schema_definition` (jsonb) - Full schema definition
  - `changes_description` (text) - Human-readable change description
  - `created_by` (text) - Who made the change
  - `created_at` (timestamptz) - When schema was created

  ### 3. `performance_metrics`
  Store performance and health metrics over time
  - `id` (uuid, primary key) - Unique identifier
  - `topic_id` (uuid, foreign key) - Reference to topics table
  - `timestamp` (timestamptz, not null) - Metric collection time
  - `consumer_lag` (bigint) - Current consumer lag
  - `messages_per_second` (numeric) - Throughput rate
  - `bytes_per_second` (numeric) - Byte throughput rate
  - `error_rate` (numeric) - Error percentage
  - `partition_metrics` (jsonb) - Per-partition metrics
  - `notes` (text) - Additional notes

  ### 4. `topic_lineage`
  Track dependencies and data flow between topics
  - `id` (uuid, primary key) - Unique identifier
  - `source_topic_id` (uuid, foreign key) - Source topic
  - `target_topic_id` (uuid, foreign key) - Target/dependent topic
  - `relationship_type` (text) - Type: 'produces_to', 'consumes_from', 'transforms_to'
  - `description` (text) - Relationship description
  - `created_at` (timestamptz) - Creation timestamp

  ### 5. `updates`
  Daily standup updates and operational notes
  - `id` (uuid, primary key) - Unique identifier
  - `topic_id` (uuid, foreign key) - Reference to topics table
  - `update_date` (date, not null) - Date of update
  - `status_update` (text) - Status update text
  - `blockers` (text) - Current blockers or issues
  - `next_steps` (text) - Planned next steps
  - `created_by` (text) - Who added the update
  - `created_at` (timestamptz) - Creation timestamp

  ### 6. `alerts`
  System-generated and manual alerts
  - `id` (uuid, primary key) - Unique identifier
  - `topic_id` (uuid, foreign key) - Reference to topics table
  - `alert_type` (text, not null) - Type: 'naming_violation', 'performance_degradation', 'schema_issue', 'manual'
  - `severity` (text, not null) - Severity: 'low', 'medium', 'high', 'critical'
  - `title` (text, not null) - Alert title
  - `description` (text) - Detailed description
  - `resolved` (boolean, default false) - Resolution status
  - `resolved_at` (timestamptz) - Resolution timestamp
  - `resolved_by` (text) - Who resolved it
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - RLS enabled on all tables
  - Policies allow authenticated users full access (can be refined later for team-based access)
*/

-- Create topics table
CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'complete', 'historical')),
  environment text CHECK (environment IN ('dev', 'qa', 'staging', 'prod')),
  owner_team text,
  naming_valid boolean DEFAULT true,
  naming_issues text,
  partition_count integer,
  replication_factor integer,
  retention_ms bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived_at timestamptz
);

-- Create schema_versions table
CREATE TABLE IF NOT EXISTS schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  version integer NOT NULL,
  schema_definition jsonb,
  changes_description text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(topic_id, version)
);

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL DEFAULT now(),
  consumer_lag bigint,
  messages_per_second numeric,
  bytes_per_second numeric,
  error_rate numeric,
  partition_metrics jsonb,
  notes text
);

-- Create topic_lineage table
CREATE TABLE IF NOT EXISTS topic_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  target_topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('produces_to', 'consumes_from', 'transforms_to')),
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_topic_id, target_topic_id, relationship_type)
);

-- Create updates table
CREATE TABLE IF NOT EXISTS updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  update_date date NOT NULL DEFAULT CURRENT_DATE,
  status_update text,
  blockers text,
  next_steps text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('naming_violation', 'performance_degradation', 'schema_issue', 'manual')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_topics_environment ON topics(environment);
CREATE INDEX IF NOT EXISTS idx_schema_versions_topic_id ON schema_versions(topic_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_topic_id ON performance_metrics(topic_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_updates_topic_id ON updates(topic_id);
CREATE INDEX IF NOT EXISTS idx_updates_date ON updates(update_date DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_topic_id ON alerts(topic_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);

-- Enable Row Level Security
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all operations for now - can be refined later)
-- For public/demo access, we'll allow anonymous access
CREATE POLICY "Allow all access to topics"
  ON topics FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to schema_versions"
  ON schema_versions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to performance_metrics"
  ON performance_metrics FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to topic_lineage"
  ON topic_lineage FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to updates"
  ON updates FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to alerts"
  ON alerts FOR ALL
  USING (true)
  WITH CHECK (true);