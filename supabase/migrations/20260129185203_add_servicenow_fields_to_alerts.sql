/*
  # Add ServiceNow Fields to Alerts Table
  
  This migration enhances the alerts table with additional ServiceNow incident tracking fields
  to support automatic email import and detailed incident management.
  
  ## Changes
  
  1. New Fields Added:
    - `incident_number` (text) - ServiceNow incident ID (e.g., INC000010315886)
    - `priority` (integer) - Priority level (1=Critical, 2=High, 3=Medium, 4=Low)
    - `business_service` (text) - Business service name (e.g., "Enterprise Event Broker")
    - `category` (text) - Incident category (e.g., "Application")
    - `subcategory` (text) - Incident subcategory (e.g., "Error Message")
    - `assignment_group` (text) - Team assigned to incident
    - `activity_log` (jsonb) - Activity log entries from ServiceNow
    - `email_source` (text) - Original email subject/source for tracking
    - `last_updated` (timestamptz) - Last update timestamp from ServiceNow
  
  2. Indexes:
    - Index on `incident_number` for fast lookups
    - Index on `priority` for filtering
    - Index on `last_updated` for sorting recent activity
  
  ## Notes
  
  - All new fields are nullable to maintain compatibility with existing data
  - Priority values: 1 (Critical), 2 (High), 3 (Medium), 4 (Low)
  - Activity log stored as JSONB for structured query support
  - Email source helps track which emails have been processed
*/

-- Add new ServiceNow tracking fields to alerts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'incident_number'
  ) THEN
    ALTER TABLE alerts ADD COLUMN incident_number text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'priority'
  ) THEN
    ALTER TABLE alerts ADD COLUMN priority integer CHECK (priority BETWEEN 1 AND 4);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'business_service'
  ) THEN
    ALTER TABLE alerts ADD COLUMN business_service text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'category'
  ) THEN
    ALTER TABLE alerts ADD COLUMN category text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'subcategory'
  ) THEN
    ALTER TABLE alerts ADD COLUMN subcategory text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'assignment_group'
  ) THEN
    ALTER TABLE alerts ADD COLUMN assignment_group text DEFAULT 'SDS Enterprise Event Broker';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'activity_log'
  ) THEN
    ALTER TABLE alerts ADD COLUMN activity_log jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'email_source'
  ) THEN
    ALTER TABLE alerts ADD COLUMN email_source text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'alerts' AND column_name = 'last_updated'
  ) THEN
    ALTER TABLE alerts ADD COLUMN last_updated timestamptz DEFAULT now();
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_incident_number ON alerts(incident_number);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_last_updated ON alerts(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_assignment_group ON alerts(assignment_group);

-- Update existing alerts with reasonable defaults
UPDATE alerts 
SET 
  assignment_group = 'SDS Enterprise Event Broker',
  activity_log = '[]'::jsonb,
  last_updated = COALESCE(resolved_at, created_at)
WHERE assignment_group IS NULL OR activity_log IS NULL OR last_updated IS NULL;
