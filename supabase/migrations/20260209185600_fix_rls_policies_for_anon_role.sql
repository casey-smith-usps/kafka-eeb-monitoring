/*
  # Fix RLS Policies for Anonymous Access

  1. Changes
    - Drop existing policies that only target 'public' role
    - Create new policies that explicitly target 'anon' and 'authenticated' roles
    - This ensures frontend access works with the Supabase anon key
  
  2. Security
    - Maintains same access level (public read/write for internal dashboard)
    - Explicitly grants access to anon and authenticated roles
*/

-- Topics table
DROP POLICY IF EXISTS "Allow all access to topics" ON topics;

CREATE POLICY "Allow anon and authenticated to read topics"
  ON topics FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon and authenticated to insert topics"
  ON topics FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to update topics"
  ON topics FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to delete topics"
  ON topics FOR DELETE
  TO anon, authenticated
  USING (true);

-- Alerts table
DROP POLICY IF EXISTS "Allow all access to alerts" ON alerts;

CREATE POLICY "Allow anon and authenticated to read alerts"
  ON alerts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon and authenticated to insert alerts"
  ON alerts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to update alerts"
  ON alerts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to delete alerts"
  ON alerts FOR DELETE
  TO anon, authenticated
  USING (true);

-- Updates table
DROP POLICY IF EXISTS "Allow all access to updates" ON updates;

CREATE POLICY "Allow anon and authenticated to read updates"
  ON updates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon and authenticated to insert updates"
  ON updates FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to update updates"
  ON updates FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to delete updates"
  ON updates FOR DELETE
  TO anon, authenticated
  USING (true);

-- Ingest projects table (already has separate policies, just update them)
DROP POLICY IF EXISTS "Public can view ingest projects" ON ingest_projects;
DROP POLICY IF EXISTS "Public can insert ingest projects" ON ingest_projects;
DROP POLICY IF EXISTS "Public can update ingest projects" ON ingest_projects;
DROP POLICY IF EXISTS "Public can delete ingest projects" ON ingest_projects;

CREATE POLICY "Allow anon and authenticated to read ingest projects"
  ON ingest_projects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon and authenticated to insert ingest projects"
  ON ingest_projects FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to update ingest projects"
  ON ingest_projects FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to delete ingest projects"
  ON ingest_projects FOR DELETE
  TO anon, authenticated
  USING (true);

-- On-call team members table
DROP POLICY IF EXISTS "Public can view oncall team members" ON oncall_team_members;
DROP POLICY IF EXISTS "Public can insert oncall team members" ON oncall_team_members;
DROP POLICY IF EXISTS "Public can update oncall team members" ON oncall_team_members;
DROP POLICY IF EXISTS "Public can delete oncall team members" ON oncall_team_members;

CREATE POLICY "Allow anon and authenticated to read oncall team members"
  ON oncall_team_members FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon and authenticated to insert oncall team members"
  ON oncall_team_members FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to update oncall team members"
  ON oncall_team_members FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to delete oncall team members"
  ON oncall_team_members FOR DELETE
  TO anon, authenticated
  USING (true);

-- Topic notes table
CREATE POLICY "Allow anon and authenticated to read topic notes"
  ON topic_notes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon and authenticated to insert topic notes"
  ON topic_notes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to update topic notes"
  ON topic_notes FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon and authenticated to delete topic notes"
  ON topic_notes FOR DELETE
  TO anon, authenticated
  USING (true);
