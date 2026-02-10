# Outlook Email Integration Guide

This guide explains how to automatically import ServiceNow incidents from your Outlook emails into the Kafka Monitoring Dashboard.

## Overview

The system can automatically sync incidents from ServiceNow emails sent to your Outlook inbox. This eliminates manual data entry and ensures your incident tracker is always up to date.

## What Gets Synced

The integration automatically imports:

- **Incident Number** (e.g., INC000010315886)
- **Priority** (1-Critical, 2-High, 3-Medium, 4-Low)
- **Business Service** (e.g., Enterprise Event Broker)
- **Category** (e.g., Application, Infrastructure)
- **Subcategory** (e.g., Error Message, Performance)
- **Short Description** (from email subject and body)
- **Assignment Group** (e.g., SDS Enterprise Event Broker)
- **Activity Log** (all work notes and updates)
- **Created Date** (when the incident was created)

## Email Format Detected

The system looks for emails matching this pattern:

**From:** IT ServiceNow <usps@servicenowservices.com>
**Subject:** ServiceNow:

Example email body structure:
```
SDS Enterprise Event Broker,

An Incident (INC000010315886) assigned to your group has been updated.

Activity Log
________________________________________
2026-01-08 02:41:17 AM CST - Shirley B Hargett Work Notes
Alert that was in alarm has cleared on it's own.
________________________________________
2026-01-08 02:32:24 AM CST - Seid Dzafic Work Notes
Invalidating CI, alert cleared after 19 minutes.
________________________________________

Incident Details
Number	INC000010315886
Priority	1 - Critical
Business Service	Enterprise Event Broker
Category	Application
Subcategory	Error Message
Short Description	Splunk Observability Critical Alert
Assignment Group	SDS Enterprise Event Broker
Created	2026-01-08 01:41:47 AM CST
```

## How to Use the Integration

### Option 1: Microsoft Graph API Integration (Recommended)

This method uses Microsoft's official API to securely access your Outlook emails.

#### Step 1: Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Name it "Kafka Monitoring - Email Sync"
5. Set redirect URI (if needed): `https://your-app-url.com`
6. Click **Register**

#### Step 2: Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add these permissions:
   - `Mail.Read` - Read user mail
   - `User.Read` - Sign in and read user profile
6. Click **Grant admin consent**

#### Step 3: Get Client Credentials

1. Go to **Certificates & secrets**
2. Create a **New client secret**
3. Copy the **Value** (you'll need this)
4. Go to **Overview** and copy:
   - **Application (client) ID**
   - **Directory (tenant) ID**

#### Step 4: Authenticate and Get Access Token

You'll need to implement OAuth2 authentication flow in your frontend to get an access token. Here's a simple example:

```javascript
// Install @azure/msal-browser
import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: 'YOUR_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
    redirectUri: window.location.origin
  }
};

const msalInstance = new PublicClientApplication(msalConfig);

// Login and get token
async function getAccessToken() {
  const loginRequest = {
    scopes: ['Mail.Read', 'User.Read']
  };

  try {
    const response = await msalInstance.loginPopup(loginRequest);
    return response.accessToken;
  } catch (error) {
    console.error('Login failed:', error);
  }
}
```

#### Step 5: Call the Sync Function

Once you have an access token, call the edge function:

```javascript
async function syncOutlookIncidents() {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/sync-outlook-incidents`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accessToken })
    }
  );

  const result = await response.json();
  console.log('Synced incidents:', result);
}
```

### Option 2: Manual Sync (Quick Start)

For quick testing or one-time imports, you can manually trigger the sync:

1. Get a temporary access token from Microsoft Graph Explorer:
   - Go to [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
   - Sign in with your account
   - Grant Mail.Read permission
   - Copy the access token

2. Call the API:
```bash
curl -X POST https://your-supabase-url.supabase.co/functions/v1/sync-outlook-incidents \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "YOUR_MICROSOFT_GRAPH_TOKEN"}'
```

## What Happens During Sync

1. **Fetches Emails**: Gets the 50 most recent ServiceNow emails from your inbox
2. **Parses Content**: Extracts incident details from email body
3. **Smart Matching**:
   - If incident already exists → Updates activity log with new entries
   - If incident is new → Creates new alert in database
4. **Auto-Categorizes**:
   - Maps priority to severity (1→Critical, 2→High, 3→Medium, 4→Low)
   - Determines alert type from category/subcategory
   - Links to related topics if mentioned

## Viewing Synced Incidents

### 1. Alerts Dashboard
- Go to **Alerts** page
- Click on any incident to see full details
- View complete activity log
- See all ServiceNow metadata

### 2. Incident Detail Modal
Click any incident to see:
- Full incident number and title
- Priority and severity levels
- Business service and category
- Complete activity log timeline
- Related Kafka topics
- Resolution status

### 3. Morning Standup
- See all open incidents at a glance
- Organized by severity
- Quick view of recent activity
- Linked to related topics

## Automatic Alert Type Detection

The system intelligently categorizes incidents:

| Category/Subcategory | Alert Type |
|---------------------|------------|
| Schema-related | `schema_issue` |
| Performance/Latency | `performance_degradation` |
| Missing data/volume | `performance_degradation` |
| Everything else | `manual` |

## Activity Log Updates

When an existing incident receives updates:
- New activity log entries are **appended** (not replaced)
- Duplicate entries are automatically filtered out
- Timestamps and authors are preserved
- `last_updated` field is refreshed

## Benefits

✅ **No Manual Entry** - Incidents auto-import from email
✅ **Always Current** - Sync whenever you want
✅ **Complete History** - Full activity logs preserved
✅ **Smart Linking** - Auto-links to Kafka topics
✅ **Duplicate Prevention** - Won't create duplicates
✅ **Rich Metadata** - All ServiceNow fields captured

## Scheduling Automatic Syncs

You can set up automatic syncing by:

1. **Browser Extension**: Create a simple Chrome extension that runs the sync every hour
2. **Scheduled Task**: Use Windows Task Scheduler or cron to run sync script
3. **Power Automate**: Set up a Microsoft Power Automate flow
4. **Azure Function**: Deploy a timer-triggered function to sync hourly

Example scheduled sync (every hour):
```javascript
// Run this in a scheduled task
setInterval(async () => {
  try {
    await syncOutlookIncidents();
    console.log('Sync completed:', new Date());
  } catch (error) {
    console.error('Sync failed:', error);
  }
}, 60 * 60 * 1000); // Every hour
```

## Troubleshooting

### "Failed to fetch emails from Microsoft Graph API"
- Check your access token is valid (tokens expire after ~1 hour)
- Verify Mail.Read permission is granted
- Ensure you're signed in to the correct account

### "No incidents found"
- Verify emails exist from `usps@servicenowservices.com`
- Check email subject contains "ServiceNow:"
- Try expanding the search window in Graph API query

### "Incident not parsing correctly"
- Email format may have changed
- Check the edge function logs in Supabase dashboard
- Verify email body contains "Activity Log" section

### "Duplicates created"
- This shouldn't happen - the system checks `incident_number`
- If it does, report as a bug with the incident number

## Security Notes

- Access tokens are **never stored** in the database
- Tokens are only used during sync operation
- Edge function runs with proper authentication
- All data is stored securely in Supabase
- Row Level Security (RLS) protects your data

## Next Steps

1. Set up Azure AD app registration
2. Implement OAuth flow in your frontend
3. Test with a manual sync first
4. Set up automatic scheduling
5. Monitor the Alerts dashboard for new incidents

## Support

For issues or questions:
1. Check the edge function logs in Supabase dashboard
2. Verify your Microsoft Graph API permissions
3. Test with Microsoft Graph Explorer first
4. Review the activity log in synced incidents
