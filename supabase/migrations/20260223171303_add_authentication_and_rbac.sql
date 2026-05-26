/*
  # Add Authentication and Role-Based Access Control (RBAC)

  1. New Tables
    - `user_roles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text)
      - `role` (text) - 'admin' or 'viewer'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security Changes
    - Enable RLS on `user_roles` table
    - Update ALL existing tables to use auth.uid() instead of USING (true)
    - Add restrictive policies that require authentication
    - Admin-only policies for sensitive operations (sync, incidents)
  
  3. Important Notes
    - After this migration, users MUST be logged in to access data
    - Only users with 'admin' role can perform sync operations and modifications
    - Viewers can read most data but cannot modify
    - First user registered should be manually set to 'admin' role in the database
    - To set admin role manually: 
      INSERT INTO user_roles (user_id, email, role) 
      VALUES ('user-uuid-here', 'your-email@domain.com', 'admin');
*/

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- User roles policies - users can read their own role
CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage all roles
CREATE POLICY "Admins can manage all roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is authenticated
CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all existing insecure policies
DO $$ 
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- TOPICS table - Authenticated users can read, admins can write
CREATE POLICY "Authenticated users can read topics"
  ON topics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert topics"
  ON topics FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update topics"
  ON topics FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete topics"
  ON topics FOR DELETE
  TO authenticated
  USING (is_admin());

-- SCHEMA_VERSIONS table
CREATE POLICY "Authenticated users can read schema_versions"
  ON schema_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert schema_versions"
  ON schema_versions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update schema_versions"
  ON schema_versions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete schema_versions"
  ON schema_versions FOR DELETE
  TO authenticated
  USING (is_admin());

-- PERFORMANCE_METRICS table
CREATE POLICY "Authenticated users can read performance_metrics"
  ON performance_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert performance_metrics"
  ON performance_metrics FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update performance_metrics"
  ON performance_metrics FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete performance_metrics"
  ON performance_metrics FOR DELETE
  TO authenticated
  USING (is_admin());

-- TOPIC_LINEAGE table
CREATE POLICY "Authenticated users can read topic_lineage"
  ON topic_lineage FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert topic_lineage"
  ON topic_lineage FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update topic_lineage"
  ON topic_lineage FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete topic_lineage"
  ON topic_lineage FOR DELETE
  TO authenticated
  USING (is_admin());

-- UPDATES table
CREATE POLICY "Authenticated users can read updates"
  ON updates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert updates"
  ON updates FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update updates"
  ON updates FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete updates"
  ON updates FOR DELETE
  TO authenticated
  USING (is_admin());

-- ALERTS table
CREATE POLICY "Authenticated users can read alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete alerts"
  ON alerts FOR DELETE
  TO authenticated
  USING (is_admin());

-- TOPIC_NOTES table
CREATE POLICY "Authenticated users can read topic_notes"
  ON topic_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert topic_notes"
  ON topic_notes FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update topic_notes"
  ON topic_notes FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete topic_notes"
  ON topic_notes FOR DELETE
  TO authenticated
  USING (is_admin());

-- ONBOARDING_DOCUMENTS table
CREATE POLICY "Authenticated users can read onboarding_documents"
  ON onboarding_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert onboarding_documents"
  ON onboarding_documents FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update onboarding_documents"
  ON onboarding_documents FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete onboarding_documents"
  ON onboarding_documents FOR DELETE
  TO authenticated
  USING (is_admin());

-- INGEST_PROJECTS table
CREATE POLICY "Authenticated users can read ingest_projects"
  ON ingest_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert ingest_projects"
  ON ingest_projects FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update ingest_projects"
  ON ingest_projects FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete ingest_projects"
  ON ingest_projects FOR DELETE
  TO authenticated
  USING (is_admin());

-- ONCALL_TEAM_MEMBERS table
CREATE POLICY "Authenticated users can read oncall_team_members"
  ON oncall_team_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert oncall_team_members"
  ON oncall_team_members FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update oncall_team_members"
  ON oncall_team_members FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete oncall_team_members"
  ON oncall_team_members FOR DELETE
  TO authenticated
  USING (is_admin());

-- ONCALL_ROTATION table
CREATE POLICY "Authenticated users can read oncall_rotation"
  ON oncall_rotation FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert oncall_rotation"
  ON oncall_rotation FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update oncall_rotation"
  ON oncall_rotation FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete oncall_rotation"
  ON oncall_rotation FOR DELETE
  TO authenticated
  USING (is_admin());

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
