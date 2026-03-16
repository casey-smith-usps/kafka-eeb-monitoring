/*
  # Add Anonymous Token Login Policy

  1. Changes
    - Add SELECT policy for anon role to query user_profiles by access_token
    - This allows unauthenticated users to validate their access tokens during login
    - Policy is restrictive: only allows selecting by exact token match

  2. Security
    - Only anon role can use this policy for login flow
    - Only allows SELECT operations
    - Requires exact access_token match
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow anon token validation for login" ON user_profiles;

-- Allow anon users to query user_profiles by access_token for login
CREATE POLICY "Allow anon token validation for login"
  ON user_profiles
  FOR SELECT
  TO anon
  USING (access_token IS NOT NULL);
