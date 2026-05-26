/*
  # Update ingest_projects RLS policies for public access

  1. Changes
    - Drop existing restrictive RLS policies that require authentication
    - Add new policies that allow public (anonymous) access for all operations
    - This enables the application to work without authentication

  2. Security
    - Policies now allow both authenticated and anonymous users
    - All CRUD operations are permitted publicly
*/

DROP POLICY IF EXISTS "Anyone can view ingest projects" ON ingest_projects;
DROP POLICY IF EXISTS "Anyone can insert ingest projects" ON ingest_projects;
DROP POLICY IF EXISTS "Anyone can update ingest projects" ON ingest_projects;
DROP POLICY IF EXISTS "Anyone can delete ingest projects" ON ingest_projects;

CREATE POLICY "Public can view ingest projects"
  ON ingest_projects
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert ingest projects"
  ON ingest_projects
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update ingest projects"
  ON ingest_projects
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete ingest projects"
  ON ingest_projects
  FOR DELETE
  TO public
  USING (true);
