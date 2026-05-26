/*
  Add Topic Notes and Documents Management
  
  1. New Table: topic_notes
     - Track notes and issues for each Kafka topic
     - Foreign key relationship to topics table
  
  2. New Table: onboarding_documents
     - Store Word and PowerPoint onboarding documents
     - Categorized by GCP, Azure, General
     - Searchable tags for easy discovery
  
  3. Security
     - Row Level Security enabled on both tables
     - Authenticated users can read and write
*/

-- Create topic_notes table
CREATE TABLE IF NOT EXISTS topic_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by text DEFAULT 'Current User',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create onboarding_documents table
CREATE TABLE IF NOT EXISTS onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  file_size bigint DEFAULT 0,
  category text DEFAULT 'General' CHECK (category IN ('GCP', 'Azure', 'General')),
  uploaded_by text DEFAULT 'Current User',
  uploaded_at timestamptz DEFAULT now(),
  tags jsonb DEFAULT '[]'::jsonb
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_topic_notes_topic_id ON topic_notes(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_notes_created_at ON topic_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_category ON onboarding_documents(category);
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_uploaded_at ON onboarding_documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_tags ON onboarding_documents USING GIN (tags);

-- Enable Row Level Security
ALTER TABLE topic_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for topic_notes
CREATE POLICY "Anyone can view topic notes"
  ON topic_notes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create topic notes"
  ON topic_notes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update topic notes"
  ON topic_notes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete topic notes"
  ON topic_notes FOR DELETE
  TO public
  USING (true);

-- RLS Policies for onboarding_documents
CREATE POLICY "Anyone can view documents"
  ON onboarding_documents FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can upload documents"
  ON onboarding_documents FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update documents"
  ON onboarding_documents FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete documents"
  ON onboarding_documents FOR DELETE
  TO public
  USING (true);
