/*
  # Add Token Validation Helper Function

  1. Purpose
    - Create helper function to validate if current request has valid token
    - Used by RLS policies to grant access based on token authentication
    - Checks if token exists in request headers and matches active user

  2. Function Details
    - Name: is_valid_token()
    - Returns: boolean
    - Checks: Authorization header contains valid token from user_profiles
    - Security: Only allows active users with valid tokens
*/

-- Create function to validate token from Authorization header
CREATE OR REPLACE FUNCTION is_valid_token()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_value text;
  user_exists boolean;
BEGIN
  -- Get token from Authorization header (format: "Bearer <token>")
  token_value := current_setting('request.headers', true)::json->>'authorization';
  
  -- Remove "Bearer " prefix if present
  IF token_value IS NOT NULL AND token_value LIKE 'Bearer %' THEN
    token_value := substring(token_value from 8);
  END IF;
  
  -- Check if token exists in user_profiles and user is active
  SELECT EXISTS(
    SELECT 1 FROM user_profiles 
    WHERE access_token = token_value 
      AND status = 'active'
  ) INTO user_exists;
  
  RETURN COALESCE(user_exists, false);
END;
$$;
