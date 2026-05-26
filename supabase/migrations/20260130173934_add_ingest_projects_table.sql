/*
  # Create ingest projects table for morning standup tracking

  1. New Tables
    - `ingest_projects`
      - `id` (uuid, primary key)
      - `title` (text, required) - Project title
      - `status` (text) - Current status (On Hold, In Progress, etc.)
      - `prod_date` (date) - Production date
      - `owner` (text) - Project owner(s)
      - `status2` (text) - Additional status field
      - `tasks` (text) - Current tasks/notes
      - `environment` (text) - Current environment: dev, sit, cat, prod
      - `dev_completed_date` (date) - Dev environment completion date
      - `sit_completed_date` (date) - SIT environment completion date
      - `cat_completed_date` (date) - CAT environment completion date
      - `prod_completed_date` (date) - Prod environment completion date
      - `dev_projected_date` (date) - Projected dev completion
      - `sit_projected_date` (date) - Projected SIT completion
      - `cat_projected_date` (date) - Projected CAT completion
      - `prod_projected_date` (date) - Projected prod completion
      - `notes` (jsonb) - Array of notes with timestamp and author
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `ingest_projects` table
    - Add policies for authenticated users to read all projects
    - Add policies for authenticated users to create/update projects
*/

CREATE TABLE IF NOT EXISTS ingest_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text,
  prod_date date,
  owner text,
  status2 text,
  tasks text,
  environment text,
  dev_completed_date date,
  sit_completed_date date,
  cat_completed_date date,
  prod_completed_date date,
  dev_projected_date date,
  sit_projected_date date,
  cat_projected_date date,
  prod_projected_date date,
  notes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ingest_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ingest projects"
  ON ingest_projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert ingest projects"
  ON ingest_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update ingest projects"
  ON ingest_projects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete ingest projects"
  ON ingest_projects
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_ingest_projects_environment ON ingest_projects(environment);
CREATE INDEX IF NOT EXISTS idx_ingest_projects_status ON ingest_projects(status);
CREATE INDEX IF NOT EXISTS idx_ingest_projects_created_at ON ingest_projects(created_at DESC);