/*
  # Access Request System (Passwordless)

  1. Changes
    - Add `access_requests` table for users requesting access
    - Update `user_profiles` to remove password dependency
    - Add `access_token` field for passwordless authentication
    - Add indexes for performance

  2. New Tables
    - `access_requests`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `full_name` (text)
      - `reason` (text, optional)
      - `status` (enum: pending, approved, rejected)
      - `requested_at` (timestamp)
      - `reviewed_at` (timestamp, nullable)
      - `reviewed_by` (uuid, nullable, references user_profiles)

  3. Security
    - Enable RLS on `access_requests` table
    - Allow anonymous users to insert requests
    - Allow authenticated admins to read/update requests
    - Update user_profiles policies for passwordless access
*/

-- Create access requests table
CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES user_profiles(id),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Add access_token to user_profiles for passwordless auth
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'access_token'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN access_token text UNIQUE;
  END IF;
END $$;

-- Add last_access timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_access'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_access timestamptz;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_access_token ON user_profiles(access_token);

-- Enable RLS
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can submit access request" ON access_requests;
DROP POLICY IF EXISTS "Admins can view all access requests" ON access_requests;
DROP POLICY IF EXISTS "Admins can update access requests" ON access_requests;

-- Allow anyone (including anonymous) to submit access requests
CREATE POLICY "Anyone can submit access request"
  ON access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow admins to view all access requests
CREATE POLICY "Admins can view all access requests"
  ON access_requests
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

-- Allow admins to update access requests
CREATE POLICY "Admins can update access requests"
  ON access_requests
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
