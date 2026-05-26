/*
  # Add User Management and Role-Based Access Control

  ## Overview
  This migration adds comprehensive user management functionality with role-based access control.
  Users can self-register, and admins can manage user roles and permissions.

  ## Changes Made

  1. **New Tables**
     - `user_profiles` - Extended user information and role management
       - `id` (uuid, references auth.users)
       - `email` (text)
       - `full_name` (text)
       - `role` (text) - Can be 'viewer', 'editor', or 'admin'
       - `status` (text) - Can be 'active', 'pending', or 'disabled'
       - `created_at` (timestamptz)
       - `updated_at` (timestamptz)

  2. **Security (RLS)**
     - Enable RLS on user_profiles table
     - Users can view their own profile
     - Users can view other active users' basic info
     - Only admins can update user roles and status
     - Auto-create profile on user signup via trigger

  3. **Functions**
     - Trigger function to auto-create user profile on signup
     - First user automatically becomes admin

  ## Important Notes
  - The first user to sign up will automatically be assigned 'admin' role
  - All subsequent users start with 'viewer' role and 'pending' status
  - Admins can promote users and change their status via the admin panel
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'disabled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Users can view other active users (for collaboration features)
CREATE POLICY "Users can view active users"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Policy: Users can update their own name
CREATE POLICY "Users can update own name"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM user_profiles WHERE id = auth.uid())
  );

-- Policy: Admins can view all users
CREATE POLICY "Admins can view all users"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins can update any user's role and status
CREATE POLICY "Admins can update user roles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Allow inserts during signup (handled by trigger)
CREATE POLICY "Allow profile creation on signup"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Function: Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_count int;
BEGIN
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM user_profiles;
  
  -- Insert user profile
  -- First user becomes admin with active status
  -- Subsequent users become viewers with pending status
  INSERT INTO public.user_profiles (id, email, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN user_count = 0 THEN 'admin' ELSE 'viewer' END,
    CASE WHEN user_count = 0 THEN 'active' ELSE 'pending' END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();