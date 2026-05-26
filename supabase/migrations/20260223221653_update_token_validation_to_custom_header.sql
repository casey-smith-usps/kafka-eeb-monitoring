/*
  # Update Token Validation to Use Custom Header

  1. Changes
    - Update is_valid_token() function to read from X-Access-Token header
    - This avoids JWT validation errors when using custom tokens
    - Maintains same security model with active user validation

  2. Security
    - Still validates token against user_profiles table
    - Still requires user status to be 'active'
    - Just changes the header name from Authorization to X-Access-Token
*/

-- Update function to read from X-Access-Token header instead of Authorization
CREATE OR REPLACE FUNCTION is_valid_token()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_value text;
  user_exists boolean;
BEGIN
  -- Get token from X-Access-Token header
  token_value := current_setting('request.headers', true)::json->>'x-access-token';
  
  -- Check if token exists in user_profiles and user is active
  SELECT EXISTS(
    SELECT 1 FROM user_profiles 
    WHERE access_token = token_value 
      AND status = 'active'
  ) INTO user_exists;
  
  RETURN COALESCE(user_exists, false);
END;
$$;
