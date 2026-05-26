/*
  # Schema Validator Tables

  1. New Tables
    - `validation_sessions` - stores each validation run with inputs (ICD text, schemas, topics)
    - `validation_findings` - individual findings per session (missing fields, type mismatches, etc.)
    - `mapping_candidates` - field-to-field mapping suggestions per session

  2. Columns
    validation_sessions:
      - id, created_at, updated_at
      - project_name - optional label for the session
      - inbound_topic_id / outbound_topic_id - FK to topics table (nullable, for topic-based flows)
      - inbound_icd_text / outbound_icd_text - raw ICD text pasted by user
      - inbound_schema / outbound_schema - JSON schema objects
      - status: pending | running | complete | failed
      - summary - JSON blob with high-level counts
      - created_by - email of user who ran it (from localStorage)

    validation_findings:
      - id, session_id (FK), created_at
      - severity: info | warning | error
      - category: missing_field | type_mismatch | rename_candidate | nullability | duplicate_type | unmapped_field | open_question
      - field_path - dot-notation path of the field in question
      - message - human-readable description
      - recommendation - suggested fix or action

    mapping_candidates:
      - id, session_id (FK), created_at
      - inbound_field - source field path
      - outbound_field - target field path
      - mapping_type: direct | transform | rename | inferred | unresolved
      - confidence: high | medium | low
      - transform_notes - description of transformation needed
      - ai_generated - whether AI or deterministic rules produced this

  3. Security
    - RLS enabled on all tables
    - Anon users with valid token can read/insert (matches existing app pattern)
    - No public write without token
*/

CREATE TABLE IF NOT EXISTS validation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  project_name text DEFAULT '',
  inbound_topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  outbound_topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  inbound_icd_text text DEFAULT '',
  outbound_icd_text text DEFAULT '',
  inbound_schema jsonb,
  outbound_schema jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  summary jsonb,
  created_by text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS validation_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES validation_sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  category text DEFAULT 'missing_field' CHECK (category IN (
    'missing_field', 'type_mismatch', 'rename_candidate', 'nullability',
    'duplicate_type', 'unmapped_field', 'open_question'
  )),
  field_path text DEFAULT '',
  message text NOT NULL,
  recommendation text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS mapping_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES validation_sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  inbound_field text DEFAULT '',
  outbound_field text DEFAULT '',
  mapping_type text DEFAULT 'direct' CHECK (mapping_type IN ('direct', 'transform', 'rename', 'inferred', 'unresolved')),
  confidence text DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  transform_notes text DEFAULT '',
  ai_generated boolean DEFAULT false
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_validation_findings_session ON validation_findings(session_id);
CREATE INDEX IF NOT EXISTS idx_mapping_candidates_session ON mapping_candidates(session_id);
CREATE INDEX IF NOT EXISTS idx_validation_sessions_topics ON validation_sessions(inbound_topic_id, outbound_topic_id);

-- RLS
ALTER TABLE validation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_candidates ENABLE ROW LEVEL SECURITY;

-- Use the same is_valid_token() function already in the DB
CREATE POLICY "Token users can read validation sessions"
  ON validation_sessions FOR SELECT
  TO anon
  USING (is_valid_token());

CREATE POLICY "Token users can insert validation sessions"
  ON validation_sessions FOR INSERT
  TO anon
  WITH CHECK (is_valid_token());

CREATE POLICY "Token users can update own validation sessions"
  ON validation_sessions FOR UPDATE
  TO anon
  USING (is_valid_token())
  WITH CHECK (is_valid_token());

CREATE POLICY "Token users can read validation findings"
  ON validation_findings FOR SELECT
  TO anon
  USING (is_valid_token());

CREATE POLICY "Token users can insert validation findings"
  ON validation_findings FOR INSERT
  TO anon
  WITH CHECK (is_valid_token());

CREATE POLICY "Token users can read mapping candidates"
  ON mapping_candidates FOR SELECT
  TO anon
  USING (is_valid_token());

CREATE POLICY "Token users can insert mapping candidates"
  ON mapping_candidates FOR INSERT
  TO anon
  WITH CHECK (is_valid_token());

-- Authenticated users get full access
CREATE POLICY "Authenticated users can read validation sessions"
  ON validation_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert validation sessions"
  ON validation_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update validation sessions"
  ON validation_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read validation findings"
  ON validation_findings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert validation findings"
  ON validation_findings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read mapping candidates"
  ON mapping_candidates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert mapping candidates"
  ON mapping_candidates FOR INSERT
  TO authenticated
  WITH CHECK (true);
