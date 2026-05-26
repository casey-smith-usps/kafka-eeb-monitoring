# Access Management Guide

## Overview

Your dashboard now uses proper Supabase email/password authentication instead of temporary tokens. Users receive persistent login credentials and stay signed in across sessions.

## How It Works

### For New Users (Requesting Access)

1. **User visits the dashboard** and sees the login page
2. **User clicks "Request Access"** (or goes to `/request-access`)
3. **User fills out the request form:**
   - Full Name
   - Email Address
   - Reason for Access (optional)
4. **User submits the request**
5. **System creates a pending access request** in the database
6. **You (admin) are notified** via a red badge on the "User Management" menu

### For You (Admin - Approving Access)

1. **You see a red notification badge** on "User Management" in the sidebar showing the number of pending requests
2. **Click "User Management"** to open the access management screen
3. **You'll see two tabs:**
   - **Access Requests** - Shows all pending requests (this is where new requests appear)
   - **Active Users** - Shows all approved users

4. **Review the pending request** - You'll see:
   - Name
   - Email
   - Reason for access
   - When they requested

5. **Approve the request** by clicking "Approve" and selecting a role:
   - **Admin** - Full access to manage users and all data
   - **Editor** - Can create, edit, and delete topics and incidents
   - **Viewer** - Read-only access

6. **System automatically:**
   - Creates a Supabase authentication account
   - Generates a secure 16-character temporary password
   - Creates their user profile with the role you selected
   - Attempts to send them an email (if configured)

7. **Send them their credentials:**
   - **Option A (Automated):** If email is working, they'll receive credentials automatically
   - **Option B (Manual):** Click the "Email" button next to their name to copy the email template with their credentials, then send it via your email

### For Approved Users (Logging In)

1. **User receives email** with their login credentials:
   - Dashboard URL
   - Email address
   - Temporary password

2. **User opens the dashboard** and enters their email and password

3. **User stays logged in:**
   - Session persists when they close the browser
   - Session persists across tabs
   - They only need to log in once (unless they explicitly sign out)
   - No more entering tokens repeatedly!

## Where to Manage Access

### Navigation
1. Log in to your dashboard as an admin
2. Look at the left sidebar
3. Click **"User Management"** (near the bottom of the menu)
4. If there are pending requests, you'll see a **red badge with a number**

### User Management Screen

**Access Requests Tab:**
- Shows all pending access requests
- For each request you can:
  - Approve (and assign a role)
  - Reject
  - See the reason they provided

**Active Users Tab:**
- Shows all approved users
- For each user you can:
  - See their role (Admin, Editor, Viewer)
  - See their status (Active, Disabled)
  - Copy their access information
  - Send them the welcome email
  - Change their role
  - Disable their account

## Notifications

### Real-Time Badge
- The "User Management" menu item shows a **red badge** with the count of pending requests
- Updates automatically when new requests come in
- Badge disappears when all requests are processed

### No Email Notifications Yet
Currently, you need to check the dashboard to see requests. The red badge will alert you. In the future, we can add:
- Email notifications to your admin email
- Teams/Slack notifications
- Browser push notifications

## Security Notes

- Users receive a **temporary password** they can change after first login
- Passwords are **16 characters long** with mixed characters (very secure)
- Sessions are managed by **Supabase** (industry-standard security)
- All authentication is **encrypted** and follows best practices
- Only **active users** can log in (you can disable accounts anytime)

## Troubleshooting

**Q: I don't see the notification badge**
- Make sure you're logged in as an Admin
- Refresh the page to ensure the latest data loads
- Check the Access Requests tab in User Management

**Q: How do I send credentials to users?**
- Go to User Management → Active Users
- Find the newly approved user
- Click the "Email" button next to their name
- Copy the email template (includes their password)
- Send it via your email system

**Q: Can users change their password?**
- Yes! After logging in, they can use Supabase's built-in password reset
- You can also manually reset passwords through User Management

**Q: What if I accidentally approve the wrong person?**
- Go to User Management → Active Users
- Find the user and click "Disable"
- Their account will be immediately deactivated

## Changes from Previous System

### Before (Token-Based)
- Users needed a token to log in
- Token had to be entered every time
- No persistent sessions
- Users kept asking for the token
- Manual token management

### Now (Email/Password)
- Users get proper email/password credentials
- Login once and stay logged in
- Sessions persist across browser sessions
- Standard login experience
- Automatic account creation on approval
