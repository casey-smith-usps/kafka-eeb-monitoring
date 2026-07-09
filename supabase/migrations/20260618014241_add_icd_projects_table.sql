-- ICD Projects: stores saved Avro schema builder sessions
CREATE TABLE IF NOT EXISTS icd_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  source_topic text NOT NULL DEFAULT '',
  dataset_name text NOT NULL DEFAULT '',
  base_package text NOT NULL DEFAULT 'gov.usps.enterprise.eventbroker',
  project_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_icd_projects_source_topic ON icd_projects(source_topic);
CREATE INDEX IF NOT EXISTS idx_icd_projects_created_at ON icd_projects(created_at);

ALTER TABLE icd_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view icd_projects"
  ON icd_projects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Editors can insert icd_projects"
  ON icd_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY "Editors can update icd_projects"
  ON icd_projects FOR UPDATE
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

CREATE POLICY "Admins can delete icd_projects"
  ON icd_projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS update_icd_projects_updated_at ON icd_projects;
CREATE TRIGGER update_icd_projects_updated_at
  BEFORE UPDATE ON icd_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
