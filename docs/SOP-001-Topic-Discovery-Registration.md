# SOP-001: Topic Discovery & Registration

**Version:** 1.0
**Effective Date:** Q2 FY2026
**Owner:** EEB Data Engineering Team
**Review Cycle:** Quarterly

---

## Purpose

This SOP documents the standard process for discovering, registering, and tracking Kafka topics within the Enterprise Event Bus (EEB) ecosystem. It provides data engineers with a structured approach to topic onboarding, ensuring consistency, auditability, and proper lifecycle management.

---

## Scope

This procedure covers:
- Discovery of topics from Confluent Cloud clusters
- Manual registration of planned topics
- Validation of topic metadata completeness
- Tracking topic lifecycle across environments (Dev → SIT → CAT → Prod)
- Integration with downstream systems (schema registry, cost tracking, documentation)

---

## Prerequisites

**Required Access:**
- Confluent Cloud API credentials (scoped to appropriate clusters)
- EEB Management Dashboard access (Viewer role minimum, Editor role for registration)
- Network connectivity to Confluent Cloud APIs (corporate proxy configured if required)

**Required Knowledge:**
- Kafka topic fundamentals (partitions, retention, replication)
- EEB naming conventions (documented in SOP-002)
- Your team's domain and use case requirements

---

## Process Overview

```
┌─────────────────┐
│ Topic Discovery │
│  (Automated)    │
└────────┬────────┘
         │
         v
┌─────────────────┐     ┌──────────────────┐
│ Validate Topic  │────>│ Manual Override  │
│    Metadata     │     │  (If Needed)     │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         v                       v
┌─────────────────────────────────────────┐
│       Register in Dashboard             │
│ (Auto-classified or Manual Entry)       │
└────────┬────────────────────────────────┘
         │
         v
┌─────────────────┐
│  Track Across   │
│  Environments   │
└─────────────────┘
```

---

## Procedure

### Step 1: Automated Topic Discovery

**Method:** Kafka Sync via Edge Function

The dashboard includes automated topic discovery that polls Confluent Cloud clusters every 24 hours.

**Process:**
1. Navigate to **Data Streaming** tab in dashboard
2. Click **"Sync Kafka Topics"** button to trigger manual sync
3. Select target cluster(s) from dropdown:
   - `lkc-prod-us-east` (Production)
   - `lkc-nonprod-us-west` (Dev/SIT/CAT)
   - `lkc-azure-prod` (Azure Production)
4. Review sync results showing:
   - Topics discovered
   - Topics updated
   - Errors encountered

**Real-World Example:**

In a recent sync of `lkc-prod-us-east`, the system discovered **67 official topics** including:
```
✓ eeb.banking.transactions.v1
✓ eeb.crm.customer-events.v2
✓ eeb.fraud.alerts.v1
✓ eeb.payments.settlement.v1
```

Each topic was automatically classified as "Official" based on naming convention compliance.

**Edge Cases:**
- **Duplicate topics across clusters:** System uses `cluster_id` + `topic_name` as unique identifier
- **Topics with missing metadata:** Flagged as "Unknown" classification requiring manual review
- **API rate limiting:** Sync function implements exponential backoff; retry after 5 minutes if timeout occurs
- **Corporate proxy issues:** Verify `HTTPS_PROXY` environment variable is set correctly (see CORPORATE_PROXY_SETUP.md)

**Error Handling:**
```typescript
// Common errors and resolutions:
Error: "Failed to fetch topics from cluster"
→ Check API credentials are not expired
→ Verify network connectivity to Confluent Cloud
→ Review edge function logs for specific API error codes

Error: "Duplicate topic name in different environments"
→ This is expected; system creates separate records per cluster
→ Use environment tag to distinguish (dev/sit/cat/prod)

Error: "Topic naming validation failed"
→ Topic discovered but doesn't meet naming standards
→ Will be classified as "Internal" or "Unknown"
→ See SOP-002 for naming convention requirements
```

---

### Step 2: Manual Topic Registration

**When to Use Manual Registration:**
- Planning a new topic before cluster deployment
- Documenting legacy topics not yet in Confluent Cloud
- Creating placeholder entries for migration projects
- Backdating topics discovered outside automated sync

**Process:**
1. Navigate to **Topics Overview** tab
2. Click **"Add Topic"** button (top-right corner)
3. Fill required fields in modal:

**Required Fields:**

| Field | Description | Example | Validation Rules |
|-------|-------------|---------|------------------|
| **Topic Name** | Full Kafka topic name | `eeb.banking.transactions.v1` | Must match pattern: `eeb.<domain>.<dataset>.<version>` |
| **Environment** | Deployment stage | `prod` | Options: dev, sit, cat, prod |
| **Cloud Provider** | Hosting platform | `confluent-aws` | Options: confluent-aws, confluent-azure, confluent-gcp |
| **Cluster ID** | Confluent cluster identifier | `lkc-prod-us-east` | Must be valid cluster ID format |
| **Classification** | Topic category | `official` | Options: official, internal, experimental, unknown |
| **Owner Team** | Responsible team | `EEB Core Platform` | Free text (future: dropdown from teams table) |

**Optional but Recommended Fields:**

| Field | Description | Best Practice |
|-------|-------------|---------------|
| **Description** | Business purpose | Include source system and use case |
| **Business Domain** | Logical grouping | Use standard taxonomy (banking, crm, fraud, etc.) |
| **Technical Owner** | Primary engineer contact | Email address or LDAP username |
| **Data Sensitivity** | Classification level | public, internal, confidential, restricted |
| **Retention Period** | Data lifecycle | Align with compliance requirements |
| **Partition Count** | Kafka partitions | Match expected throughput (10-50 typical) |
| **Replication Factor** | Fault tolerance | 3 for production, 2 for non-prod |
| **Schema Registry Subject** | Avro/Protobuf schema name | `{topic-name}-value` convention |

4. Click **"Create Topic"** to save
5. Topic appears in dashboard with "Manually Registered" badge

**Real-World Example:**

A data engineer planning a new fraud detection pipeline registers:

```
Topic Name: eeb.fraud.ml-predictions.v1
Environment: dev
Cloud Provider: confluent-aws
Cluster ID: lkc-nonprod-us-west
Classification: experimental
Owner Team: Fraud Analytics
Description: Real-time ML model predictions for transaction scoring
Business Domain: fraud
Technical Owner: jane.doe@company.com
Data Sensitivity: confidential
Retention Period: 7 days
Partition Count: 20
Replication Factor: 2
Schema Registry Subject: eeb.fraud.ml-predictions.v1-value
```

This creates a tracked record in `dev` environment. As the topic progresses through environments, engineer updates the record (see Step 4).

**Edge Cases:**
- **Topic already exists in dashboard:** System prevents duplicates with error message; search existing records first
- **Legacy topic with non-standard naming:** Register as "Internal" classification and add note explaining exception
- **Multi-region topic:** Create separate records per cluster (one for US, one for EU, etc.)
- **Topic planned but not yet approved:** Use "experimental" classification until governance approval

---

### Step 3: Metadata Validation & Enrichment

After topic registration (automated or manual), validate completeness:

**Validation Checklist:**

- [ ] **Naming Convention Compliant** (see SOP-002)
  - Pattern: `eeb.<domain>.<dataset>.<version>`
  - Version starts at `v1` and increments
  - No special characters except hyphens

- [ ] **Classification Accurate**
  - Official = Production-ready, following all standards
  - Internal = Team/department use, may not meet all standards
  - Experimental = Proof-of-concept, not production
  - Unknown = Requires manual review

- [ ] **Ownership Assigned**
  - Owner Team populated
  - Technical Owner identified
  - Business sponsor documented in notes

- [ ] **Environment Tagged**
  - Correct environment selected (dev/sit/cat/prod)
  - Promotion path documented in notes

- [ ] **Cost Information Present** (if production)
  - Storage cost estimate calculated (see SOP-004)
  - Throughput cost calculated
  - Monthly ROM generated

**Enrichment Process:**

1. Click topic name in dashboard to open detail modal
2. Navigate to **"Edit Mode"** (pencil icon)
3. Add missing metadata fields
4. Add notes capturing:
   - Source system details
   - Known consumers/producers
   - Special handling requirements
   - Edge cases discovered during development
5. Attach documents:
   - Schema definitions
   - Architecture diagrams
   - Runbook links
6. Save changes

**Real-World Example:**

Topic `eeb.banking.transactions.v1` initially discovered with minimal metadata:
```
Name: eeb.banking.transactions.v1
Owner Team: (empty)
Description: (empty)
Classification: Unknown
```

After enrichment:
```
Name: eeb.banking.transactions.v1
Owner Team: Banking Platform
Technical Owner: john.smith@company.com
Description: Core banking transactions from mainframe CDC.
             Consumed by fraud detection, analytics, and customer 360.
Business Domain: banking
Classification: Official
Data Sensitivity: confidential
Retention Period: 90 days
Partition Count: 50
Replication Factor: 3
Schema Registry Subject: eeb.banking.transactions.v1-value
Notes:
  - Source: Mainframe DB2 CDC via Debezium
  - Peak throughput: 50k msgs/sec during business hours
  - Known consumers: Fraud ML pipeline, Data Lake ingestion, Customer portal
  - Schema: Complex nested structure with 47 fields
  - Special handling: PII fields encrypted at source
Documents Attached:
  - Schema Definition (Avro)
  - Architecture Diagram
  - Runbook: Transaction Processing
```

**Edge Cases:**
- **Metadata conflicts between dashboard and Confluent Cloud:** Confluent is source of truth for technical config (partitions, retention); dashboard adds business context
- **Multiple teams claiming ownership:** Escalate to EEB governance committee; document interim owner in notes
- **Sensitive data without proper classification:** Flag immediately and restrict access until classification resolved

---

### Step 4: Environment Promotion Tracking

Topics typically progress through environments:

**Standard Promotion Path:**
```
Dev → SIT (System Integration Testing) → CAT (Customer Acceptance Testing) → Prod
```

**Tracking Method:**

The dashboard tracks topics **per cluster**, so a topic in multiple environments appears as multiple records:

```
eeb.payments.settlement.v1 [lkc-nonprod-us-west] (dev)
eeb.payments.settlement.v1 [lkc-nonprod-us-west] (sit)
eeb.payments.settlement.v1 [lkc-nonprod-us-west] (cat)
eeb.payments.settlement.v1 [lkc-prod-us-east]    (prod)
```

**Process:**
1. Use environment filter in **Topics Overview** to view by stage
2. Add notes documenting promotion milestones:
   ```
   2025-10-15: Created in dev, initial testing
   2025-11-01: Promoted to SIT, passed integration tests
   2025-11-20: Promoted to CAT, user acceptance testing
   2025-12-10: Promoted to prod, full production load
   ```
3. Update classification as topic matures:
   - Dev/SIT: `experimental` or `internal`
   - CAT: `internal` (if passing tests)
   - Prod: `official` (after production validation)

**Real-World Example:**

Topic `eeb.crm.customer-events.v2` promotion log:

```
Dev (Oct 2025):
- Classification: experimental
- Partition Count: 5
- Notes: "Initial schema design, testing with sample data"

SIT (Nov 2025):
- Classification: internal
- Partition Count: 10
- Notes: "Integrated with downstream analytics pipeline,
         discovered need for additional timestamp field"

CAT (Dec 2025):
- Classification: internal
- Partition Count: 10
- Notes: "User acceptance testing complete,
         business stakeholders approved schema v2"

Prod (Jan 2026):
- Classification: official
- Partition Count: 30
- Notes: "Production deployment successful,
         processing 10k events/sec,
         monitoring for 2 weeks before full rollout"
```

**Edge Cases:**
- **Hotfix deployed directly to prod:** Document as exception in notes with justification and risk acceptance
- **Topic skips CAT:** Valid for internal tools; document approval in notes
- **Topic rolled back from prod:** Update classification back to `internal` and document rollback reason
- **Different schemas across environments:** Use version suffix (v1 in dev, v2 in prod) until cutover complete

---

### Step 5: Ongoing Maintenance

**Weekly Activities:**
- Review "Unknown" classification topics and reclassify
- Update ownership for any team changes
- Validate cost estimates against actual usage (see SOP-004)

**Monthly Activities:**
- Run Kafka sync to catch new topics
- Review topic notes for outdated information
- Archive topics no longer in use (update classification to "deprecated")

**Quarterly Activities:**
- Full metadata audit of all official topics
- Review naming convention compliance
- Update documentation links

**Deprecation Process:**
1. Coordinate with consumers to migrate off topic
2. Update classification to "deprecated"
3. Add note with deprecation date and replacement topic
4. Reduce retention period to minimum (e.g., 1 day)
5. After 90 days, delete topic from cluster
6. Archive record in dashboard (do not delete for audit trail)

---

## Key Metrics

Track these metrics to demonstrate process effectiveness:

- **Topic Coverage:** % of cluster topics tracked in dashboard (target: >95%)
- **Metadata Completeness:** % of topics with all required fields (target: >90% for official topics)
- **Classification Accuracy:** % of topics correctly classified (audit quarterly)
- **Time to Registration:** Days from topic creation to dashboard entry (target: <7 days)

---

## Related SOPs

- **SOP-002:** Naming Convention Validation
- **SOP-003:** Schema Design & Version Control
- **SOP-004:** Cost Modeling & ROM Generation
- **SOP-005:** Environment Promotion Workflow
- **SOP-006:** Incident Management & Escalation

---

## Appendix A: Common Troubleshooting

### Issue: Kafka sync fails with authentication error

**Symptoms:** Edge function returns 401 or 403 error

**Resolution:**
1. Check Confluent Cloud API credentials in Supabase secrets:
   ```bash
   # Verify secrets are set (names only, not values)
   supabase secrets list
   ```
2. Regenerate API key if expired:
   - Log into Confluent Cloud console
   - Navigate to API Keys section
   - Create new key with appropriate scope
   - Update secret in Supabase
3. Verify API key has read permissions for target cluster

### Issue: Topic appears in dashboard but not in Confluent Cloud

**Symptoms:** Dashboard shows topic but Confluent console doesn't

**Resolution:**
- Topic was manually registered (check "Source" field in detail modal)
- Topic may be planned but not yet deployed
- Check cluster_id matches the cluster you're viewing in Confluent
- Verify environment tag is correct

### Issue: Duplicate topics with different metadata

**Symptoms:** Same topic name appears multiple times with conflicting info

**Resolution:**
- Expected if topic exists in multiple clusters or environments
- Use cluster_id and environment to distinguish
- If truly duplicated in same cluster, one likely manually registered
- Keep automated sync version, delete manual entry

### Issue: Topic naming validation fails

**Symptoms:** Topic flagged as non-compliant

**Resolution:**
- Review SOP-002 for naming standards
- If legacy topic, classify as "Internal" and document exception
- If new topic, work with team to rename before production
- Add note explaining non-compliance and remediation plan

---

## Appendix B: Dashboard Quick Reference

**Topic Discovery Workflow:**
1. Data Streaming tab → Sync Kafka Topics button
2. Select cluster(s) → Run Sync
3. Review results → Check for errors

**Manual Registration Workflow:**
1. Topics Overview tab → Add Topic button
2. Fill required fields → Create Topic
3. Open detail modal → Add enrichment metadata

**Metadata Enrichment Workflow:**
1. Click topic name → Detail modal opens
2. Edit Mode (pencil icon) → Update fields
3. Add notes → Attach documents → Save

**Environment Filter:**
- Topics Overview → Environment dropdown
- Select: All, dev, sit, cat, prod
- View topics by deployment stage

**Classification Filter:**
- Topics Overview → Classification dropdown
- Select: official, internal, experimental, unknown, deprecated
- Focus on categories needing attention

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Q2 FY2026 | Data Engineering Team | Initial release based on dashboard implementation |

---

## Approval

**Reviewed by:**
- [ ] Senior Data Engineer
- [ ] EEB Platform Lead
- [ ] Data Governance Committee

**Approved by:** _________________________  Date: __________

---

**Questions or Feedback:** Contact EEB Data Engineering Team or submit via dashboard feedback system.
