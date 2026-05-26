# Confluent Cloud Integration Guide

## Getting Your Confluent Cloud Credentials

### Step 1: Access Confluent Cloud
1. Log in to [Confluent Cloud](https://confluent.cloud)
2. Select your environment (DEV, SIT, CAT, or PROD)

### Step 2: Get Cluster Information

#### Find Your Cluster ID:
1. Navigate to **Clusters** in the left sidebar
2. Click on your cluster name
3. Go to **Cluster Settings** or **Cluster Overview**
4. Look for **Cluster ID** (format: `lkc-xxxxx`)
5. Copy this ID - you'll need it for the sync

#### Find Your REST Endpoint:
1. In the same Cluster Settings page
2. Look for **Bootstrap server** or **REST Endpoint**
3. The URL format is typically:
   ```
   https://pkc-xxxxx.us-east-1.aws.confluent.cloud:443
   ```
4. Copy this full URL

### Step 3: Create Cluster API Key and Secret

#### Option A: Cluster-Specific API Key (Recommended)
1. Go to your cluster in Confluent Cloud
2. Click **API Keys** in the cluster menu
3. Click **+ Add key** or **Create API Key**
4. Select **My account**
5. Choose scope: **Global access** or specific ACLs
6. Click **Continue**
7. **IMPORTANT:** Copy both the **API Key** and **API Secret** immediately
   - The secret is only shown once!
   - Save them securely (password manager, secure notes)

#### Option B: Cloud API Key
1. Go to **Administration** → **API Keys** (top-right menu)
2. Click **+ Add key**
3. Select **Cloud API key**
4. Click **Continue**
5. Copy and save the credentials

### Step 4: Create Schema Registry API Key (Optional - for Schema Sync)

If you want to sync Avro schemas and schema versions:

1. **Navigate to Schema Registry:**
   - Click **"Schema Registry"** in the left sidebar
   - OR go to your **Environment** → **Schema Registry** tab

2. **Find Schema Registry URL:**
   - Copy the Schema Registry endpoint
   - Format: `https://psrc-xxxxx.region.provider.confluent.cloud`
   - Example: `https://psrc-9z1qj.us-east-2.aws.confluent.cloud`

3. **Create Schema Registry API Key:**
   - Click on **"API credentials"** or **"API Keys"** within Schema Registry
   - Click **"+ Add key"** or **"Create API key"**
   - Select **"Schema Registry API key"** (NOT cluster API key)
   - Click **"Continue"**

4. **Save Credentials:**
   - Copy the **API Key**
   - Copy the **API Secret** (shown only once!)
   - Store securely with your other credentials

**Important:** Schema Registry credentials are SEPARATE from Cluster credentials. You need both if you want to sync schemas.

### Required Permissions

Your API key needs these permissions:
- `CloudClusterAdmin` (full access), OR
- Resource-specific access:
  - `DescribeTopics` (read topic metadata)
  - `DescribeConfigs` (read configurations)

### Step 5: Sync Your Data in the Dashboard

1. Open your EEB Dashboard
2. Navigate to **All Topics** view
3. Click **"Sync Kafka"** button
4. Fill in the form:
   - **Kafka Admin API URL**: Your REST endpoint
   - **Cluster ID**: Your cluster ID (lkc-xxxxx)
   - **API Key**: Your cluster API key
   - **API Secret**: Your cluster API secret
   - **Schema Registry URL** (optional): Your Schema Registry endpoint
   - **Schema Registry API Key** (optional): Your Schema Registry key
   - **Schema Registry API Secret** (optional): Your Schema Registry secret
5. Click **"Sync Topics"**

## What Gets Synced

The sync will automatically pull:
- ✅ All topic names
- ✅ Partition counts
- ✅ Replication factors
- ✅ Retention policies (in milliseconds)
- ✅ Auto-detection of environment from topic name
- ✅ Avro schema definitions and versions (if Schema Registry configured)

### Auto Environment Detection

Topics are automatically assigned to environments based on their prefix:
- `dev.` → DEV environment
- `sit.` → SIT environment
- `cat.` → CAT environment
- `prod.` → PROD environment

### Naming Validation

Topics are automatically validated against naming conventions:
- Format: `{env}.{domain}.{subdomain}.{entity}.v{version}`
- Example: `prod.operations.imdas.mmd.v1`
- Violations automatically create alerts

## Syncing Multiple Environments

You have 4 environments to sync. Here's the recommended approach:

### Option 1: Sync Each Environment Separately
1. Sync DEV cluster
2. Sync SIT cluster
3. Sync CAT cluster
4. Sync PROD cluster

**Benefits:**
- Clear separation
- Easy to track which environment data came from
- Can sync on different schedules

### Option 2: Sync All at Once
If all your topics are in one cluster:
1. Run sync once
2. Topics auto-assign to correct environment based on name prefix

## Importing Your Existing Tracking Data

You have several Excel sheets with existing topic tracking data. Here's how to import them:

### Method 1: Excel Import (Recommended for Initial Load)

#### For Topic Data:
1. Click **"Import Excel"** in the Topics view
2. Download the template
3. Map your existing columns:

```
Your Column           →    Template Column
─────────────────────────────────────────
Topic Name            →    name
Description           →    description
Status                →    status (in_progress/complete/historical)
Environment           →    environment (dev/sit/cat/prod)
Owner Team            →    owner_team
Partitions            →    partition_count
Replication           →    replication_factor
Retention             →    retention_ms
```

4. Upload your mapped Excel file
5. Review preview
6. Click **Import**

#### Data Preparation Tips:

**For Status Field:**
- `in_progress` = Currently being worked on
- `complete` = Deployed and operational
- `historical` = Archived or deprecated

**For Retention:**
- Convert days to milliseconds:
  - 7 days = 604800000
  - 30 days = 2592000000
  - Use formula: `days * 24 * 60 * 60 * 1000`

**Example Excel Data:**
```
name                              | environment | status      | owner_team  | partition_count
prod.operations.imdas.mmd.v1      | prod        | complete    | EEB         | 12
dev.operations.ids.scan.v2        | dev         | in_progress | EEB         | 6
```

### Method 2: Kafka Sync (For Live Data)

After importing historical tracking data:
1. Run Kafka sync to update with live metadata
2. Existing topics get updated (no duplicates)
3. New topics discovered get added
4. Metadata (partitions, retention) automatically updated

## Importing Incident Data

You have comprehensive incident tracking. Here's how to bring it in:

### Using the Manual Entry Method:
For each critical incident:
1. Go to **Alerts** page
2. Click **"Add Alert"**
3. Select the related topic
4. Fill in:
   - Alert Type: `manual`
   - Severity: Based on incident severity
   - Title: Incident number and brief description
   - Description: Full incident details

### Creating a Bulk Import (Advanced):

If you want to bulk import incidents, you can:

1. Use the Excel import template approach
2. Map your incident columns:
   ```
   INC#              →    Reference in description
   Story Name        →    Title
   Status            →    Resolved = true/false
   Team Assigned     →    Resolved by field
   Severity          →    Map to: low/medium/high/critical
   ```

3. Import through database directly or contact support for bulk incident import

## Regular Sync Schedule

### Recommended Schedule:

**Daily Sync (Automated):**
- Run Kafka sync once per day per environment
- Updates partition counts, retention, etc.
- Discovers new topics

**Weekly Review:**
- Review new topics discovered
- Update descriptions and owner teams
- Mark completed topics

**Monthly Audit:**
- Check naming compliance
- Review and resolve old alerts
- Archive historical topics

## Monitoring Your Sync

### After Each Sync:

1. **Check Sync Results:**
   - Number of topics synced
   - Number updated
   - Any failures

2. **Review Alerts:**
   - Go to Alerts page
   - Check for naming violations
   - Address critical issues

3. **Verify KPIs:**
   - Dashboard shows updated metrics
   - Naming compliance percentage
   - Environment distribution

## Troubleshooting

### "Kafka API error: Unauthorized"
**Solution:**
- Verify API key and secret are correct
- Check API key hasn't expired
- Ensure key has correct permissions
- Try regenerating API key

### "Cluster ID not found"
**Solution:**
- Double-check cluster ID format (lkc-xxxxx)
- Verify you're using the correct environment
- Ensure cluster is active

### "Connection timeout"
**Solution:**
- Verify REST endpoint URL
- Check if you need VPN to access Confluent
- Ensure firewall allows outbound HTTPS
- Try from different network

### "Topics not syncing"
**Solution:**
- Verify cluster has topics
- Check API key has topic read permissions
- Review error messages in sync results
- Check Confluent Cloud status page

### "Schema Registry authentication failed"
**Solution:**
- Verify you're using Schema Registry API credentials (NOT Kafka cluster credentials)
- Schema Registry has separate API keys from Kafka clusters
- Check Schema Registry URL format: `https://psrc-xxxxx.region.provider.confluent.cloud`
- Ensure Schema Registry key has not expired
- Create new Schema Registry API key if needed

### "Schemas not syncing / Schema count = 0"
**Solution:**
- Verify Schema Registry URL is correct (should start with `psrc-`)
- Ensure Schema Registry API Key and Secret are provided
- Check that topics actually have schemas registered
- Schema subjects follow format: `{topic-name}-value` or `{topic-name}-key`
- Review Python backend logs for detailed schema sync errors
- Test Schema Registry access with curl:
  ```bash
  curl -u "KEY:SECRET" https://psrc-xxxxx.region.provider.confluent.cloud/subjects
  ```

## Environment URLs Reference

Based on your SharePoint structure, your environments likely have different clusters:

### Expected Structure:
```
DEV:  lkc-dev-xxxxx    | https://pkc-dev-xxxxx.region.cloud.confluent.cloud
SIT:  lkc-sit-xxxxx    | https://pkc-sit-xxxxx.region.cloud.confluent.cloud
CAT:  lkc-cat-xxxxx    | https://pkc-cat-xxxxx.region.cloud.confluent.cloud
PROD: lkc-prod-xxxxx   | https://pkc-prod-xxxxx.region.cloud.confluent.cloud
```

## Next Steps

### Immediate Actions:
1. ✅ Get Confluent Cloud credentials for PROD
2. ✅ Sync PROD topics first (most critical)
3. ✅ Review and clean up topic descriptions
4. ✅ Import your Excel tracking data
5. ✅ Set up daily sync schedule

### Short Term (This Week):
1. Sync remaining environments (DEV, SIT, CAT)
2. Update all topic owner teams
3. Mark completed topics
4. Review and resolve naming violations
5. Import key incidents as alerts

### Ongoing:
1. Run daily syncs
2. Weekly KPI reviews
3. Monthly compliance audits
4. Update morning standup regularly

## Security Best Practices

### API Key Management:
- ✅ Store API keys securely (never commit to git)
- ✅ Use separate keys per environment
- ✅ Rotate keys quarterly
- ✅ Use least-privilege permissions
- ✅ Audit key usage regularly

### Access Control:
- Only provide Confluent access to team members who need it
- Use read-only keys for monitoring dashboards
- Limit write access to operations team

## Support

### If You Need Help:

1. **Dashboard Issues:**
   - Check USAGE_GUIDE.md
   - Review error messages
   - Check browser console

2. **Confluent Issues:**
   - [Confluent Cloud Docs](https://docs.confluent.io/cloud/)
   - Confluent Support Portal
   - Your enterprise Confluent contact

3. **EEB Team:**
   - Contact via EEBSupport@usps.gov
   - Create incident ticket
   - Escalate critical issues

## Quick Reference

### Confluent Cloud Login:
https://confluent.cloud

### Your Dashboard:
Access your deployed EEB Dashboard

### Key Confluent Pages:
- **Clusters:** View all clusters and their IDs
- **Topics:** Browse topics per cluster
- **API Keys:** Manage API credentials
- **Monitoring:** View metrics and performance

### Dashboard Key Features:
- **Sync Kafka:** Pull live data from Confluent
- **Import Excel:** Bulk upload existing tracking
- **KPI Dashboard:** View compliance and progress
- **Alerts:** Track issues and incidents
- **Morning Standup:** Daily update workflow
