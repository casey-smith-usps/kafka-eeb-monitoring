# SOP-005: Environment Promotion Workflow

**Version:** 1.0
**Effective Date:** Q2 FY2026
**Owner:** EEB Data Engineering Team
**Review Cycle:** Quarterly

---

## Purpose

This SOP defines the standard workflow for promoting Kafka topics and EEB integrations through development environments to production. A structured promotion process ensures:
- Quality gates at each stage prevent defects from reaching production
- Consistent testing and validation across environments
- Clear approval and signoff requirements
- Audit trail for compliance and troubleshooting
- Reduced production incidents through progressive rollout

---

## Scope

This procedure covers:
- Environment definitions and purposes (Dev, SIT, CAT, Prod)
- Promotion criteria and gates for each environment
- Testing requirements per stage
- Approval workflows and stakeholder signoff
- Rollback procedures for failed promotions
- Dashboard tracking of promotion status

---

## Environment Overview

### Standard EEB Environment Path

```
┌──────┐    ┌──────┐    ┌──────┐    ┌──────────┐
│ DEV  │ -> │ SIT  │ -> │ CAT  │ -> │   PROD   │
└──────┘    └──────┘    └──────┘    └──────────┘
 Local      System      Customer      Production
 Dev        Integration Acceptance
```

---

### Environment Characteristics

#### DEV (Development)

**Purpose:** Individual developer experimentation and initial development

**Characteristics:**
- Lowest stability requirements
- Frequent schema changes allowed
- Minimal data quality validation
- Fast iteration cycles
- Single-developer ownership

**Infrastructure:**
- Cluster: `lkc-nonprod-us-west`
- Replication factor: 2
- Retention: 1-3 days (short)
- Partitions: Minimal (3-10)

**Who Uses:**
- Individual data engineers
- Development teams testing new features
- POC and prototyping activities

**Data Quality:**
- Synthetic or scrambled test data
- No PII or sensitive data
- Data can be deleted/recreated freely

---

#### SIT (System Integration Testing)

**Purpose:** Integration testing with other systems and services

**Characteristics:**
- Stable schema (changes require approval)
- Integration with downstream systems
- Automated testing required
- Multi-team coordination
- Shared environment

**Infrastructure:**
- Cluster: `lkc-nonprod-us-west`
- Replication factor: 2
- Retention: 7 days
- Partitions: Production-like (30-50% of prod)

**Who Uses:**
- Multiple engineering teams
- Downstream system integrators
- QA automation
- Data platform teams

**Data Quality:**
- Realistic test data (anonymized)
- Volume testing (10-20% of prod volume)
- Schema validation enforced
- Data lineage tracked

**Testing Requirements:**
- Unit tests passing (100%)
- Integration tests passing
- Schema compatibility validated
- Performance benchmarking initiated

---

#### CAT (Customer Acceptance Testing)

**Purpose:** Business stakeholder validation and user acceptance testing

**Characteristics:**
- Production-like configuration
- Business user validation
- Limited access (approved users only)
- Change freeze periods
- Pre-production staging

**Infrastructure:**
- Cluster: `lkc-nonprod-us-west` (isolated namespace)
- Replication factor: 3 (prod-like)
- Retention: Same as prod
- Partitions: Same as prod

**Who Uses:**
- Business stakeholders
- Product owners
- UAT testers
- Customer pilot users (external, sometimes)

**Data Quality:**
- Production-like data (fully anonymized)
- Volume testing (50-80% of prod volume)
- Real-world scenarios
- Compliance-approved datasets

**Testing Requirements:**
- All SIT tests passing
- Business acceptance test scripts executed
- Performance tests under load
- Security scanning complete
- Documentation reviewed

---

#### PROD (Production)

**Purpose:** Live production serving real business workloads

**Characteristics:**
- Highest stability and availability (99.9% SLA)
- Change control board approval required
- Comprehensive monitoring and alerting
- Incident response procedures
- Full audit logging

**Infrastructure:**
- Cluster: `lkc-prod-us-east` (primary), `lkc-prod-eu-west` (DR)
- Replication factor: 3
- Retention: Per compliance requirements (7-90 days)
- Partitions: Right-sized for peak load

**Who Uses:**
- Production applications
- Real end-users
- Business-critical systems
- External partners (B2B integrations)

**Data Quality:**
- Real production data
- PII and sensitive data (encrypted)
- Full data lineage and audit
- Regulatory compliance enforced

**Monitoring:**
- 24/7 on-call coverage
- Real-time alerting
- Performance dashboards
- Cost tracking
- SLA monitoring

---

## Promotion Process

### Phase 1: DEV → SIT Promotion

**Prerequisites:**

- [ ] Topic created in DEV environment
- [ ] Schema registered in schema registry (if applicable)
- [ ] Producer code tested locally
- [ ] Consumer code tested locally
- [ ] Basic functional testing complete
- [ ] Code committed to version control
- [ ] Unit tests passing

**Promotion Steps:**

1. **Create Topic in SIT Cluster**
   - Use same naming convention: `eeb.<domain>.<dataset>.v1`
   - Match partition count to expected load
   - Set retention appropriate for testing (7 days typical)
   - Apply replication factor 2

2. **Register Schema in SIT Schema Registry**
   - Upload schema to SIT schema registry
   - Verify subject name matches: `{topic-name}-value`
   - Test backward compatibility

3. **Deploy Producer to SIT**
   - Deploy producer application to SIT environment
   - Configure connection to SIT cluster
   - Enable debug logging for initial deployment

4. **Deploy Consumer to SIT**
   - Deploy consumer application(s) to SIT
   - Configure consumer groups correctly
   - Monitor consumer lag

5. **Execute Integration Tests**
   - Run automated integration test suite
   - Validate message format and content
   - Verify end-to-end data flow
   - Check error handling scenarios

6. **Update Dashboard**
   - Register topic in EEB dashboard (SIT environment)
   - Add notes documenting SIT deployment date
   - Link to test results
   - Update status to "In Progress - SIT"

**Approval Required:**
- **Technical Lead** sign-off on test results
- **Peer Review** of code changes

**Exit Criteria:**
- ✓ All integration tests passing
- ✓ No critical or high-severity bugs
- ✓ Schema compatibility validated
- ✓ Performance acceptable (no obvious bottlenecks)
- ✓ Documentation updated

**Timeline:** 1-2 weeks in SIT

---

### Phase 2: SIT → CAT Promotion

**Prerequisites:**

- [ ] All SIT exit criteria met
- [ ] No open critical or high bugs
- [ ] Performance testing complete
- [ ] Security scan passing (no high/critical vulnerabilities)
- [ ] Schema finalized (no further breaking changes expected)
- [ ] CAT test plan created and approved
- [ ] Business stakeholders identified and notified

**Promotion Steps:**

1. **Freeze Schema**
   - Lock schema in schema registry (no further changes without approval)
   - Document schema version in release notes
   - Communicate schema freeze to all teams

2. **Create Topic in CAT Cluster**
   - Mirror production configuration:
     - Same partition count as planned for prod
     - Same retention policy as prod
     - Replication factor 3 (prod-like)
   - Apply production-grade monitoring

3. **Deploy Producer/Consumer to CAT**
   - Use production deployment process (CI/CD)
   - Apply production configuration (except endpoints)
   - Enable production-level logging

4. **Load Production-Like Data**
   - Seed CAT with anonymized production data
   - Or replay production traffic (sanitized)
   - Verify data volumes are realistic (50-80% of prod)

5. **Execute UAT**
   - Business stakeholders run acceptance tests
   - Validate against business requirements
   - Test edge cases and error scenarios
   - Verify reporting and analytics outputs

6. **Performance & Load Testing**
   - Simulate production load (peak + 20% buffer)
   - Monitor latency, throughput, consumer lag
   - Validate auto-scaling (if applicable)
   - Test failure scenarios (kafka broker down, network partition)

7. **Security & Compliance Review**
   - Verify data encryption (in-transit and at-rest)
   - Validate access controls (RBAC)
   - Check audit logging enabled
   - Confirm PII handling compliant with policy

8. **Update Dashboard**
   - Register topic in EEB dashboard (CAT environment)
   - Document CAT deployment date and version
   - Link to UAT test results
   - Update status to "In Progress - CAT"

**Approval Required:**
- **Product Owner** sign-off on UAT results
- **Security Team** approval on scan results
- **Technical Lead** approval on performance tests
- **Compliance** approval for sensitive data topics

**Exit Criteria:**
- ✓ UAT test scripts executed successfully (100% pass rate)
- ✓ Business stakeholders approve functionality
- ✓ Performance meets SLA targets
- ✓ Security scan clean (no high/critical issues)
- ✓ Compliance review complete (if required)
- ✓ Production runbook created
- ✓ Incident response plan documented

**Timeline:** 2-4 weeks in CAT

---

### Phase 3: CAT → PROD Promotion

**Prerequisites:**

- [ ] All CAT exit criteria met
- [ ] Change advisory board (CAB) approval obtained
- [ ] Production deployment plan documented
- [ ] Rollback plan documented and tested
- [ ] On-call team notified and available
- [ ] Monitoring dashboards configured
- [ ] Runbook published and reviewed
- [ ] Incident escalation contacts confirmed

**Promotion Steps:**

**Week 1: Pre-Production Preparation**

1. **CAB Approval**
   - Submit change request to Change Advisory Board
   - Include: deployment plan, rollback plan, risk assessment
   - Present to CAB for approval (typically weekly meeting)
   - Obtain approval signature

2. **Production Readiness Review**
   - Review architecture diagram (current state)
   - Validate capacity planning (partitions, throughput, storage)
   - Confirm monitoring and alerting configured
   - Verify disaster recovery plan

3. **Final Schema Registration**
   - Register schema in **production** schema registry
   - Subject: `eeb.<domain>.<dataset>.v1-value`
   - Verify schema ID returned and documented

4. **Create Production Topic**
   - Cluster: `lkc-prod-us-east` (or appropriate prod cluster)
   - Partitions: Based on capacity planning
   - Retention: Per compliance requirements
   - Replication factor: 3
   - Configs: compression, min.insync.replicas, etc.

**Week 2: Production Deployment**

5. **Deploy Producer (Canary)**
   - Deploy producer to **single instance** (canary)
   - Monitor for errors/issues for 24 hours
   - Validate message format and throughput
   - If successful, proceed to full rollout

6. **Deploy Producer (Full Rollout)**
   - Deploy to all producer instances
   - Monitor consumer lag, error rates
   - Validate data quality in real-time

7. **Deploy Consumer (Canary)**
   - Deploy consumer to **single instance** (canary)
   - Monitor processing accuracy for 24-48 hours
   - Validate downstream impacts

8. **Deploy Consumer (Full Rollout)**
   - Deploy to all consumer instances
   - Monitor end-to-end data flow
   - Verify SLA metrics met

9. **Soak Period (1-2 Weeks)**
   - Monitor production closely for 1-2 weeks
   - Daily check-ins with on-call team
   - Review error logs and metrics
   - Validate cost estimates vs. actuals

10. **Update Dashboard**
    - Register topic in EEB dashboard (PROD environment)
    - Document production deployment date
    - Update classification to "Official"
    - Add production metrics (actual throughput, cost)
    - Update status to "Complete"

**Approval Required:**
- **Change Advisory Board** (CAB) approval
- **EEB Platform Lead** sign-off
- **Business Owner** acceptance
- **Operations Team** readiness confirmation

**Exit Criteria:**
- ✓ Topic operating in production successfully
- ✓ SLA targets met (latency, throughput, availability)
- ✓ No critical incidents in first 2 weeks
- ✓ Cost tracking enabled and within budget
- ✓ Monitoring and alerting validated
- ✓ Documentation complete and published
- ✓ Team trained on production operations

**Timeline:** 2-4 weeks (includes CAB approval and soak period)

---

## Promotion Tracking in Dashboard

### Dashboard Features

**Topics Overview** displays environment progression:

```
Topic: eeb.banking.transactions.v1

┌─────────────────────────────────────────────┐
│ Environment Status                          │
├─────────────────────────────────────────────┤
│ ✓ DEV    Deployed Oct 15, 2025              │
│ ✓ SIT    Deployed Nov 1, 2025               │
│ ✓ CAT    Deployed Nov 20, 2025              │
│ ✓ PROD   Deployed Dec 10, 2025              │
└─────────────────────────────────────────────┘
```

**Topic Notes** capture promotion milestones:

```
Notes:
- Oct 15, 2025: Initial deployment to DEV
- Nov 1, 2025: Promoted to SIT, integration tests passing
- Nov 20, 2025: Promoted to CAT, UAT complete
- Dec 10, 2025: Promoted to PROD, full rollout successful
- Dec 24, 2025: Monitoring stable, cost tracking enabled
```

**Classification Updates:**

```
DEV/SIT: Classification = "Experimental"
CAT:     Classification = "Internal"
PROD:    Classification = "Official"
```

---

## Rollback Procedures

### When to Rollback

Trigger rollback if:
- Critical bug discovered in production
- SLA targets not met (high latency, low throughput)
- Data quality issues (schema errors, data corruption)
- Security vulnerability identified
- Excessive cost overrun (>2x estimated)
- Business stakeholder requests revert

---

### Rollback Process

**Immediate Actions (0-30 minutes):**

1. **Stop Producer**
   - Disable producer application immediately
   - Prevent further bad data from being written

2. **Assess Impact**
   - Check how many bad messages were produced
   - Identify affected consumers
   - Estimate data corruption scope

3. **Notify Stakeholders**
   - Alert on-call team
   - Notify business owners
   - Post incident in Slack/Teams channel

**Short-Term Actions (1-4 hours):**

4. **Rollback Application Code**
   - Revert producer/consumer to previous stable version
   - Redeploy via CI/CD pipeline
   - Verify previous version working

5. **Data Remediation (If Needed)**
   - Identify bad messages (by timestamp range)
   - Consumers may need to replay from earlier offset
   - Or consumers skip bad messages (if non-critical)

6. **Verify System Stable**
   - Monitor metrics return to normal
   - Validate consumers processing correctly
   - Check no cascading failures

**Post-Rollback (1-7 days):**

7. **Root Cause Analysis**
   - Conduct blameless postmortem
   - Document what went wrong
   - Identify prevention measures

8. **Fix and Re-Test**
   - Fix bug in DEV environment
   - Re-test through SIT and CAT
   - Schedule new production deployment

9. **Update Dashboard**
   - Document rollback in topic notes
   - Update status (back to CAT or SIT)
   - Link to incident report

**Rollback Example:**

```
Incident: eeb.fraud.ml-predictions.v1 rollback

Date: Jan 15, 2026
Deployed to PROD: Jan 10, 2026
Rolled Back: Jan 15, 2026 14:30 UTC

Issue:
Producer writing invalid JSON due to schema serialization bug.
Downstream consumers failing to parse messages, causing 50% error rate.

Actions Taken:
1. Producer disabled at 14:35 UTC (5 min response time)
2. Rolled back to v1.2.3 (previous stable) at 14:50 UTC
3. Consumers replayed from 14:00 UTC offset (before bad messages)
4. System stabilized by 15:30 UTC

Impact:
- Duration: 1 hour production impact
- Messages affected: ~10,000 (deleted)
- Consumers affected: 3 (all recovered)
- Business impact: Minor - fraud detection delayed 1 hour

Root Cause:
Schema serialization library updated in v1.3.0 had breaking change.
Unit tests didn't catch edge case with nested optional fields.

Prevention:
- Enhanced test coverage for optional nested fields
- Added integration test with production-like schema
- Require schema validation in CI/CD pipeline

Status:
Fixed in v1.3.1, re-tested in SIT (passed), scheduled for CAT Jan 22.
```

---

## Special Cases

### Hotfix to Production

**When:** Critical production bug requires immediate fix bypassing normal promotion

**Requirements:**
- Bug is **critical** (data loss, security, major business impact)
- Fix is **low-risk** (small, isolated change)
- Approval from **EEB Platform Lead** + **Business Owner**

**Process:**

1. **Emergency CAB Approval**
   - Emergency CAB call (or async approval via email)
   - Document justification and risk
   - Get explicit approval to skip environments

2. **Develop Fix in DEV**
   - Create fix in DEV environment
   - Test as thoroughly as possible in short time

3. **Deploy to PROD**
   - Deploy fix to production with manual monitoring
   - Have on-call team watch closely for 1-2 hours

4. **Backfill to SIT/CAT**
   - After prod is stable, backfill fix to SIT/CAT
   - Update those environments to stay in sync

5. **Document Exception**
   - Log hotfix in topic notes
   - Link to incident report
   - Note that promotion process was bypassed

**Dashboard Tracking:**
```
Notes:
- Jan 20, 2026: HOTFIX deployed directly to PROD (bypassed SIT/CAT)
  - Justification: Critical data corruption bug causing customer impact
  - Approval: Platform Lead (John Doe), Business Owner (Jane Smith)
  - Incident: INC-2026-0042
  - Fix: Schema validation added to prevent null values in required field
- Jan 21, 2026: Backfilled hotfix to SIT and CAT for consistency
```

---

### Multi-Region Deployment

**Scenario:** Topic needs to be deployed to multiple regions (US, EU, APAC)

**Process:**

1. **Deploy to Primary Region First**
   - Follow standard DEV → SIT → CAT → PROD process
   - Primary region: US East

2. **Soak Period in Primary**
   - Run for 2-4 weeks in primary region
   - Validate stability and performance

3. **Deploy to Secondary Regions**
   - Follow abbreviated process (skip DEV/SIT if primary stable)
   - Deploy to CAT in secondary region → PROD in secondary region
   - Monitor closely for regional differences

**Dashboard Tracking:**
```
Topic: eeb.banking.transactions.v1

Regions:
✓ US East (Primary):     Deployed Dec 10, 2025 (Stable)
✓ EU West (Secondary):   Deployed Jan 15, 2026 (Stable)
○ APAC (Planned):        Scheduled Feb 10, 2026
```

---

## Related SOPs

- **SOP-001:** Topic Discovery & Registration
- **SOP-002:** Naming Convention Validation
- **SOP-003:** Schema Design & Version Control
- **SOP-004:** Cost Modeling & ROM Generation
- **SOP-006:** Incident Management & Escalation

---

## Quick Reference

**Standard Promotion Path:**
```
DEV (1-2 weeks) → SIT (1-2 weeks) → CAT (2-4 weeks) → PROD (2-4 weeks soak)
```

**Key Approvals:**

| Stage | Approver |
|-------|----------|
| DEV → SIT | Technical Lead |
| SIT → CAT | Product Owner + Security |
| CAT → PROD | CAB + Platform Lead + Business Owner |

**Rollback Triggers:**
- Critical bug
- SLA miss
- Data quality issue
- Security vulnerability
- Cost overrun (>2x)

**Dashboard Status:**
- Experimental (DEV/SIT)
- Internal (CAT)
- Official (PROD)

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
- [ ] Change Advisory Board
- [ ] Operations Team

**Approved by:** _________________________  Date: __________

---

**Questions or Feedback:** Contact EEB Data Engineering Team or submit via dashboard feedback system.
