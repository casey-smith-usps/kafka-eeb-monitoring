# Quick Start - Get Into Your Dashboard

Casey, follow these 2 steps to access your dashboard:

## Step 1: Create Your User Profile (30 seconds)

Run this in Supabase SQL Editor:

```sql
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role, status)
  VALUES (new_user_id, 'casey.y.smith@usps.gov', 'Casey Smith', 'admin', 'active')
  ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'active';

  RAISE NOTICE 'Done! User ID: %', new_user_id;
END $$;
```

## Step 2: Create Supabase Auth Account (1 minute)

**Option A - Use Dashboard (Easiest):**
1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Click **Add User**
3. Email: `casey.y.smith@usps.gov`
4. Password: `Admin2024!Temp`
5. Check "Auto Confirm User"
6. Click Create

**Option B - Use SQL:**
```sql
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
SELECT id, email, NOW(), jsonb_build_object('full_name', full_name), NOW(), NOW(), 'authenticated', 'authenticated'
FROM user_profiles WHERE email = 'casey.y.smith@usps.gov';

UPDATE auth.users SET encrypted_password = crypt('Admin2024!Temp', gen_salt('bf')), email_confirmed_at = NOW()
WHERE email = 'casey.y.smith@usps.gov';
```

## Done! Now Log In

- Email: **casey.y.smith@usps.gov**
- Password: **Admin2024!Temp**

You're now an admin with full access!

---

## What Changed & Why You Couldn't Login

**What I Updated:**
- `src/components/RequestAccess.tsx` - Removed token system, now uses email/password
- `src/components/Layout.tsx` - Added notification badge for pending access requests
- `supabase/functions/send-welcome-email/index.ts` - Updated email template for password-based login
- New migration for notification system
- `ACCESS_MANAGEMENT_GUIDE.md` - Complete documentation

**Why you couldn't log in:**
- The system now requires BOTH:
  1. A record in `user_profiles` table (you probably had this)
  2. A Supabase auth account in `auth.users` (you didn't have this)

- My changes switched from tokens to proper Supabase authentication
- Your old account was in the old system without a Supabase auth account
- The bootstrap script creates both for you

**Is this on your local version?**
- All changes are in your local project files
- The code changes are local
- The database migration is applied to your Supabase (cloud)
- Once you bootstrap your account, both local and deployed versions will work

## How Access Requests Work Now

1. Users fill out the request form (name, email, reason)
2. **You see a red badge** on "User Management" menu
3. You approve them in User Management → Access Requests tab
4. System creates their Supabase account automatically
5. You send them their email/password credentials
6. They log in once and stay logged in (no more tokens!)
