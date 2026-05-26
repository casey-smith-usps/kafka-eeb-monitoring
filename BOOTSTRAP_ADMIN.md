# Bootstrap Admin Account - Casey Smith

This script creates your admin account so you can access the dashboard with email/password authentication.

## Quick Setup - Run This SQL

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (in the left sidebar)
4. Click **New Query**
5. Paste this SQL and click **Run**:

```sql
-- Create admin account for casey.y.smith@usps.gov
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  temp_password text := 'Admin2024!Temp';
BEGIN
  -- Create user_profile first
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    role,
    status
  )
  VALUES (
    new_user_id,
    'casey.y.smith@usps.gov',
    'Casey Smith',
    'admin',
    'active'
  )
  ON CONFLICT (email)
  DO UPDATE SET
    id = new_user_id,
    role = 'admin',
    status = 'active';

  RAISE NOTICE '✓ Admin account created!';
  RAISE NOTICE 'Email: casey.y.smith@usps.gov';
  RAISE NOTICE 'User ID: %', new_user_id;
  RAISE NOTICE 'Next: Create Supabase auth account (see Step 2 below)';
END $$;
```

## Step 2: Create Authentication Account

Now create the Supabase authentication account:

### Method A: Using Supabase Dashboard (Easiest)

1. In Supabase Dashboard, go to **Authentication** → **Users**
2. Click **Add User** (or **Invite User**)
3. Enter:
   - **Email:** casey.y.smith@usps.gov
   - **Password:** Admin2024!Temp
4. **IMPORTANT:** Check "Auto Confirm User" (or confirm the email)
5. Click **Create User**

### Method B: Using SQL (If Method A doesn't work)

Run this in SQL Editor:

```sql
-- Create Supabase auth user
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  aud,
  role
)
SELECT
  id,
  email,
  NOW(),
  jsonb_build_object('full_name', full_name),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated'
FROM user_profiles
WHERE email = 'casey.y.smith@usps.gov'
ON CONFLICT (email) DO NOTHING;
```

Then set the password:

```sql
-- Set password (Supabase will hash it automatically)
UPDATE auth.users
SET
  encrypted_password = crypt('Admin2024!Temp', gen_salt('bf')),
  email_confirmed_at = NOW(),
  updated_at = NOW()
WHERE email = 'casey.y.smith@usps.gov';
```

## Step 3: Log In

Go to your dashboard and log in:
- **Email:** casey.y.smith@usps.gov
- **Password:** Admin2024!Temp

You should now have full admin access!

## Step 4: Change Password (Recommended)

After logging in, you can change your password through Supabase:

```sql
-- Change password (replace with your new password)
UPDATE auth.users
SET
  encrypted_password = crypt('YourNewSecurePassword!', gen_salt('bf')),
  updated_at = NOW()
WHERE email = 'casey.y.smith@usps.gov';
```

## Troubleshooting

**Problem: "Invalid login credentials"**
- Make sure you confirmed the email in Step 2
- Check that the user exists: `SELECT * FROM auth.users WHERE email = 'casey.y.smith@usps.gov';`
- Try resetting the password using Method B

**Problem: "User not found"**
- Run Step 1 again to create the user_profile
- Make sure Step 2 completed successfully

**Problem: Can see login page but can't log in**
- The user profile exists but auth account doesn't
- Complete Step 2 (Method A or B)

**Still having issues?**
Check what exists:
```sql
-- Check user_profile
SELECT * FROM user_profiles WHERE email = 'casey.y.smith@usps.gov';

-- Check auth user
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'casey.y.smith@usps.gov';
```

Both should return results. If one is missing, re-run that step.
