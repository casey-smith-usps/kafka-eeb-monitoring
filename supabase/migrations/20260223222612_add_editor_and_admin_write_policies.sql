/*
  # Add Editor and Admin Write Policies

  1. Purpose
    - Allow editors and admins to create, update, and delete records
    - Maintain read access for all authenticated users
    - Enable full CRUD operations for authorized roles

  2. Tables Updated
    - topics (kafka topics)
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

  3. Security
    - Only editors and admins can write data
    - All authenticated users can read data
*/

-- Helper function to check if user is editor or admin
CREATE OR REPLACE FUNCTION can_write()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_value text;
  user_role text;
BEGIN
  token_value := current_setting('request.headers', true)::json->>'x-access-token';
  
  SELECT role INTO user_role
  FROM user_profiles 
  WHERE access_token = token_value 
    AND status = 'active';
  
  RETURN user_role IN ('admin', 'editor');
END;
$$;

-- Topics: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert topics"
  ON topics FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update topics"
  ON topics FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete topics"
  ON topics FOR DELETE
  TO anon
  USING (can_write());

-- Alerts: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert alerts"
  ON alerts FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update alerts"
  ON alerts FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete alerts"
  ON alerts FOR DELETE
  TO anon
  USING (can_write());

-- Ingest Projects: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert ingest_projects"
  ON ingest_projects FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update ingest_projects"
  ON ingest_projects FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete ingest_projects"
  ON ingest_projects FOR DELETE
  TO anon
  USING (can_write());

-- OnCall Team Members: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert oncall_team_members"
  ON oncall_team_members FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update oncall_team_members"
  ON oncall_team_members FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete oncall_team_members"
  ON oncall_team_members FOR DELETE
  TO anon
  USING (can_write());

-- OnCall Rotation: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert oncall_rotation"
  ON oncall_rotation FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update oncall_rotation"
  ON oncall_rotation FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete oncall_rotation"
  ON oncall_rotation FOR DELETE
  TO anon
  USING (can_write());

-- Topic Notes: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert topic_notes"
  ON topic_notes FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update topic_notes"
  ON topic_notes FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete topic_notes"
  ON topic_notes FOR DELETE
  TO anon
  USING (can_write());

-- Onboarding Documents: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert onboarding_documents"
  ON onboarding_documents FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update onboarding_documents"
  ON onboarding_documents FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete onboarding_documents"
  ON onboarding_documents FOR DELETE
  TO anon
  USING (can_write());

-- Schema Versions: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert schema_versions"
  ON schema_versions FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update schema_versions"
  ON schema_versions FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete schema_versions"
  ON schema_versions FOR DELETE
  TO anon
  USING (can_write());

-- Performance Metrics: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert performance_metrics"
  ON performance_metrics FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update performance_metrics"
  ON performance_metrics FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete performance_metrics"
  ON performance_metrics FOR DELETE
  TO anon
  USING (can_write());

-- Topic Lineage: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert topic_lineage"
  ON topic_lineage FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update topic_lineage"
  ON topic_lineage FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete topic_lineage"
  ON topic_lineage FOR DELETE
  TO anon
  USING (can_write());

-- Updates: Allow editors/admins to write
CREATE POLICY "Editors and admins can insert updates"
  ON updates FOR INSERT
  TO anon
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can update updates"
  ON updates FOR UPDATE
  TO anon
  USING (can_write())
  WITH CHECK (can_write());

CREATE POLICY "Editors and admins can delete updates"
  ON updates FOR DELETE
  TO anon
  USING (can_write());
