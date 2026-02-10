# Quick Start: Kafka Topic Sync

Get your Kafka topics syncing to Supabase in 5 minutes.

## 🚀 Quick Setup

### 1. Get Confluent Cloud Credentials

Visit [Confluent Cloud Console](https://confluent.cloud/):

1. **Cluster ID**: Go to your cluster → Copy the ID (format: `lkc-xxxxx`)
2. **Admin URL**: Your cluster's REST endpoint (e.g., `https://pkc-xxxxx.us-east-1.aws.confluent.cloud`)
3. **API Key & Secret**:
   - Go to **Data integration → API keys**
   - Click **Create key** → Choose "Global access"
   - Save both the key and secret

### 2. Get Supabase Service Role Key

Visit [Supabase Dashboard](https://supabase.com/dashboard):

1. Select your project
2. Go to **Settings → API**
3. Copy the **service_role** key (NOT the anon key)

### 3. Update .env File

Open `.env` and replace these values:

```env
SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key

CONFLUENT_ADMIN_URL=https://pkc-xxxxx.us-east-1.aws.confluent.cloud
CONFLUENT_CLUSTER_ID=lkc-xxxxx
CONFLUENT_API_KEY=your-actual-api-key
CONFLUENT_API_SECRET=your-actual-api-secret
```

### 4. Test the Sync

Run the script manually:

```bash
npm run sync:kafka
```

You should see:
```
🚀 Kafka Topic Sync Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Configuration validated
✓ Fetched 42 topics from Confluent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Created: dev.orders.events
✓ Created: prod.users.stream
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sync completed successfully
```

### 5. Schedule It (Choose One)

#### Option A: GitHub Actions (Easiest)

1. Create `.github/workflows/kafka-sync.yml`:
   ```yaml
   name: Kafka Topic Sync
   on:
     schedule:
       - cron: '*/10 * * * *'
   jobs:
     sync:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
         - run: npm ci
         - run: npm run sync:kafka
           env:
             SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
             SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
             CONFLUENT_ADMIN_URL: ${{ secrets.CONFLUENT_ADMIN_URL }}
             CONFLUENT_CLUSTER_ID: ${{ secrets.CONFLUENT_CLUSTER_ID }}
             CONFLUENT_API_KEY: ${{ secrets.CONFLUENT_API_KEY }}
             CONFLUENT_API_SECRET: ${{ secrets.CONFLUENT_API_SECRET }}
   ```

2. Add secrets in GitHub: **Settings → Secrets → Actions → New secret**

#### Option B: Cron Job (Linux/Mac)

```bash
crontab -e

# Add this line:
*/10 * * * * cd /path/to/project && npm run sync:kafka
```

#### Option C: Windows Task Scheduler

1. Create `sync-kafka.bat`:
   ```batch
   cd C:\path\to\project
   npm run sync:kafka
   ```

2. Task Scheduler → Create Task → Trigger: Every 10 minutes

## 🎯 What Happens Next?

Every 10 minutes:
1. Script fetches all topics from Confluent
2. New topics are added to your database
3. Existing topics are updated
4. Naming violations trigger alerts
5. Dashboard automatically shows latest data

## 🐛 Troubleshooting

### "Missing required environment variables"
- Check `.env` file has all values filled in (no `your-xxx-here` placeholders)

### "Confluent API error (401)"
- API key or secret is wrong
- Regenerate credentials in Confluent Cloud

### "Confluent API error (403)"
- API key doesn't have permission
- Create new key with "Global access"

### Still stuck?
See full guide: `KAFKA_SYNC_DEPLOYMENT.md`

## 📊 Verify It's Working

1. Check your dashboard after running the script
2. Topics should appear in **Topics Overview**
3. Alerts should show in **Alerts Dashboard**
4. Check logs: `npm run sync:kafka` shows detailed output

---

**That's it!** You now have automated Kafka topic syncing. 🎉

See `KAFKA_SYNC_DEPLOYMENT.md` for advanced deployment options and monitoring.
