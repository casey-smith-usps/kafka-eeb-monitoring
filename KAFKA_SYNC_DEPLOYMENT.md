# Kafka Topic Sync - Deployment Guide

This guide explains how to deploy and schedule the standalone Kafka sync script to automatically fetch topics from Confluent Cloud and sync them to your Supabase database.

## 🎯 Overview

The `scripts/sync-kafka-topics.js` script is a standalone Node.js application that:
- Fetches all topics from your Confluent Cloud cluster
- Syncs them to your Supabase database
- Creates alerts for naming violations
- Runs independently of your web application
- Can be scheduled to run automatically

## 📋 Prerequisites

1. **Confluent Cloud Access**
   - Admin API URL
   - Cluster ID
   - API Key & Secret

2. **Supabase Access**
   - Project URL
   - Service Role Key (found in Supabase Dashboard → Settings → API)

3. **Node.js** (v18 or higher)

## ⚙️ Configuration

### Step 1: Update Environment Variables

Add these variables to your `.env` file:

```env
# Existing Supabase Config
SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Confluent Cloud Config (add these)
CONFLUENT_ADMIN_URL=https://pkc-xxxxx.us-east-1.aws.confluent.cloud
CONFLUENT_CLUSTER_ID=lkc-xxxxx
CONFLUENT_API_KEY=your-api-key
CONFLUENT_API_SECRET=your-api-secret
```

### Step 2: Get Confluent Cloud Credentials

1. Log in to [Confluent Cloud Console](https://confluent.cloud/)
2. Navigate to your cluster
3. Get your **Cluster ID** from the cluster settings
4. Get your **Bootstrap URL** (Admin API URL is the same but without port)
5. Create an API Key:
   - Go to **Data integration → API keys**
   - Click **Create key**
   - Select "Global access" or appropriate scope
   - Save the Key and Secret

### Step 3: Get Supabase Service Role Key

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings → API**
4. Copy the **service_role** key (NOT the anon key)
5. Add it to `.env` as `SUPABASE_SERVICE_ROLE_KEY`

## 🧪 Testing Locally

Run the script manually to test:

```bash
npm run sync:kafka
```

Expected output:
```
🚀 Kafka Topic Sync Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Configuration validated
📡 Fetching topics from: https://...
✓ Fetched 42 topics from Confluent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Created: dev.orders.events
✓ Created: prod.users.stream
⚠️  Alert created for: invalid-topic (naming violation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Sync Results:
   New topics synced: 35
   Existing topics updated: 7
   Failed: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sync completed successfully
```

## 🚀 Deployment Options

Choose the deployment option that best fits your infrastructure:

### Option 1: Scheduled Task on Server (Linux/Mac)

Use **cron** to run the script every 10 minutes:

```bash
# Edit crontab
crontab -e

# Add this line to run every 10 minutes
*/10 * * * * cd /path/to/project && npm run sync:kafka >> /var/log/kafka-sync.log 2>&1
```

### Option 2: GitHub Actions (Recommended for GitHub-hosted projects)

Create `.github/workflows/kafka-sync.yml`:

```yaml
name: Kafka Topic Sync

on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run Kafka sync
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          CONFLUENT_ADMIN_URL: ${{ secrets.CONFLUENT_ADMIN_URL }}
          CONFLUENT_CLUSTER_ID: ${{ secrets.CONFLUENT_CLUSTER_ID }}
          CONFLUENT_API_KEY: ${{ secrets.CONFLUENT_API_KEY }}
          CONFLUENT_API_SECRET: ${{ secrets.CONFLUENT_API_SECRET }}
        run: npm run sync:kafka
```

Then add secrets in GitHub:
- Go to **Settings → Secrets and variables → Actions**
- Add all the required environment variables as secrets

### Option 3: Docker Container

Create `Dockerfile.sync`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY scripts/ ./scripts/
COPY .env ./

CMD ["node", "scripts/sync-kafka-topics.js"]
```

Build and run:

```bash
# Build
docker build -f Dockerfile.sync -t kafka-sync .

# Run once
docker run --env-file .env kafka-sync

# Schedule with cron or Kubernetes CronJob
```

### Option 4: AWS Lambda (Serverless)

1. Package the script and dependencies
2. Create Lambda function with Node.js 18 runtime
3. Add environment variables in Lambda configuration
4. Set up EventBridge rule to trigger every 10 minutes

### Option 5: Heroku Scheduler

1. Deploy your app to Heroku
2. Install Heroku Scheduler addon:
   ```bash
   heroku addons:create scheduler:standard
   ```
3. Add job in Heroku Dashboard:
   - Command: `npm run sync:kafka`
   - Frequency: Every 10 minutes

### Option 6: Windows Task Scheduler

1. Create a batch file `sync-kafka.bat`:
   ```batch
   @echo off
   cd C:\path\to\project
   npm run sync:kafka >> C:\logs\kafka-sync.log 2>&1
   ```

2. Open Task Scheduler → Create Task:
   - **Trigger**: Every 10 minutes
   - **Action**: Run `sync-kafka.bat`

## 📊 Monitoring

### View Logs

The script outputs structured logs that you can monitor:

```bash
# Linux/Mac
tail -f /var/log/kafka-sync.log

# Windows
type C:\logs\kafka-sync.log
```

### Check Sync Results in Dashboard

After running the script, check your dashboard:
1. Topics should appear in the Topics Overview
2. Alerts should be created for naming violations
3. Check the KPI Dashboard for sync statistics

### Set Up Alerts

Monitor script failures:

```bash
# Add to your monitoring system
if [ $? -ne 0 ]; then
  # Send alert (email, Slack, PagerDuty, etc.)
  curl -X POST https://hooks.slack.com/... \
    -d '{"text":"Kafka sync failed!"}'
fi
```

## 🔧 Troubleshooting

### "Missing required environment variables"

Make sure all variables are set in `.env`:
```bash
# Check current values
node -e "require('dotenv').config(); console.log(process.env)"
```

### "Confluent API error (401)"

Your API credentials are invalid:
1. Verify API Key and Secret in Confluent Cloud
2. Check that the key has appropriate permissions
3. Ensure you're using the correct cluster ID

### "Confluent API error (403)"

Your API key doesn't have permission:
1. Create a new API key with "Global access"
2. Or assign specific cluster permissions

### "Failed to connect to Supabase"

Check your Supabase credentials:
1. Verify SUPABASE_URL is correct
2. Use the **service_role** key, not anon key
3. Check network connectivity to Supabase

### Topics not appearing in dashboard

1. Check script output for errors
2. Verify database connection
3. Check RLS policies on `topics` table
4. Look for failed syncs in the script output

## 🎯 Best Practices

1. **Run every 10-15 minutes** to keep data fresh without overloading APIs
2. **Monitor logs** to catch failures early
3. **Set up alerts** for script failures
4. **Use service accounts** for API keys (not personal credentials)
5. **Rotate credentials** regularly
6. **Test locally** before deploying
7. **Keep dependencies updated** (`npm audit` regularly)

## 🔐 Security Notes

- Never commit `.env` file to version control
- Use environment variables or secrets management
- Rotate API keys periodically
- Use least-privilege API keys (only required permissions)
- Monitor API usage in Confluent Cloud

## 📚 Additional Resources

- [Confluent Cloud API Docs](https://docs.confluent.io/cloud/current/api.html)
- [Supabase Service Role Key](https://supabase.com/docs/guides/api/api-keys)
- [Node.js Scheduling Options](https://nodejs.org/en/docs/)

## ❓ Need Help?

If the sync script isn't working:

1. Run locally with `npm run sync:kafka` to see error messages
2. Check all environment variables are correct
3. Verify Confluent Cloud connectivity
4. Check Supabase service role key permissions
5. Review logs for specific error messages

---

**Ready to deploy?** Start with **Option 2 (GitHub Actions)** if your code is on GitHub, or **Option 1 (Cron)** if you have a server.
