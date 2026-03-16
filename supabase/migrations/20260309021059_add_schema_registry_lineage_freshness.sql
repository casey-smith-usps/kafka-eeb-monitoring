/*
  # Data Governance: Schema Registry, Data Lineage, and Freshness Monitoring

  1. New Tables
    - `schema_registry`
      - Comprehensive metadata catalog for all data schemas
      - Tracks schema versions, owners, and compliance
      - Links to topics and data sources
    
    - `data_lineage`
      - Tracks data flow between sources and destinations
      - Enables impact analysis and dependency mapping
      - Supports both upstream and downstream tracking
    
    - `data_freshness_metrics`
      - Monitors data currency and staleness
      - Tracks last update times and SLA compliance
      - Alerts on data freshness violations
    
    - `schema_fields`
      - Detailed field-level metadata for schemas
      - Tracks data types, constraints, and documentation
      - Enables column-level lineage tracking

  2. Security
    - Enable RLS on all new tables
    - Viewers can read all data
    - Editors can create and update records
    - Admins have full access

  3. Indexes
    - Optimized for search and filtering operations
    - Performance indexes on frequently queried columns
*/

-- Schema Registry: Central catalog of all data schemas
CREATE TABLE IF NOT EXISTS schema_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name text UNIQUE NOT NULL,
  schema_version text NOT NULL DEFAULT 'v1.0',
  schema_type text NOT NULL DEFAULT 'Avro',
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  data_domain text NOT NULL,
  business_owner text,
  technical_owner text,
  description text,
  schema_definition jsonb,
  tags text[] DEFAULT ARRAY[]::text[],
  compliance_tags text[] DEFAULT ARRAY[]::text[],
  status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
  sop_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  deprecated_at timestamptz,
  deprecated_reason text
);

-- Data Lineage: Track data flow and dependencies
CREATE TABLE IF NOT EXISTS data_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES schema_registry(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('topic', 'database', 'api', 'file', 'stream', 'other')),
  destination_id uuid REFERENCES schema_registry(id) ON DELETE CASCADE,
  destination_name text NOT NULL,
  destination_type text NOT NULL CHECK (destination_type IN ('topic', 'database', 'api', 'file', 'stream', 'other')),
  transformation_logic text,
  data_flow_description text,
  pipeline_name text,
  environment text DEFAULT 'prod' CHECK (environment IN ('dev', 'sit', 'cat', 'prod')),
  is_active boolean DEFAULT true,
  latency_sla_seconds integer,
  throughput_mb_per_hour integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

-- Data Freshness Metrics: Monitor data currency
CREATE TABLE IF NOT EXISTS data_freshness_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id uuid REFERENCES schema_registry(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  dataset_name text NOT NULL,
  last_updated_at timestamptz NOT NULL,
  expected_update_frequency_minutes integer NOT NULL DEFAULT 60,
  freshness_sla_minutes integer NOT NULL DEFAULT 120,
  current_lag_minutes integer,
  is_stale boolean DEFAULT false,
  staleness_reason text,
  data_volume_records bigint,
  data_volume_mb numeric(10,2),
  health_status text DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown')),
  last_checked_at timestamptz DEFAULT now(),
  alert_sent boolean DEFAULT false,
  alert_sent_at timestamptz,
  environment text DEFAULT 'prod' CHECK (environment IN ('dev', 'sit', 'cat', 'prod')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Schema Fields: Detailed field-level metadata
CREATE TABLE IF NOT EXISTS schema_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id uuid REFERENCES schema_registry(id) ON DELETE CASCADE NOT NULL,
  field_name text NOT NULL,
  field_path text,
  data_type text NOT NULL,
  is_required boolean DEFAULT false,
  is_pii boolean DEFAULT false,
  is_encrypted boolean DEFAULT false,
  field_description text,
  business_glossary_term text,
  sample_values text[],
  validation_rules text,
  default_value text,
  field_order integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(schema_id, field_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schema_registry_domain ON schema_registry(data_domain);
CREATE INDEX IF NOT EXISTS idx_schema_registry_status ON schema_registry(status);
CREATE INDEX IF NOT EXISTS idx_schema_registry_topic ON schema_registry(topic_id);
CREATE INDEX IF NOT EXISTS idx_schema_registry_tags ON schema_registry USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_schema_registry_search ON schema_registry USING gin(to_tsvector('english', schema_name || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_data_lineage_source ON data_lineage(source_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_destination ON data_lineage(destination_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_environment ON data_lineage(environment);
CREATE INDEX IF NOT EXISTS idx_data_lineage_active ON data_lineage(is_active);

CREATE INDEX IF NOT EXISTS idx_freshness_schema ON data_freshness_metrics(schema_id);
CREATE INDEX IF NOT EXISTS idx_freshness_topic ON data_freshness_metrics(topic_id);
CREATE INDEX IF NOT EXISTS idx_freshness_stale ON data_freshness_metrics(is_stale);
CREATE INDEX IF NOT EXISTS idx_freshness_health ON data_freshness_metrics(health_status);
CREATE INDEX IF NOT EXISTS idx_freshness_updated ON data_freshness_metrics(last_updated_at);

CREATE INDEX IF NOT EXISTS idx_schema_fields_schema ON schema_fields(schema_id);
CREATE INDEX IF NOT EXISTS idx_schema_fields_pii ON schema_fields(is_pii);

-- Enable Row Level Security
ALTER TABLE schema_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_freshness_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schema_registry
CREATE POLICY "Anyone can view schema registry"
  ON schema_registry FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Editors can insert schemas"
  ON schema_registry FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Editors can update schemas"
  ON schema_registry FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Admins can delete schemas"
  ON schema_registry FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- RLS Policies for data_lineage
CREATE POLICY "Anyone can view lineage"
  ON data_lineage FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Editors can insert lineage"
  ON data_lineage FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Editors can update lineage"
  ON data_lineage FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Admins can delete lineage"
  ON data_lineage FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- RLS Policies for data_freshness_metrics
CREATE POLICY "Anyone can view freshness metrics"
  ON data_freshness_metrics FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Editors can insert freshness metrics"
  ON data_freshness_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Editors can update freshness metrics"
  ON data_freshness_metrics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Admins can delete freshness metrics"
  ON data_freshness_metrics FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- RLS Policies for schema_fields
CREATE POLICY "Anyone can view schema fields"
  ON schema_fields FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Editors can insert schema fields"
  ON schema_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Editors can update schema fields"
  ON schema_fields FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Admins can delete schema fields"
  ON schema_fields FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_schema_registry_updated_at ON schema_registry;
CREATE TRIGGER update_schema_registry_updated_at
  BEFORE UPDATE ON schema_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_data_lineage_updated_at ON data_lineage;
CREATE TRIGGER update_data_lineage_updated_at
  BEFORE UPDATE ON data_lineage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_freshness_metrics_updated_at ON data_freshness_metrics;
CREATE TRIGGER update_freshness_metrics_updated_at
  BEFORE UPDATE ON data_freshness_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schema_fields_updated_at ON schema_fields;
CREATE TRIGGER update_schema_fields_updated_at
  BEFORE UPDATE ON schema_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate data freshness lag
CREATE OR REPLACE FUNCTION calculate_freshness_lag()
RETURNS TRIGGER AS $$
BEGIN
  NEW.current_lag_minutes = EXTRACT(EPOCH FROM (now() - NEW.last_updated_at)) / 60;
  NEW.is_stale = (NEW.current_lag_minutes > NEW.freshness_sla_minutes);
  
  IF NEW.is_stale THEN
    NEW.health_status = 'critical';
  ELSIF NEW.current_lag_minutes > (NEW.freshness_sla_minutes * 0.8) THEN
    NEW.health_status = 'warning';
  ELSE
    NEW.health_status = 'healthy';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for freshness calculation
DROP TRIGGER IF EXISTS calculate_freshness_on_update ON data_freshness_metrics;
CREATE TRIGGER calculate_freshness_on_update
  BEFORE INSERT OR UPDATE ON data_freshness_metrics
  FOR EACH ROW
  EXECUTE FUNCTION calculate_freshness_lag();