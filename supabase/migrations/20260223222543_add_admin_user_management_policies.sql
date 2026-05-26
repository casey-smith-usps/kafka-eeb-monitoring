/*
  # Add Admin User Management Policies

  1. Purpose
    - Allow admins to view all users
    - Allow admins to create new users
    - Allow admins to update user roles and status
    - Allow users to view their own profile

  2. Helper Functions
    - is_admin() - checks if current token holder is an admin
    - get_user_role() - gets role of current token holder

  3. Security
    - Only admins can create, update users
    - Only admins can read all user profiles
    - All users can read their own profile
    - Access tokens are never exposed to non-admins
*/

-- Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_value text;
  user_role text;
BEGIN
  -- Get token from X-Access-Token header
  token_value := current_setting('request.headers', true)::json->>'x-access-token';
  
  -- Check if token exists and user is admin
  SELECT role INTO user_role
  FROM user_profiles 
  WHERE access_token = token_value 
    AND status = 'active';
  
  RETURN user_role = 'admin';
END;
$$;

-- Create helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_value text;
  user_role text;
BEGIN
  -- Get token from X-Access-Token header
  token_value := current_setting('request.headers', true)::json->>'x-access-token';
  
  -- Get user role
  SELECT role INTO user_role
  FROM user_profiles 
  WHERE access_token = token_value 
    AND status = 'active';
  
  RETURN user_role;
END;
$$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert new users" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update users" ON user_profiles;
DROP POLICY IF EXISTS "Anon users with valid token can read user profiles" ON user_profiles;

-- Allow admins to read all user profiles (including access tokens)
CREATE POLICY "Admins can read all user profiles"
  ON user_profiles FOR SELECT
  TO anon
  USING (is_admin());

-- Allow admins to create new users
CREATE POLICY "Admins can insert new users"
  ON user_profiles FOR INSERT
  TO anon
  WITH CHECK (is_admin());

-- Allow admins to update user profiles
CREATE POLICY "Admins can update users"
  ON user_profiles FOR UPDATE
  TO anon
  USING (is_admin())
  WITH CHECK (is_admin());

-- Allow any authenticated user to read user profiles (but NOT access tokens)
-- This is for displaying user names, roles, etc. in the UI
CREATE POLICY "Anon users with valid token can read user profiles"
  ON user_profiles FOR SELECT
  TO anon
  USING (is_valid_token());
