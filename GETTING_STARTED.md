# Getting Started: Importing Your EEB Data

## Overview

You have a wealth of existing data to import into your new dashboard:

1. **~100+ Kafka Topics** across DEV, SIT, CAT, PROD (from your spreadsheet)
2. **40+ Open Incidents/Defects** (from your INC tracker)
3. **20+ Non-INC Stories** (from cross-team tracker)
4. **50+ Historical Incidents** (from incident resolution tracker)
5. **Live Kafka Metadata** (from Confluent Cloud)

## Quick Start: 3 Steps to Get Running

### Step 1: Import Your Topic List (5 minutes)

**From the spreadsheet you provided:**

1. Open the dashboard and go to **"All Topics"**
2. Click **"Import Excel"**
3. Download the template
4. Copy your data from the spreadsheet (Source System, Dataset, Topic columns)
5. Map the data:
   ```
   Source System  →  owner_team
   Dataset        →  description
   Topic          →  name
   ```
6. For environment, extract from topic name:
   - If topic starts with `EEB.OPERATIONS.*` → Could be any environment
   - Check your Confluent Cloud to see which environment each topic lives in
7. Set status to `in_progress` for active topics
8. Upload and import

**Expected Result:** All 100+ topics loaded with basic info

### Step 2: Sync Confluent Cloud (10 minutes)

**To get live metadata:**

1. Follow the **CONFLUENT_SETUP_GUIDE.md** to get credentials
2. For PROD first (most important):
   - Get your Cluster ID (format: `lkc-xxxxx`)
   - Get your REST Endpoint URL
   - Create API Key and Secret
3. In dashboard, click **"Sync Kafka"**
4. Enter credentials and click sync
5. Review results

**Expected Result:** Topics automatically updated with:
- Current partition counts
- Replication factors
- Retention policies
- Naming validation

### Step 3: Add Your Open Incidents (10 minutes)

**From your INC tracker:**

1. Go to **"Alerts"** page
2. For each critical open incident:
   - Click **"Add Alert"**
   - Select the related topic
   - Set alert type: `manual` or appropriate type
   - Set severity based on impact
   - Add INC number and description
   - Leave unresolved

**Expected Result:** Key incidents tracked in dashboard

## Detailed Import Walkthrough

### A. Topics from Your Spreadsheet

You provided a comprehensive list. Here's how to prepare it:

#### Current Data Structure:
```
Source System: IMDAS
Dataset: FR1
Topic: EEB.OPERATIONS.IMDAS.FR1
```

#### Mapped to Dashboard:
```
name: EEB.OPERATIONS.IMDAS.FR1
description: IMDAS FR1 Dataset
owner_team: EEB (or specific team)
environment: [Determine from Confluent Cloud]
status: in_progress (or complete if live)
```

#### Topics to Import First (High Priority):

**IMDAS Topics:**
- EEB.OPERATIONS.IMDAS.MMD
- EEB.OPERATIONS.IMDAS.DSP
- EEB.OPERATIONS.IMDAS.CR1
- EEB.OPERATIONS.IMDAS.CLF
- EEB.OPERATIONS.IMDAS.CBT
- EEB.OPERATIONS.IMDAS.CBL
- SENSITIVE.EEB.IMDAS.HLD.V0

**IDS Topics:**
- EEB.OPERATIONS.IDS.MPE.SCAN
- EEB.OPERATIONS.ACP
- EEB.OPERATIONS.ACP.SENSITIVE

**Operations Topics:**
- EEB.OPERATIONS.OSW
- EEB.OPERATIONS.MED
- EEB.OPERATIONS.IVS.SIGNATURE
- EEB.OPERATIONS.CCC.DELIVERY
- EEB.OPERATIONS.CCC.INTERCEPT
- EEB.OPERATIONS.CCC.REDELIVERY
- EEB.OPERATIONS.CCC.PICKUP
- EEB.OPERATIONS.REFUND

(Continue with all topics from your spreadsheet)

### B. Incident Data Mapping

#### From INC Tracker (40+ open items):

**Critical Incidents to Import:**

1. **INC000009764143** - IDS Missing Labels
   - Type: `performance_degradation`
   - Severity: `high`
   - Status: In Progress with IDS
   - Related Topic: EEB.OPERATIONS.IDS.*

2. **INC000009784648** - CCC Package Intercept Missing
   - Type: `performance_degradation`
   - Severity: `high`
   - ~600 events/day missing
   - Related Topic: EEB.OPERATIONS.CCC.INTERCEPT

3. **INC000010098937** - Missing F7 IDS Messages
   - Type: `manual`
   - Severity: `high`
   - Investigation in Progress
   - Related Topic: EEB.OPERATIONS.IDS.*

4. **INC000010176347** - IMDAS_CBL Missing Events on PH Labels
   - Type: `manual`
   - Severity: `medium`
   - Related Topic: EEB.OPERATIONS.IMDAS.CBL

5. **INC000010083142** - E2EDTV Configuration Issue
   - Type: `manual`
   - Severity: `high`
   - Assigned to ECIP
   - Related Topic: EEB.OPERATIONS.E2EDTV.*

6. **INC000010261064** - Signature Encryption Issue
   - Type: `manual`
   - Severity: `critical`
   - Waiting on CISO approval
   - Related Topic: EEB.OPERATIONS.IVS.SIGNATURE

7. **INC000010235648** - ZIP11 Fields Empty String Issue
   - Type: `schema_issue`
   - Severity: `medium`
   - Waiting on CCC code change
   - Related Topic: Multiple topics affected

#### From Non-INC Stories:

Track as regular updates or todos:

1. **Force Majeure** - Possibly 2/5 release
   - Add as topic update for relevant topics
   - Track in Morning Standup

2. **API Invoicing** - Webhooks implementation
   - Create topic entries when schemas ready
   - Track modeling phase

3. **IDS Monitoring** - Volume monitoring needed
   - Add as system improvement task
   - Not an incident

### C. Historical Incident Data

From your incident resolution tracker (50+ resolved incidents):

**Recommended Approach:**
- Don't import all historical incidents immediately
- Focus on patterns and recurring issues:

**Recurring Issue Patterns to Track:**

1. **SASS Volume Anomalies** (Multiple incidents)
   - Pattern: 6-day window for holiday processing
   - Action: Document in topic notes

2. **Latency Spikes** (Common across multiple ingests)
   - Pattern: Resolved by scaling or auto-recovery
   - Action: Set monitoring thresholds

3. **Service Abnormal Requests** (service-dimension-conversion)
   - Pattern: Holiday season low volume
   - Action: Adjust alert thresholds

4. **EMAS SSF Latency** (Multiple occurrences)
   - Pattern: Batch processing causing spikes
   - Action: Document as known behavior

## Step-by-Step Import Process

### Week 1: Foundation

**Day 1: Core Topics**
- [ ] Import PROD topics via Excel
- [ ] Verify import successful
- [ ] Add owner teams to key topics

**Day 2: Confluent Sync**
- [ ] Get PROD Confluent credentials
- [ ] Run Kafka sync for PROD
- [ ] Review and fix naming violations

**Day 3: Critical Incidents**
- [ ] Import 5-10 most critical open incidents
- [ ] Verify they're linked to correct topics
- [ ] Add resolution notes to closed incidents

**Day 4: Lower Environments**
- [ ] Import SIT topics
- [ ] Import CAT topics
- [ ] Import DEV topics

**Day 5: Cleanup**
- [ ] Review all topics have descriptions
- [ ] Update owner teams
- [ ] Mark completed topics as complete
- [ ] Review KPI dashboard

### Week 2: Enhancement

**Day 1: Stories & Tasks**
- [ ] Add non-INC stories as topic updates
- [ ] Track ongoing work in Morning Standup

**Day 2: Historical Context**
- [ ] Document recurring patterns
- [ ] Update topic notes with known issues

**Day 3: Monitoring**
- [ ] Set up daily Kafka sync
- [ ] Review alert thresholds
- [ ] Test notification workflow

**Day 4: Team Onboarding**
- [ ] Share dashboard with team
- [ ] Train on Morning Standup workflow
- [ ] Establish update cadence

**Day 5: Process**
- [ ] Document team workflow
- [ ] Set up regular reviews
- [ ] Plan weekly KPI reviews

## Excel Preparation Templates

### Topic Import Template:

Create an Excel file with these columns:

```excel
| name                           | description        | environment | status      | owner_team | partition_count | replication_factor | retention_ms |
|--------------------------------|-------------------|-------------|-------------|------------|-----------------|-------------------|--------------|
| EEB.OPERATIONS.IMDAS.MMD       | IMDAS MMD Dataset | prod        | complete    | EEB        | 12              | 3                 | 604800000    |
| EEB.OPERATIONS.IDS.MPE.SCAN    | IDS MPE Scanning  | prod        | complete    | EEB        | 18              | 3                 | 259200000    |
```

### Quick Column Reference:

- **name**: Full topic name from Confluent
- **description**: What the topic contains
- **environment**: dev, sit, cat, or prod
- **status**: in_progress, complete, or historical
- **owner_team**: Team responsible (e.g., "EEB", "IDS Team", "IMDAS Team")
- **partition_count**: Number from Confluent (or leave blank to sync later)
- **replication_factor**: Usually 3 for prod, 2 for lower envs
- **retention_ms**:
  - 7 days = 604800000
  - 3 days = 259200000
  - 30 days = 2592000000

## Tips for Success

### Data Quality:

1. **Start with PROD** - Most critical, get it right first
2. **Sync often** - Run Kafka sync daily to keep metadata current
3. **Clean as you go** - Fix naming violations immediately
4. **Document owners** - Every topic should have an owner team

### Workflow:

1. **Daily**: Check new alerts, update in-progress topics
2. **Weekly**: Review KPIs, address naming violations
3. **Monthly**: Audit all topics, archive historical ones

### Common Pitfalls:

❌ **Don't** import everything at once
✅ **Do** start with PROD, then expand

❌ **Don't** manually update partition counts
✅ **Do** let Kafka sync handle technical metadata

❌ **Don't** ignore naming violations
✅ **Do** fix them immediately (or create plan to fix)

❌ **Don't** forget to mark topics as complete
✅ **Do** track status changes actively

## Support Resources

### Documentation:
- `CONFLUENT_SETUP_GUIDE.md` - Confluent Cloud integration
- `USAGE_GUIDE.md` - Dashboard features and workflows
- `README.md` - Technical setup and architecture

### Quick Links:
- Confluent Cloud: https://confluent.cloud
- Your SharePoint: [Your EEB folder link]
- Support Email: EEBSupport@usps.gov

### Troubleshooting:

**Import Failed:**
- Check column names match template exactly
- Verify no special characters in topic names
- Ensure environment values are: dev, sit, cat, or prod

**Sync Failed:**
- Verify Confluent credentials
- Check cluster ID format (lkc-xxxxx)
- Ensure API key has permissions

**Missing Topics:**
- Check correct environment synced
- Verify topic exists in Confluent
- Review sync error messages

## Next Actions

### Immediate (Today):
1. ✅ Read CONFLUENT_SETUP_GUIDE.md
2. ✅ Get Confluent Cloud PROD credentials
3. ✅ Prepare your Excel topic list
4. ✅ Run first import

### This Week:
1. Import all PROD topics
2. Sync Confluent for PROD
3. Add critical open incidents
4. Review KPI dashboard

### This Month:
1. Import remaining environments
2. Document team workflow
3. Train team on dashboard
4. Establish regular sync schedule
5. Set up monitoring thresholds

## Success Metrics

After completing initial import, you should see:

- ✅ **100+ topics** in dashboard
- ✅ **90%+ naming compliance** (or path to fix violations)
- ✅ **All critical incidents** tracked
- ✅ **Environment distribution** visible in KPIs
- ✅ **Daily updates** in Morning Standup
- ✅ **Team actively using** dashboard

## Questions?

Common questions answered:

**Q: Do I need to import every single incident?**
A: No. Focus on open incidents and recurring patterns. Historical closed incidents are for reference.

**Q: Should I manually enter partition counts?**
A: No. Let Kafka sync handle all technical metadata from Confluent.

**Q: What if topic names don't follow conventions?**
A: Import them anyway. The system will flag violations. Work with teams to fix over time.

**Q: Can I import topics that don't exist yet?**
A: Yes! Import planned topics as "in_progress" and they'll sync when deployed.

**Q: How often should I sync Confluent?**
A: Daily is recommended. Can be automated via cron or GitHub Actions.

Good luck with your import! Start small, iterate, and expand.
