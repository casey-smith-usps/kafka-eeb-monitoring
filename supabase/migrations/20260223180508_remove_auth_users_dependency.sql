/*
  # Remove auth.users Foreign Key Dependency

  1. Changes
    - Remove foreign key constraint from user_profiles to auth.users
    - This allows passwordless authentication without Supabase Auth
    - Users are managed entirely through access tokens

  2. Security
    - RLS policies remain in place
    - Access controlled through access_token verification
*/

-- Remove the foreign key constraint that requires auth.users
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Update the id column to use gen_random_uuid() as default
ALTER TABLE user_profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
