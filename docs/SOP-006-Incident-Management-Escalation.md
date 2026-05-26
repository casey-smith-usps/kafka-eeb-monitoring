# SOP-006: Incident Management & Escalation

**Version:** 1.0
**Effective Date:** Q2 FY2026
**Owner:** EEB Data Engineering Team
**Review Cycle:** Quarterly

---

## Purpose

This SOP establishes standardized procedures for detecting, responding to, resolving, and escalating incidents affecting the Enterprise Event Bus (EEB) platform. Effective incident management ensures:
- Rapid detection and response to platform issues
- Minimized business impact through structured resolution
- Clear escalation paths and ownership
- Root cause analysis and prevention of recurrence
- Continuous improvement through postmortem reviews

---

## Scope

This procedure covers:
- Incident severity classification and definitions
- Alert types and detection mechanisms
- Initial response and triage procedures
- Escalation paths and on-call rotations
- Resolution workflows and tracking
- Postmortem and continuous improvement processes
- Dashboard incident management features

---

## Incident Severity Levels

### Severity Definitions

#### CRITICAL (P1)

**Definition:** Complete service outage or data loss affecting production systems

**Impact:**
- Core business operations stopped
- Revenue impact or customer-facing systems down
- Data loss or corruption of production data
- Security breach or PII exposure

**Response Time:** 15 minutes
**Resolution Target:** 4 hours
**Escalation:** Immediate to on-call lead + management

**Examples:**
- Production Kafka cluster completely unavailable
- All topics in production returning 500 errors
- Mass data corruption affecting customer transactions
- Security incident exposing sensitive data

---

#### HIGH (P2)

**Definition:** Significant degradation affecting multiple topics or consumers

**Impact:**
- Multiple production topics experiencing issues
- Performance severely degraded (>50% throughput loss)
- Multiple teams/systems affected
- Business processes delayed but not stopped

**Response Time:** 30 minutes
**Resolution Target:** 8 hours
**Escalation:** On-call engineer + team lead

**Examples:**
- 5+ production topics experiencing high consumer lag
- Schema registry unavailable (producers/consumers failing)
- Major performance degradation (latency >5x normal)
- Multiple alerts firing simultaneously

---

#### MEDIUM (P3)

**Definition:** Isolated issue affecting single topic or limited functionality

**Impact:**
- Single topic or consumer experiencing issues
- Moderate performance degradation (<50% throughput loss)
- Single team/system affected
- Business processes operating with delays

**Response Time:** 2 hours
**Resolution Target:** 24 hours
**Escalation:** On-call engineer (no immediate escalation)

**Examples:**
- Single topic experiencing moderate consumer lag
- One consumer group having processing issues
- Topic approaching storage limit
- Non-critical schema compatibility warning

---

#### LOW (P4)

**Definition:** Minor issue with minimal business impact or informational alerts

**Impact:**
- No immediate business impact
- Potential future issue if unaddressed
- Documentation or configuration improvements needed
- Best practice violations

**Response Time:** Next business day
**Resolution Target:** 1 week
**Escalation:** None (standard backlog)

**Examples:**
- Topic naming convention violation
- Missing documentation
- Cost optimization opportunity
- Deprecation notices

---

## Alert Types

### Automated Alert Categories

The EEB dashboard monitors and generates alerts in these categories:

#### 1. Naming Violations

**Trigger:** Topic discovered that doesn't meet naming standards

**Severity:** Low

**Detection:** Automated via Kafka sync

**Example:**
```
Alert: Naming Convention Violation
Topic: legacy_customer_data
Issue: Does not match pattern eeb.<domain>.<dataset>.<version>
Action Required: Review and plan migration or document exception
```

**Resolution:**
- Request naming exception (if justified)
- Plan topic rename and migration
- Document in dashboard with exception note

---

#### 2. Performance Degradation

**Trigger:** Metrics exceed thresholds (latency, throughput, consumer lag)

**Severity:** Medium to Critical (based on impact)

**Detection:** Automated monitoring via Splunk/Databricks integration

**Thresholds:**
- Consumer lag > 1 million messages: **Medium**
- Consumer lag > 10 million messages: **High**
- Producer throughput drop >50%: **High**
- End-to-end latency >10 seconds: **Medium**

**Example:**
```
Alert: High Consumer Lag Detected
Topic: eeb.banking.transactions.v1
Consumer Group: fraud-detection-service
Lag: 15.2 million messages (30 minutes behind)
Severity: HIGH

Potential Causes:
- Consumer instance failure
- Processing bottleneck in consumer logic
- Topic partition rebalancing
- Downstream service degradation
```

**Resolution Steps:**
1. Check consumer health (instances running, no errors)
2. Review consumer logs for exceptions
3. Verify downstream dependencies operational
4. Scale consumer instances if capacity issue
5. Reset offsets if necessary (with approval)

---

#### 3. Schema Issues

**Trigger:** Schema compatibility problems or registration failures

**Severity:** Medium to High

**Detection:** Schema registry validation failures

**Example:**
```
Alert: Schema Compatibility Violation
Topic: eeb.crm.customer-events.v2
Issue: New schema version not backward compatible
Details: Removed required field "customer_id" without default value
Action: Revert schema or create new topic version
```

**Resolution Steps:**
1. Review schema change details
2. Identify incompatibility cause
3. Options:
   - Revert to previous schema version
   - Fix compatibility issue and re-register
   - Create new topic (v3) for breaking change
4. Notify affected consumers
5. Update documentation

---

#### 4. Capacity Issues

**Trigger:** Storage, throughput, or partition limits approaching

**Severity:** Low to Medium

**Thresholds:**
- Storage >80% of retention limit: **Low**
- Storage >90%: **Medium**
- Partition count at cluster limit: **Medium**
- Throughput >80% of licensed capacity: **Medium**

**Example:**
```
Alert: Storage Capacity Warning
Topic: eeb.analytics.user-activity.v1
Current Storage: 4.5 TB (85% of 5.2 TB retention capacity)
Growth Rate: 200 GB/day
Estimated Full: 3 days
Action: Reduce retention or increase capacity
```

**Resolution Steps:**
1. Analyze storage growth trend
2. Options:
   - Reduce retention period (if compliant)
   - Enable compression (if not already)
   - Implement tiered storage
   - Increase cluster capacity
3. Implement chosen solution
4. Monitor for stabilization

---

#### 5. Security & Compliance

**Trigger:** Security violations, unauthorized access attempts, audit failures

**Severity:** High to Critical

**Example:**
```
Alert: Unauthorized Access Attempt
Topic: eeb.banking.transactions.v1 (PII data)
User: external-service-account
Action: READ
Result: DENIED (insufficient permissions)
Attempts: 47 in last 5 minutes
Severity: HIGH
Action: Investigate account compromise, review access logs
```

**Resolution Steps:**
1. Immediately lock affected service account
2. Review access logs for pattern
3. Determine if legitimate misconfiguration or attack
4. Notify security team if malicious
5. Remediate root cause (update ACLs, revoke keys)
6. Document in security incident tracker

---

#### 6. Cost Overruns

**Trigger:** Actual costs exceed ROM estimates by threshold

**Severity:** Low to Medium

**Thresholds:**
- Actual cost >130% of ROM: **Low**
- Actual cost >200% of ROM: **Medium**

**Example:**
```
Alert: Cost Overrun Detected
Topic: eeb.fraud.ml-predictions.v1
ROM Estimate: $10,000/month
Actual Cost: $23,500/month (235% of estimate)
Variance: +$13,500/month (+135%)
Primary Driver: Read throughput (8 consumers vs. 6 estimated)
Action: Review cost optimization opportunities
```

**Resolution Steps:**
1. Identify cost variance drivers (storage, throughput, partitions)
2. Validate actual usage metrics vs. estimates
3. Options:
   - Consolidate consumers
   - Enable compression
   - Reduce retention
   - Optimize message size
4. Update ROM estimate with actuals
5. Implement cost optimization plan

---

## Incident Response Workflow

### Step 1: Detection & Alert

**How Incidents Are Detected:**

1. **Automated Monitoring Alerts**
   - Splunk metrics alert (performance thresholds)
   - Kafka sync discovers issues (naming, config)
   - Schema registry validation failures
   - Cost tracking variance detection

2. **User-Reported Issues**
   - Dashboard feedback submission
   - Slack/Teams channel reports
   - Email to EEB support alias
   - ServiceNow ticket creation

3. **Proactive Monitoring**
   - Daily dashboard review by on-call engineer
   - Morning standup review of metrics
   - Weekly KPI reviews

**Dashboard Alert Display:**

Alerts appear in **Alerts Dashboard** with:
- Severity indicator (colored badge)
- Alert type and title
- Affected topic(s)
- Timestamp detected
- Current status (Unresolved / In Progress / Resolved)

---

### Step 2: Initial Triage (0-15 minutes)

**On-Call Engineer Actions:**

1. **Acknowledge Alert**
   - Click alert in dashboard to open detail view
   - Change status to "In Progress"
   - Assign to yourself as owner

2. **Assess Severity**
   - Validate automated severity classification
   - Upgrade severity if business impact greater than detected
   - Downgrade if false positive or minimal impact

3. **Gather Context**
   - View topic details (partitions, consumers, recent changes)
   - Check related alerts (are multiple topics affected?)
   - Review recent deployments or configuration changes
   - Check #eeb-platform Slack channel for related reports

4. **Initial Communication**
   - Post in #eeb-incidents channel:
     ```
     🚨 P2 Incident: High consumer lag on eeb.banking.transactions.v1
     Impact: Fraud detection delayed 30 minutes
     Owner: John Doe
     Status: Investigating
     ETA: Update in 15 minutes
     ```

---

### Step 3: Investigation & Diagnosis (15 min - 2 hours)

**Diagnostic Steps:**

1. **Check Monitoring Dashboards**
   - Confluent Cloud metrics (throughput, lag, errors)
   - Splunk logs (producer/consumer errors)
   - Databricks job status (if EEB ingestion job)

2. **Review Recent Changes**
   - Git commits in last 24 hours
   - Deployments to affected services
   - Configuration changes (topic config, ACLs)
   - Schema updates

3. **Test Connectivity**
   - Can producers write? (test message)
   - Can consumers read? (check consumer group status)
   - Is schema registry accessible?
   - Network issues or firewall changes?

4. **Reproduce Issue**
   - If user-reported, attempt to reproduce
   - Test in non-prod environment if possible
   - Validate error messages and logs

5. **Identify Root Cause**
   - What changed that caused this?
   - Is this a known issue (check past incidents)?
   - Is this expected behavior during maintenance?

---

### Step 4: Resolution (Immediate to 24 hours)

**Common Resolution Paths:**

**Producer Issues:**
- Restart producer service
- Rollback to previous version
- Fix configuration (API keys, cluster endpoint)
- Increase producer capacity (scale up)

**Consumer Issues:**
- Restart consumer service
- Rollback consumer code
- Scale consumer instances (add more)
- Reset consumer offsets (if corrupt state)

**Topic Configuration:**
- Increase partition count (if throughput issue)
- Adjust retention (if storage issue)
- Update ACLs (if permission issue)

**Schema Issues:**
- Revert schema to previous version
- Register corrected schema version
- Create new topic for breaking change

**Cluster Issues:**
- Contact Confluent Cloud support
- Failover to DR cluster (if applicable)
- Wait for platform maintenance completion

---

### Step 5: Validation & Monitoring (Post-Resolution)

After implementing fix:

1. **Verify Resolution**
   - Producer writing successfully? (check metrics)
   - Consumer lag decreasing? (monitor for 15-30 minutes)
   - Error rate back to normal? (check logs)
   - Downstream systems receiving data?

2. **Monitor for Regression**
   - Watch metrics for 1-2 hours
   - Set reminder to check again in 24 hours
   - Validate no new related alerts

3. **Update Incident**
   - Change status to "Resolved"
   - Add resolution notes in dashboard
   - Document root cause and fix applied
   - Link to any code changes or tickets

4. **Communicate Resolution**
   - Update #eeb-incidents channel:
     ```
     ✅ RESOLVED: P2 Incident on eeb.banking.transactions.v1
     Root Cause: Consumer instance OOM crash
     Resolution: Increased consumer memory limit, restarted
     Duration: 45 minutes
     Impact: Fraud detection delayed, no data loss
     Follow-up: Postmortem scheduled for tomorrow 10am
     ```

---

## Escalation Procedures

### Escalation Matrix

```
┌─────────────────────────────────────────────────────────┐
│ Severity   │ Initial Response │ Escalate After │ To    │
├────────────┼──────────────────┼────────────────┼───────┤
│ CRITICAL   │ On-Call Engineer │ 15 minutes     │ Lead  │
│ (P1)       │                  │ 1 hour         │ VP    │
├────────────┼──────────────────┼────────────────┼───────┤
│ HIGH       │ On-Call Engineer │ 1 hour         │ Lead  │
│ (P2)       │                  │ 4 hours        │ Mgr   │
├────────────┼──────────────────┼────────────────┼───────┤
│ MEDIUM     │ On-Call Engineer │ 4 hours        │ Lead  │
│ (P3)       │                  │ 24 hours       │ Mgr   │
├────────────┼──────────────────┼────────────────┼───────┤
│ LOW        │ Any Engineer     │ (No escalation)│ N/A   │
│ (P4)       │                  │                │       │
└─────────────────────────────────────────────────────────┘
```

### When to Escalate

**Escalate immediately if:**
- Severity is CRITICAL (P1) - always escalate to lead
- Root cause unknown after 1 hour of investigation
- Resolution requires approval (topic deletion, data loss)
- External vendor involvement needed (Confluent support)
- Business impact worsening despite actions taken
- Multiple simultaneous high-severity incidents

**Escalation Communication:**

```
Subject: [P1 ESCALATION] Production Kafka Cluster Outage

Team Lead / Manager,

I am escalating a P1 incident that has exceeded initial response window:

Incident: Production Kafka cluster lkc-prod-us-east is returning 503 errors
Start Time: 2:45 PM EST
Duration: 1 hour 15 minutes
Impact: All production topics unavailable, affecting 40+ downstream systems
Business Impact: Customer transaction processing stopped, fraud detection offline

Actions Taken:
- Verified cluster status in Confluent Cloud (shows "Degraded")
- Checked network connectivity (no issues)
- Reviewed recent changes (none in last 24 hours)
- Opened Confluent support ticket #123456

Current Status: Waiting for Confluent support response
Blocker: Cannot resolve without vendor assistance

Requesting:
- Management communication to business stakeholders
- Escalation with Confluent account team
- Approval to failover to DR cluster if not resolved in next 30 minutes

Current Owner: John Doe (On-Call Engineer)
Next Update: 4:00 PM EST
```

---

## On-Call Rotation

### On-Call Schedule

EEB Platform maintains 24/7 on-call coverage:

**Rotation:** Weekly, rotates Monday 9am EST

**On-Call Tiers:**

1. **Primary On-Call** - First responder for all alerts
2. **Secondary On-Call** - Backup if primary unavailable or needs assistance
3. **Escalation Lead** - Team lead or senior engineer for escalations

**Coverage Expectations:**
- Respond to pages within 15 minutes
- Available for Slack/call within 5 minutes for P1
- Laptop accessible at all times during on-call shift
- Sober and able to work (no alcohol during on-call)

**Dashboard Integration:**

**On-Call Escalation** tab displays:
- Current on-call schedule
- Contact information (Slack, phone, email)
- Escalation path (primary → secondary → lead)
- Rotation calendar for upcoming weeks

**Handoff Process:**

End of on-call week:
1. Review open incidents and alerts
2. Document any ongoing investigations
3. Brief incoming on-call engineer (Slack or call)
4. Update handoff notes in dashboard
5. Confirm new on-call engineer acknowledged handoff

---

## ServiceNow Integration

### Incident Ticket Workflow

For Medium+ severity incidents, create ServiceNow ticket:

**Dashboard Feature:**

In incident detail view:
- **"Create ServiceNow Incident"** button
- Auto-populates ticket with:
  - Title from EEB alert
  - Description and impact
  - Affected topic(s) and systems
  - Severity mapping (EEB → ServiceNow)

**ServiceNow Fields:**

| EEB Field | ServiceNow Field |
|-----------|------------------|
| Alert Title | Short Description |
| Alert Description | Description |
| Severity | Impact + Urgency |
| Topic Name | Configuration Item |
| Owner | Assigned To |
| Status | Incident State |

**Ticket Lifecycle:**

```
EEB Alert Created
    ↓
ServiceNow Incident Created (via API)
    ↓
Investigation & Resolution in EEB Dashboard
    ↓
EEB Incident Resolved
    ↓
ServiceNow Ticket Auto-Updated (Resolved)
    ↓
Postmortem Added to ServiceNow
```

---

## Postmortem Process

### When to Conduct Postmortem

**Required for:**
- All P1 (Critical) incidents
- P2 (High) incidents with >2 hour duration
- Incidents with data loss or security impact
- Recurring issues (3+ times in 30 days)

**Optional for:**
- P3 (Medium) incidents with learning opportunities
- Near-misses (issues caught before customer impact)

---

### Postmortem Template

**Blameless Postmortem: [Incident Title]**

```markdown
# Postmortem: eeb.banking.transactions.v1 Consumer Lag Incident

**Date:** January 20, 2026
**Authors:** John Doe (On-Call), Jane Smith (Team Lead)
**Severity:** P2 (High)
**Duration:** 2 hours 15 minutes
**Impact:** Fraud detection delayed, no data loss

---

## Executive Summary

On January 20, 2026, the fraud detection consumer for eeb.banking.transactions.v1
experienced extreme lag (30 million messages behind) due to an out-of-memory error
in the consumer application. The issue was resolved by increasing consumer memory
limits and restarting the service. No data was lost, but fraud detection was delayed
by approximately 90 minutes during peak transaction hours.

---

## Timeline (All times EST)

**2:35 PM** - Automated alert fired: Consumer lag >10M messages
**2:40 PM** - On-call engineer acknowledged, began investigation
**2:50 PM** - Identified consumer instance OOM errors in logs
**3:00 PM** - Escalated to team lead for memory limit approval
**3:15 PM** - Increased consumer memory from 4GB to 8GB
**3:20 PM** - Restarted consumer service
**3:30 PM** - Consumer lag began decreasing
**4:50 PM** - Consumer fully caught up, lag <100k messages
**5:00 PM** - Incident marked resolved, monitoring continues

---

## Root Cause

The fraud detection consumer application experienced memory exhaustion due to
increased message size (avg 3KB → 6KB) following a schema update on January 15.
The consumer was configured with 4GB heap, which was sufficient for 3KB messages
but inadequate for 6KB messages at the same throughput (5k msg/sec).

The schema update was tested in DEV and SIT environments, but those environments
process only 500 msg/sec (10% of production), so memory pressure was not observed.

---

## Impact

**Business Impact:**
- Fraud detection delayed 90 minutes (2:35 PM - 4:05 PM)
- Approximately 27 million transactions processed without real-time fraud checks
- Post-incident batch analysis identified no fraudulent transactions missed
- Customer impact: None (fraud checks applied retroactively)

**Technical Impact:**
- Consumer lag peaked at 30 million messages
- Kafka topic operated normally (no impact to producers or other consumers)
- No data loss

---

## What Went Well

✓ Automated alert detected issue within 5 minutes
✓ On-call engineer responded within 5 minutes of alert
✓ Root cause identified quickly (15 minutes)
✓ Escalation process worked smoothly (team lead approval in 15 min)
✓ Communication clear and frequent in #eeb-incidents channel
✓ No data loss, all messages eventually processed
✓ Fraud team ran retroactive batch analysis as backup

---

## What Went Wrong

✗ Schema update did not include capacity testing with production-scale throughput
✗ Consumer memory sizing not documented or validated during SIT testing
✗ Monitoring did not alert on consumer memory usage (only lag)
✗ Change control process did not flag increased message size as risk

---

## Action Items

**Prevent Recurrence:**

1. **[CRITICAL]** Add memory usage monitoring for all consumers
   - Owner: John Doe
   - Due: Jan 25, 2026
   - Create alert if memory >80% utilized

2. **[HIGH]** Update SIT environment to process production-scale throughput
   - Owner: Jane Smith
   - Due: Feb 15, 2026
   - Test with 100% production load (not just 10%)

3. **[HIGH]** Document consumer capacity planning in SOP-003
   - Owner: John Doe
   - Due: Jan 31, 2026
   - Include formula: memory = (message size × batch size × 1.5)

4. **[MEDIUM]** Add schema change checklist including message size impact review
   - Owner: Team
   - Due: Feb 1, 2026
   - CAB reviews must include message size variance

5. **[LOW]** Create runbook for OOM consumer recovery
   - Owner: Team
   - Due: Feb 15, 2026
   - Document standard memory increment approach

**Improve Detection:**

6. **[HIGH]** Add JVM memory metrics to consumer monitoring dashboard
   - Owner: Platform Team
   - Due: Feb 1, 2026
   - Alert on heap >80% for 5 minutes

**Improve Response:**

7. **[MEDIUM]** Pre-approve standard memory increases up to 2x current limit
   - Owner: Team Lead
   - Due: Jan 25, 2026
   - Eliminates delay waiting for approval during incidents

---

## Lessons Learned

1. **Non-prod must mirror prod scale for capacity testing**
   Testing at 10% production load missed memory exhaustion issue.

2. **Monitor resource utilization, not just outcomes**
   We monitored lag but not memory, so didn't detect issue until too late.

3. **Schema changes have infrastructure implications**
   Increasing message size 2x requires infrastructure review (memory, storage, cost).

4. **Batch processing as backup is valuable**
   Fraud team's retroactive batch analysis minimized business risk.

---

## Follow-Up

Postmortem reviewed in team meeting: January 21, 2026
Action items tracked in Jira: EEB-234 through EEB-240
Follow-up review scheduled: February 15, 2026 (validate actions completed)

---

## Approval

**Reviewed by:**
- [x] On-Call Engineer (John Doe)
- [x] Team Lead (Jane Smith)
- [x] Business Owner (Fraud Detection Team)

**Date:** January 21, 2026
```

---

### Postmortem Storage

**Dashboard Integration:**

1. Complete postmortem in markdown format
2. Attach to incident in **Incident Detail** modal
3. Store in **Documents** library with tag "Postmortem"
4. Link to related alert and ServiceNow ticket

**Postmortem Review:**

- Monthly review of all postmortems in team meeting
- Identify patterns and systemic issues
- Track action item completion
- Share key learnings in broader engineering org

---

## Related SOPs

- **SOP-001:** Topic Discovery & Registration
- **SOP-002:** Naming Convention Validation
- **SOP-003:** Schema Design & Version Control
- **SOP-004:** Cost Modeling & ROM Generation
- **SOP-005:** Environment Promotion Workflow

---

## Quick Reference

**Severity Response Times:**

| Severity | Response | Resolution |
|----------|----------|------------|
| P1 Critical | 15 min | 4 hours |
| P2 High | 30 min | 8 hours |
| P3 Medium | 2 hours | 24 hours |
| P4 Low | Next day | 1 week |

**On-Call Contact:**

Check **On-Call Escalation** tab in dashboard for current on-call engineer.

**Escalation Path:**

Primary On-Call → Secondary On-Call → Team Lead → Manager → VP

**Postmortem Required:**

- All P1 incidents
- P2 >2 hours duration
- Any data loss
- Recurring issues (3+ times/30 days)

---

## Appendix A: Common Incident Scenarios

### Scenario 1: Consumer Lag Spike

**Symptoms:** Consumer lag increasing rapidly

**Common Causes:**
- Consumer instance failure (check health)
- Processing bottleneck (slow downstream call)
- Partition rebalancing (temporary, resolves automatically)
- Increased producer throughput (consumer can't keep up)

**Quick Actions:**
1. Check consumer health and logs
2. Scale consumer instances if CPU/memory high
3. Identify slow operations (database queries, API calls)
4. If permanent throughput increase, plan capacity upgrade

---

### Scenario 2: Producer Unable to Write

**Symptoms:** Producer errors, messages not reaching topic

**Common Causes:**
- Network connectivity issues
- Authentication failure (expired API key)
- Authorization failure (missing ACL permissions)
- Topic doesn't exist
- Schema validation failure

**Quick Actions:**
1. Test network connectivity (ping cluster endpoint)
2. Verify API credentials not expired
3. Check ACLs (producer has WRITE permission)
4. Verify topic exists
5. Test schema validation manually

---

### Scenario 3: Schema Compatibility Error

**Symptoms:** Producer/consumer failing with schema errors

**Common Causes:**
- Non-backward-compatible schema change
- Schema registry unavailable
- Wrong schema ID referenced
- Deserialization type mismatch

**Quick Actions:**
1. Identify which schema version failing
2. Review recent schema changes
3. Test compatibility via schema registry API
4. Revert to previous schema if needed
5. Notify consumers if schema rolled back

---

### Scenario 4: Cluster Degradation

**Symptoms:** High latency, errors across multiple topics

**Common Causes:**
- Confluent Cloud platform issue
- Network degradation
- Cluster at capacity (storage, throughput)
- Zookeeper issues (if self-hosted)

**Quick Actions:**
1. Check Confluent Cloud status page
2. Verify not hitting cluster limits
3. Open Confluent support ticket
4. Consider failover to DR cluster if critical

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Q2 FY2026 | Data Engineering Team | Initial release |

---

## Approval

**Reviewed by:**
- [ ] Senior Data Engineer
- [ ] EEB Platform Lead
- [ ] On-Call Team
- [ ] Operations Manager

**Approved by:** _________________________  Date: __________

---

**Questions or Feedback:** Contact EEB Data Engineering Team or submit via dashboard feedback system.
