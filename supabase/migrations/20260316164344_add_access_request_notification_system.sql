/*
  # Add Access Request Notification System

  1. New Tables
    - `admin_notifications`
      - `id` (uuid, primary key)
      - `admin_id` (uuid, references user_profiles)
      - `access_request_id` (uuid, references access_requests)
      - `read` (boolean, default false)
      - `created_at` (timestamp)
  
  2. Changes
    - Add function to notify admins when new access request is created
    - Add trigger on access_requests table to call notification function
  
  3. Security
    - Enable RLS on admin_notifications table
    - Add policies for admins to read and update their notifications
*/

-- Create admin notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  access_request_id uuid NOT NULL REFERENCES access_requests(id) ON DELETE CASCADE,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admins can read their own notifications
CREATE POLICY "Admins can read own notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Admins can update their own notifications (mark as read)
CREATE POLICY "Admins can update own notifications"
  ON admin_notifications FOR UPDATE
  TO authenticated
  USING (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  )
  WITH CHECK (
    admin_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );

-- Allow anon to read (for backward compatibility with current auth system)
CREATE POLICY "Anon can read notifications"
  ON admin_notifications FOR SELECT
  TO anon
  USING (true);

-- Function to notify all admins when a new access request is created
CREATE OR REPLACE FUNCTION notify_admins_of_access_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for each admin user
  INSERT INTO admin_notifications (admin_id, access_request_id)
  SELECT id, NEW.id
  FROM user_profiles
  WHERE role = 'admin' AND status = 'active';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on access_requests
DROP TRIGGER IF EXISTS on_access_request_created ON access_requests;
CREATE TRIGGER on_access_request_created
  AFTER INSERT ON access_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_of_access_request();

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin_id ON admin_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
