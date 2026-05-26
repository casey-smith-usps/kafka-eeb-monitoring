# Authentication & Authorization Setup Guide

## Overview

Your EEB Kafka Monitoring Dashboard now has secure authentication and role-based access control (RBAC). This guide explains how to set up users and manage permissions.

---

## Security Improvements Implemented

### 1. Authentication Required
- All users must sign in with email/password
- No access to dashboard without authentication
- Session management handled by Supabase Auth

### 2. Role-Based Access Control (RBAC)
- **Admin**: Full access including Kafka Sync, Splunk Sync, Outlook Sync
- **Viewer**: Read-only access to dashboard, KPIs, and monitoring

### 3. Secure Database Access
- All RLS policies now require authentication (`auth.uid()`)
- No more public access with just the anon key
- Data modifications restricted to admins only

### 4. Protected Features
- **Admin Only** (hidden from viewers):
  - Data Streaming (Kafka Sync, Splunk, Outlook)
  - Topic creation/editing/deletion
  - Alert management
  - Incident tracking modifications

---

## Initial Setup: Creating Your First Admin User

### Step 1: Sign Up

1. Navigate to your dashboard URL
2. Click "Don't have an account? Sign up"
3. Enter your email and password (minimum 6 characters)
4. Click "Create Account"
5. You'll see: "Account created! Please contact an administrator to grant you access."

**Note:** At this point, you have an account but NO role assigned yet.

### Step 2: Find Your User ID

You need to get your user ID from Supabase to assign yourself admin privileges.

**Option A: Via Supabase Dashboard (Easiest)**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "Authentication" in the left sidebar
4. Click "Users"
5. Find your email in the list
6. Copy the `ID` (UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Option B: Via SQL Editor**

1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
```sql
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
```
3. Copy your user ID from the results

### Step 3: Assign Admin Role

In the Supabase SQL Editor, run this command (replace with your actual values):

```sql
INSERT INTO user_roles (user_id, email, role)
VALUES (
  'YOUR-USER-ID-HERE',
  'your-email@domain.com',
  'admin'
);
```

**Example:**
```sql
INSERT INTO user_roles (user_id, email, role)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'john.doe@company.com',
  'admin'
);
```

### Step 4: Sign In

1. Return to the dashboard login page
2. Sign in with your email and password
3. You should now see:
   - Your email and "Administrator" badge in the top right
   - "Data Streaming" menu item visible (with shield icon)
   - Full access to all features

---

## Adding Additional Users

### For Admin Users

1. User signs up via the dashboard
2. You (as admin) get their email
3. Find their user ID in Supabase Dashboard → Authentication → Users
4. Run the SQL command:
```sql
INSERT INTO user_roles (user_id, email, role)
VALUES ('their-user-id', 'their-email@domain.com', 'admin');
```

### For Viewer Users

Same process but use `'viewer'` as the role:

```sql
INSERT INTO user_roles (user_id, email, role)
VALUES ('their-user-id', 'their-email@domain.com', 'viewer');
```

---

## User Permissions Matrix

| Feature | Admin | Viewer |
|---------|-------|--------|
| **Dashboard Overview** | ✅ Read | ✅ Read |
| **All Topics** | ✅ Read/Write | ✅ Read Only |
| **Morning Standup** | ✅ Read/Write | ✅ Read Only |
| **Alerts** | ✅ Read/Write | ✅ Read Only |
| **Topic Lineage** | ✅ Read/Write | ✅ Read Only |
| **Data Streaming (Kafka Sync)** | ✅ Full Access | ❌ Hidden |
| **On-Call Escalation** | ✅ Read/Write | ✅ Read Only |
| **AI Assistant** | ✅ Full Access | ✅ Full Access |
| **Documents** | ✅ Read/Write | ✅ Read Only |
| **Architecture** | ✅ Read | ✅ Read |

---

## Managing Roles

### Check a User's Role

```sql
SELECT email, role, created_at, updated_at
FROM user_roles
WHERE email = 'user@domain.com';
```

### Change a User's Role

```sql
UPDATE user_roles
SET role = 'admin', updated_at = now()
WHERE email = 'user@domain.com';
```

### Remove a User's Access

```sql
DELETE FROM user_roles
WHERE email = 'user@domain.com';
```

**Note:** The user can still sign in, but will see "Access Pending" message.

### List All Users and Their Roles

```sql
SELECT
  ur.email,
  ur.role,
  ur.created_at as role_assigned_at,
  au.created_at as account_created_at,
  au.last_sign_in_at
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
ORDER BY ur.created_at DESC;
```

---

## Troubleshooting

### Problem: User signed up but can't access dashboard

**Solution:** The user hasn't been assigned a role yet. Follow Step 3 above to assign them a role.

### Problem: User sees "Admin Access Required" when trying to access Data Streaming

**Solution:** The user is assigned as `viewer`. Either:
- Change their role to `admin` if they need access
- Explain that Data Streaming is admin-only

### Problem: Forgot which email I used to sign up

**Solution:** Check Supabase Dashboard → Authentication → Users to see all registered emails.

### Problem: Need to reset a user's password

**Solution:**
1. Have the user use "Forgot Password" on the login page (if implemented)
2. OR delete their account and have them sign up again:
```sql
DELETE FROM auth.users WHERE email = 'user@domain.com';
```

### Problem: User is admin but Data Streaming is still hidden

**Solution:**
1. Have the user sign out and sign back in
2. Verify in database:
```sql
SELECT * FROM user_roles WHERE email = 'user@domain.com';
```
3. If role is correct, clear browser cache

---

## Security Best Practices

### 1. Limit Admin Users
- Only give admin access to team members who need to sync data
- Most users should be viewers

### 2. Use Strong Passwords
- Minimum 12 characters
- Mix of letters, numbers, symbols
- Don't reuse passwords

### 3. Regular Access Reviews
- Monthly: Review who has admin access
- Quarterly: Remove access for users who left the team

```sql
-- Get list of all admins for review
SELECT email, created_at, last_sign_in_at
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE ur.role = 'admin'
ORDER BY au.last_sign_in_at DESC;
```

### 4. Audit Trail
- All modifications now require authentication
- User email is captured in auth context
- Consider enabling Supabase audit logs for compliance

### 5. Keep Credentials Secure
- Never share the Supabase service role key
- Store environment variables securely
- Rotate API keys regularly

---

## What Viewers Cannot Do

Viewers have read-only access and **cannot**:
- Sync data from Kafka/Splunk/Outlook
- Add, edit, or delete topics
- Create or resolve alerts
- Modify incident tracking
- Add or edit documents
- Change on-call schedules
- Delete any data

They **can**:
- View all dashboards and metrics
- Use the AI Assistant
- View topic details and lineage
- See alerts and incidents
- View documents
- See on-call schedules

---

## Advanced: Automating Role Assignment

If you want to automatically assign roles based on email domain or other criteria, you can create a Supabase Database Function:

```sql
CREATE OR REPLACE FUNCTION auto_assign_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-assign admin to specific email domain
  IF NEW.email LIKE '%@yourdomain.com' THEN
    INSERT INTO user_roles (user_id, email, role)
    VALUES (NEW.id, NEW.email, 'viewer');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_role();
```

**Warning:** Be careful with auto-assignment. Manually assigning roles is safer.

---

## Questions Leadership Might Ask

### "How do we know who has access?"

Run this query to see all users and their roles:
```sql
SELECT email, role FROM user_roles ORDER BY email;
```

### "Can someone with the anon key still access the database?"

No. All RLS policies now require authentication. The anon key alone is not enough.

### "What if we need to give temporary access to a contractor?"

1. Create a viewer account for them
2. When contract ends, delete their role:
```sql
DELETE FROM user_roles WHERE email = 'contractor@company.com';
```

### "How is this different from before?"

**Before:**
- Anyone with the anon key could read/write ALL data
- No authentication required
- No audit trail

**After:**
- Must be authenticated user with assigned role
- Admins can write, viewers can only read
- All actions tied to user identity

---

## Next Steps

1. ✅ Set up your admin account (Steps 1-4 above)
2. ✅ Sign in and verify you see "Administrator" badge
3. ✅ Test Data Streaming sync to confirm admin access
4. ⬜ Add your manager as admin or viewer
5. ⬜ Document who should have admin vs viewer access
6. ⬜ Schedule monthly access reviews

---

## Support

If you encounter issues:

1. Check the browser console for errors (F12)
2. Verify your role in Supabase:
   ```sql
   SELECT * FROM user_roles WHERE email = 'your-email@domain.com';
   ```
3. Review the SECURITY_ARCHITECTURE_ANALYSIS.md document
4. Check Supabase logs in Dashboard → Logs

---

**Document Version:** 1.0
**Last Updated:** 2026-02-23
**Next Review:** 2026-03-23
