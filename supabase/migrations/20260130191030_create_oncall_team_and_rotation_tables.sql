/*
  # Create on-call team members and rotation schedule tables

  1. New Tables
    - oncall_team_members: Team member contact information
    - oncall_rotation: On-call rotation schedule

  2. Security
    - Enable RLS on both tables
    - Allow public access for all operations

  3. Indexes
    - Index on rotation dates for efficient queries
    - Index on team member names for lookups
*/

CREATE TABLE IF NOT EXISTS oncall_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  usps_email text,
  afs_email text,
  ace_id text,
  cell_phone text,
  level text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oncall_rotation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  primary_name text NOT NULL,
  secondary_name text NOT NULL,
  tertiary_name text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE oncall_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE oncall_rotation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view oncall team members"
  ON oncall_team_members
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert oncall team members"
  ON oncall_team_members
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update oncall team members"
  ON oncall_team_members
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete oncall team members"
  ON oncall_team_members
  FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Public can view oncall rotation"
  ON oncall_rotation
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert oncall rotation"
  ON oncall_rotation
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can update oncall rotation"
  ON oncall_rotation
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete oncall rotation"
  ON oncall_rotation
  FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_oncall_rotation_dates ON oncall_rotation(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_oncall_team_name ON oncall_team_members(name);
CREATE INDEX IF NOT EXISTS idx_oncall_team_level ON oncall_team_members(level);
