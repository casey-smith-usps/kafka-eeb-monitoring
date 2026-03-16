/*
  # Add Admin Policies for Access Requests

  1. Purpose
    - Allow admins to view all access requests
    - Allow admins to update access requests (approve/reject)
    - Allow anyone to create access requests (for self-service registration)

  2. Security
    - Only admins can read access requests
    - Only admins can update access requests
    - Anyone can submit an access request
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can create access requests" ON access_requests;
DROP POLICY IF EXISTS "Admins can read access requests" ON access_requests;
DROP POLICY IF EXISTS "Admins can update access requests" ON access_requests;

-- Allow anyone to create access requests (for self-service registration)
CREATE POLICY "Anyone can create access requests"
  ON access_requests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow admins to read all access requests
CREATE POLICY "Admins can read access requests"
  ON access_requests FOR SELECT
  TO anon
  USING (is_admin());

-- Allow admins to update access requests
CREATE POLICY "Admins can update access requests"
  ON access_requests FOR UPDATE
  TO anon
  USING (is_admin())
  WITH CHECK (is_admin());
