/*
  # Fix admin_notifications RLS policy

  1. Security Changes
    - Drop existing restrictive policies on admin_notifications
    - Add permissive policies that allow inserts when access requests are created
    - Ensure the table can be written to by authenticated and anon users during request flow
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin notifications insert policy" ON admin_notifications;
DROP POLICY IF EXISTS "Admins can read all notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON admin_notifications;

-- Allow inserts from access request triggers (service role context)
CREATE POLICY "Allow system inserts to admin_notifications"
  ON admin_notifications
  FOR INSERT
  WITH CHECK (true);

-- Allow admins to read notifications
CREATE POLICY "Admins can read notifications"
  ON admin_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.status = 'active'
    )
  );

-- Allow admins to update notifications (mark as read)
CREATE POLICY "Admins can update notifications"
  ON admin_notifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.status = 'active'
    )
  );