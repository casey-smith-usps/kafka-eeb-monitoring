# Kafka EEB Monitoring Dashboard - Usage Guide

## New Features Added

### 1. Environment Configuration (DEV, SIT, CAT, PROD)

Your dashboard now supports your specific environment structure:
- **DEV** - Development environment
- **SIT** - System Integration Testing
- **CAT** - Customer Acceptance Testing
- **PROD** - Production environment

**How to use:**
- When adding or editing topics, select the appropriate environment from the dropdown
- Filter topics by environment in the "All Topics" view
- View environment distribution in the KPI Dashboard

### 2. Excel Import for Bulk Topic Upload

Import your existing EEB ingestion tracking spreadsheets directly into the dashboard.

**How to use:**
1. Navigate to "All Topics" view
2. Click the "Import Excel" button
3. Download the template to see the required format
4. Fill in your topic data in the Excel template
5. Upload your completed Excel file
6. Review the preview and click "Import"

**Excel Template Columns:**
- `name` - Topic name (required)
- `description` - Topic description
- `status` - in_progress, complete, or historical
- `environment` - dev, sit, cat, or prod
- `owner_team` - Team responsible
- `partition_count` - Number of partitions
- `replication_factor` - Replication factor
- `retention_ms` - Retention in milliseconds

**Tips:**
- The importer handles common column name variations
- Invalid rows are skipped with error messages
- Existing topics are not duplicated (import will fail for duplicates)

### 3. Kafka Direct Integration

Sync topics directly from your Kafka clusters using the Admin API.

**How to use:**
1. Navigate to "All Topics" view
2. Click the "Sync Kafka" button
3. Enter your Kafka Admin API URL
4. For Confluent Cloud:
   - Enter API Key
   - Enter API Secret
5. Click "Sync Topics"

**What gets synced:**
- Topic names automatically discovered
- Partition counts updated
- Replication factors updated
- Retention policies synced
- Naming violations automatically detected

**API Endpoints:**
- **Confluent Cloud:** `https://pkc-xxxxx.region.provider.confluent.cloud:443`
- **Self-hosted:** Your Kafka REST Proxy URL

**Security Note:**
API credentials are sent securely through the Supabase Edge Function and are never stored.

### 4. Comprehensive KPI Dashboard

Track key performance indicators for your FY26 goals.

**Metrics Tracked:**
- **Completion Rate** - Percentage of completed topics (Target: 80%)
- **Naming Compliance** - Percentage following naming conventions (Target: 90%)
- **Daily Update Coverage** - In-progress topics updated today (Target: 80%)
- **Critical Alerts** - Number of critical issues (Target: 0)

**Additional Insights:**
- Topics by environment breakdown
- Topics with issues count
- Overall pipeline health score
- FY26 goal progress bars

**How to view:**
KPI Dashboard appears at the top of the "Overview" page and updates automatically.

## Updated Workflows

### Daily Morning Standup Workflow

1. Navigate to "Morning Standup"
2. Review all in-progress topics
3. Check active alerts for each topic
4. Click "Add Update" for each topic
5. Fill in:
   - Status update
   - Blockers (if any)
   - Next steps
6. Topics with updates show a green checkmark

### Excel Import Workflow

**For first-time setup:**
1. Export your current tracking spreadsheet
2. Match columns to the template format
3. Import all historical data at once
4. Review and resolve any import errors
5. Topics automatically get naming validation

**For ongoing updates:**
1. Keep your Excel file updated offline
2. Import periodically to sync changes
3. Use for bulk status updates

### Kafka Sync Workflow

**Initial setup:**
1. Get Kafka Admin API credentials from your cluster
2. For Confluent Cloud, create an API key with ListTopics permission
3. Test the sync with a few topics first

**Ongoing use:**
1. Run sync daily or weekly
2. New topics are auto-discovered
3. Check Alerts page for naming violations
4. Update descriptions and metadata manually
5. Mark topics as complete when ingestion is done

## Best Practices

### Naming Conventions
Your topics should follow these patterns:
- `{env}.{domain}.{subdomain}.{entity}.v{version}`
- Example: `prod.payments.transactions.events.v1`

**Good examples:**
- `dev.analytics.user.events.v2`
- `prod.sales.orders.completed.v1`
- `sit.inventory.stock.updates.v3`

**Bad examples:**
- `myTopic` (no environment prefix)
- `PROD.DATA` (uppercase not allowed)
- `dev..test` (consecutive dots)

### Topic Lifecycle Management

1. **In Progress** - Topic being developed/configured
2. **Complete** - Topic is live and operational
3. **Historical** - Topic archived/deprecated

Update status as topics progress through the lifecycle.

### Alert Management

**Critical Alerts** - Address immediately:
- Naming violations in PROD
- High consumer lag
- Schema breaking changes

**High/Medium Alerts** - Address this sprint:
- Naming violations in lower environments
- Performance degradation
- Missing metadata

**Low Alerts** - Track for next sprint:
- Documentation updates needed
- Optimization opportunities

## Integration with Confluent Cloud

### Prerequisites
1. Confluent Cloud cluster
2. API Key with permissions:
   - `CloudClusterAdmin` or
   - Resource-specific key with `DescribeTopics` permission

### Setup Steps

1. **Create API Key:**
   - Log into Confluent Cloud
   - Navigate to API Keys
   - Create new key with appropriate permissions
   - Save key and secret securely

2. **Get Cluster REST Endpoint:**
   - Go to Cluster Settings
   - Copy REST Endpoint URL
   - Format: `https://pkc-xxxxx.{region}.{cloud}.confluent.cloud`

3. **Configure Sync:**
   - Use REST Endpoint as Kafka Admin URL
   - Add API Key and Secret
   - Test sync

### Scheduling Automatic Syncs

To schedule automatic daily syncs, you can:

1. **Use GitHub Actions:**
```yaml
name: Daily Kafka Sync
on:
  schedule:
    - cron: '0 8 * * *'  # Daily at 8 AM
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Kafka Sync
        run: |
          curl -X POST \
            ${{ secrets.SUPABASE_URL }}/functions/v1/sync-kafka-topics \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"kafkaAdminUrl":"${{ secrets.KAFKA_URL }}","kafkaApiKey":"${{ secrets.KAFKA_KEY }}","kafkaApiSecret":"${{ secrets.KAFKA_SECRET }}"}'
```

2. **Use Supabase Cron:**
Create a scheduled database function to call the Edge Function.

3. **Use external scheduler:**
Any cron service can trigger the Edge Function endpoint.

## Reporting and Analytics

### KPI Reports for Leadership

Export key metrics monthly:
1. Overall completion rate
2. Naming compliance percentage
3. Topics by environment
4. Alert resolution time
5. Update coverage trends

### Team Metrics

Track per-team:
- Topics owned
- Completion rate
- Naming compliance
- Active alerts
- Update frequency

## Troubleshooting

### Excel Import Issues

**"Row missing topic name"**
- Ensure 'name' column exists
- Check for empty cells in name column
- Verify column headers match template

**"Duplicate topic name"**
- Topic already exists in database
- Use Kafka sync to update instead
- Or delete existing topic first

### Kafka Sync Issues

**"Kafka API error: Unauthorized"**
- Check API key and secret are correct
- Verify API key has required permissions
- Ensure credentials haven't expired

**"Connection timeout"**
- Check Kafka Admin URL is correct
- Verify firewall/network allows connection
- Try from different network if VPN required

**"Topics not appearing"**
- Check cluster ID in URL is correct
- Verify you have access to the cluster
- Look for error messages in sync results

### KPI Calculation Issues

**"Completion rate is 0%"**
- Ensure topics have status set (in_progress or complete)
- Historical topics not counted in completion rate
- Check that you have both in-progress and complete topics

**"Naming compliance is low"**
- Run naming validation on all topics
- Check Alerts page for specific violations
- Use auto-correction feature in topic editor

## API Reference

### Edge Function: sync-kafka-topics

**Endpoint:** `{SUPABASE_URL}/functions/v1/sync-kafka-topics`

**Method:** POST

**Headers:**
```json
{
  "Authorization": "Bearer {SUPABASE_ANON_KEY}",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "kafkaAdminUrl": "https://your-kafka-cluster.com",
  "kafkaApiKey": "your-api-key",
  "kafkaApiSecret": "your-api-secret"
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "synced": 10,
    "updated": 5,
    "failed": 0,
    "errors": []
  },
  "stats": {
    "totalTopics": 15,
    "averageConsumerLag": 0
  }
}
```

## Keyboard Shortcuts

Coming soon! But you can bookmark:
- `/` - Dashboard Overview
- `/topics` - All Topics
- `/standup` - Morning Standup
- `/alerts` - Alerts
- `/lineage` - Topic Lineage

## Support and Feedback

For questions or feature requests:
1. Check this guide first
2. Review the README.md for technical details
3. Contact your Data Engineering team lead

## Version History

**v2.0** (Current)
- Added DEV/SIT/CAT/PROD environments
- Excel bulk import
- Kafka direct sync
- Comprehensive KPIs
- FY26 goal tracking

**v1.0**
- Initial dashboard release
- Basic topic CRUD
- Manual data entry
- Simple alerts
