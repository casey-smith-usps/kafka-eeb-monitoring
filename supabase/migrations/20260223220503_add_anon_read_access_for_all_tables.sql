/*
  # Add Anonymous Read Access for Token-Based Authentication

  1. Purpose
    - Allow anon role to read all application data when authenticated via token
    - Enables token-based login to work properly without requiring Supabase Auth

  2. Security Model
    - User must have valid token in user_profiles table
    - Token is validated through is_valid_token() function
    - All read operations allowed for valid token holders
    - Write operations still require admin/editor roles

  3. Tables Updated
    - topics (kafka topics and configurations)
    - alerts (incident tracking)
    - ingest_projects (project tracking)
    - oncall_team_members (team roster)
    - oncall_rotation (on-call schedule)
    - topic_notes (topic documentation)
    - onboarding_documents (file attachments)
    - schema_versions (topic schema history)
    - performance_metrics (monitoring data)
    - topic_lineage (data flow relationships)
    - updates (status updates)
*/

-- Topics: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read topics" ON topics;
CREATE POLICY "Anon users with valid token can read topics"
  ON topics FOR SELECT
  TO anon
  USING (is_valid_token());

-- Alerts: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read alerts" ON alerts;
CREATE POLICY "Anon users with valid token can read alerts"
  ON alerts FOR SELECT
  TO anon
  USING (is_valid_token());

-- Ingest Projects: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read ingest_projects" ON ingest_projects;
CREATE POLICY "Anon users with valid token can read ingest_projects"
  ON ingest_projects FOR SELECT
  TO anon
  USING (is_valid_token());

-- OnCall Team Members: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read oncall_team_members" ON oncall_team_members;
CREATE POLICY "Anon users with valid token can read oncall_team_members"
  ON oncall_team_members FOR SELECT
  TO anon
  USING (is_valid_token());

-- OnCall Rotation: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read oncall_rotation" ON oncall_rotation;
CREATE POLICY "Anon users with valid token can read oncall_rotation"
  ON oncall_rotation FOR SELECT
  TO anon
  USING (is_valid_token());

-- Topic Notes: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read topic_notes" ON topic_notes;
CREATE POLICY "Anon users with valid token can read topic_notes"
  ON topic_notes FOR SELECT
  TO anon
  USING (is_valid_token());

-- Onboarding Documents: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read onboarding_documents" ON onboarding_documents;
CREATE POLICY "Anon users with valid token can read onboarding_documents"
  ON onboarding_documents FOR SELECT
  TO anon
  USING (is_valid_token());

-- Schema Versions: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read schema_versions" ON schema_versions;
CREATE POLICY "Anon users with valid token can read schema_versions"
  ON schema_versions FOR SELECT
  TO anon
  USING (is_valid_token());

-- Performance Metrics: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read performance_metrics" ON performance_metrics;
CREATE POLICY "Anon users with valid token can read performance_metrics"
  ON performance_metrics FOR SELECT
  TO anon
  USING (is_valid_token());

-- Topic Lineage: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read topic_lineage" ON topic_lineage;
CREATE POLICY "Anon users with valid token can read topic_lineage"
  ON topic_lineage FOR SELECT
  TO anon
  USING (is_valid_token());

-- Updates: Allow anon users with valid tokens to read
DROP POLICY IF EXISTS "Anon users with valid token can read updates" ON updates;
CREATE POLICY "Anon users with valid token can read updates"
  ON updates FOR SELECT
  TO anon
  USING (is_valid_token());
