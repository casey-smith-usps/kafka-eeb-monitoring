# SOP-002: Naming Convention Validation

**Version:** 1.0
**Effective Date:** Q2 FY2026
**Owner:** EEB Data Engineering Team
**Review Cycle:** Quarterly

---

## Purpose

This SOP establishes the mandatory naming conventions for all Enterprise Event Bus (EEB) Kafka topics and provides data engineers with validation tools and processes to ensure compliance. Consistent naming enables:
- Automated discovery and classification
- Clear ownership and lineage tracking
- Self-documenting topic purpose
- Simplified access control and governance
- Reduced cognitive load for consumers

---

## Scope

This procedure covers:
- Topic naming pattern requirements (mandatory)
- Naming recommendations (best practices)
- Real-time validation during topic creation
- Remediation process for non-compliant topics
- Exception handling for legacy systems

---

## EEB Naming Standard

### Mandatory Pattern

All production topics MUST follow this pattern:

```
eeb.<domain>.<dataset>.<version>
```

**Pattern Components:**

| Component | Description | Rules | Examples |
|-----------|-------------|-------|----------|
| **eeb** | Enterprise Event Bus prefix | Always lowercase, literal "eeb" | `eeb` |
| **domain** | Business or technical domain | Lowercase letters only, hyphens allowed | `banking`, `crm`, `fraud`, `payments` |
| **dataset** | Specific data entity or event type | Lowercase, hyphens allowed, descriptive | `transactions`, `customer-events`, `alerts` |
| **version** | Schema version | Format: `v` + number (v1, v2, etc.) | `v1`, `v2`, `v10` |

**Valid Examples:**
```
✓ eeb.banking.transactions.v1
✓ eeb.crm.customer-events.v2
✓ eeb.fraud.ml-predictions.v1
✓ eeb.payments.settlement-reports.v3
✓ eeb.analytics.user-activity.v1
```

**Invalid Examples:**
```
✗ Banking.Transactions.v1               (uppercase not allowed)
✗ eeb.banking_transactions.v1           (underscores not allowed in this context)
✗ banking.transactions.v1               (missing 'eeb' prefix)
✗ eeb.banking.transactions              (missing version)
✗ eeb.banking.transactions.1            (version must be 'v1' format)
✗ eeb..transactions.v1                  (empty domain segment)
✗ eeb.banking.transactions.v1.extra     (too many segments)
```

---

## Technical Validation Rules

The dashboard implements automated validation using these rules:

### Rule 1: Character Set
**Pattern:** `^[a-z0-9._-]+$`

**Requirement:** Only lowercase letters (a-z), numbers (0-9), dots (.), underscores (_), and hyphens (-) allowed

**Common Violations:**
- Uppercase letters: `EEB.Banking.v1` → Should be `eeb.banking.v1`
- Spaces: `eeb banking transactions v1` → Should be `eeb.banking.transactions.v1`
- Special characters: `eeb.banking.transactions@v1` → Should be `eeb.banking.transactions.v1`

**Real-World Example:**

A developer attempted to create: `EEB_Banking_Transactions_V1`

Validation error:
```
✗ Contains uppercase letters (should be lowercase)
✗ Does not match required pattern: eeb.<domain>.<dataset>.<version>
```

Suggested correction: `eeb.banking.transactions.v1`

---

### Rule 2: No Consecutive Dots
**Pattern:** `^(?!.*\.\.).*$`

**Requirement:** Cannot have two or more dots in a row

**Common Violations:**
- `eeb..banking.transactions.v1` → Should be `eeb.banking.transactions.v1`
- `eeb.banking..transactions.v1` → Should be `eeb.banking.transactions.v1`

**Why This Matters:** Consecutive dots indicate empty segments, which breaks parsing logic for automated tools.

---

### Rule 3: Dots at Start/End
**Pattern:** `^(?!\.)(?!.*\.$).*$`

**Requirement:** Cannot start or end with a dot

**Common Violations:**
- `.eeb.banking.transactions.v1` → Should be `eeb.banking.transactions.v1`
- `eeb.banking.transactions.v1.` → Should be `eeb.banking.transactions.v1`

**Why This Matters:** Leading/trailing dots break delimiter-based parsing and namespace hierarchies.

---

### Rule 4: Length Constraint
**Pattern:** `^.{1,255}$`

**Requirement:** Must be between 1 and 255 characters total

**Common Violations:**
- Empty string → Must provide topic name
- `eeb.banking.very.long.topic.name.with.many.segments...` (over 255 chars) → Shorten

**Real-World Example:**

Topic name with 280 characters:
```
eeb.banking.transactions.customer.account.balance.updates.with.detailed.metadata.including.timestamps.and.correlation.identifiers.for.downstream.processing.and.audit.trail.generation.across.multiple.systems.and.platforms.requiring.comprehensive.logging.v1
```

Validation error:
```
✗ Topic name exceeds 255 characters (current: 280)
```

Suggested correction:
```
eeb.banking.customer-balance-updates.v1
```
(Store detailed description in metadata, not in topic name)

---

### Rule 5: Version Suffix
**Pattern:** `\.v\d+$`

**Requirement:** Must end with version suffix in format `.v1`, `.v2`, etc.

**Common Violations:**
- `eeb.banking.transactions` → Missing version (should be `.v1`)
- `eeb.banking.transactions.1` → Wrong format (should be `.v1`)
- `eeb.banking.transactions.version1` → Wrong format (should be `.v1`)

**Versioning Rules:**
- Start all new topics at `.v1`
- Increment version for breaking schema changes (v1 → v2 → v3)
- DO NOT use v0 (zero is not a valid starting version)
- Keep old versions running during migration period
- Document version differences in topic notes

**Real-World Example:**

Topic `eeb.crm.customer-events.v1` had schema changes:

**Version History:**
```
v1 (Oct 2025): Initial schema with 15 fields
  - customer_id (string)
  - event_type (string)
  - timestamp (datetime)
  - ... (12 more fields)

v2 (Jan 2026): Breaking change - renamed field
  - customer_id → customer_uuid (breaking change!)
  - Added new field: event_category (string)
  - Removed deprecated field: legacy_id

v3 (Mar 2026): Breaking change - event_type enum values changed
  - event_type values updated from strings to codes
  - Added event_metadata (nested object)
```

**Migration Strategy:**
1. Create `eeb.crm.customer-events.v2` (new topic)
2. Dual-write to both v1 and v2 for 60 days
3. Migrate consumers from v1 to v2
4. Deprecate v1 after all consumers migrated
5. Delete v1 after 90-day grace period

---

## Validation Workflow

### Automated Validation in Dashboard

The dashboard provides real-time validation during topic creation:

**Process:**
1. Navigate to **Topics Overview** → Click **"Add Topic"**
2. Enter topic name in modal
3. Validation runs automatically as you type
4. Red error messages appear for violations
5. Green checkmark appears when valid
6. Yellow warnings show recommendations

**Validation UI Indicators:**

```
Topic Name: [eeb.banking.Transactions.v1        ]

✗ Contains uppercase letters (should be lowercase)
✗ Does not match required pattern: eeb.<domain>.<dataset>.<version>

Suggested Correction: eeb.banking.transactions.v1

Recommendations:
⚠ Consider using more descriptive dataset name
⚠ Document schema in schema registry before production use
```

---

### Manual Validation Process

For topics created outside the dashboard (direct Confluent Cloud or CLI), validate using this checklist:

**Step 1: Basic Pattern Check**
- [ ] Starts with `eeb.`
- [ ] Has exactly 4 segments separated by dots
- [ ] Second segment is valid domain
- [ ] Third segment is descriptive dataset name
- [ ] Fourth segment is version (`.v1`, `.v2`, etc.)

**Step 2: Character Validation**
- [ ] All lowercase (no uppercase letters)
- [ ] No spaces or special characters
- [ ] Only uses: a-z, 0-9, dots, hyphens
- [ ] No consecutive dots
- [ ] No leading or trailing dots

**Step 3: Length Check**
- [ ] Total length ≤ 255 characters
- [ ] Each segment has meaningful length (not single character)

**Step 4: Semantic Review**
- [ ] Domain represents actual business/technical domain
- [ ] Dataset name is descriptive and unambiguous
- [ ] Version starts at v1 for new topics

**If Validation Fails:**
1. Document the non-compliant topic in dashboard with "Unknown" classification
2. Create remediation ticket with suggested correct name
3. Plan migration if topic is already in use
4. Add exception note if renaming not feasible (see Exception Process)

---

## Domain Standards

### Approved Domain Names

Use these standardized domain names for consistency:

| Domain | Description | Example Topics |
|--------|-------------|----------------|
| **banking** | Core banking transactions and accounts | `eeb.banking.transactions.v1` |
| **crm** | Customer relationship management | `eeb.crm.customer-events.v1` |
| **fraud** | Fraud detection and prevention | `eeb.fraud.alerts.v1` |
| **payments** | Payment processing and settlement | `eeb.payments.settlement.v1` |
| **analytics** | Analytics and reporting data | `eeb.analytics.user-activity.v1` |
| **identity** | User authentication and identity | `eeb.identity.login-events.v1` |
| **marketing** | Marketing campaigns and automation | `eeb.marketing.email-sends.v1` |
| **operations** | Operational events and monitoring | `eeb.operations.system-health.v1` |
| **compliance** | Compliance and regulatory reporting | `eeb.compliance.audit-logs.v1` |
| **platform** | EEB platform infrastructure | `eeb.platform.topic-metrics.v1` |

**Adding New Domains:**
1. Submit request to EEB Governance Committee
2. Provide justification and expected topic count
3. Ensure domain doesn't overlap with existing domains
4. Get approval before creating topics
5. Update this SOP with new domain

---

## Best Practices

### Dataset Naming Guidelines

**DO:**
- Use descriptive, business-meaningful names
- Use plural nouns for entities: `transactions`, `customers`, `events`
- Use hyphens to separate words: `customer-events`, `ml-predictions`
- Keep dataset names concise (2-3 words max)
- Use consistent terminology across related topics

**DON'T:**
- Use acronyms without expansion in notes: `cust-evts` → Use `customer-events`
- Use generic names: `data`, `events`, `stream` (be specific!)
- Mix singular/plural inconsistently
- Use technical jargon consumers won't understand
- Include environment in name (use environment tag instead)

**Examples - Good:**
```
eeb.banking.transactions.v1           (clear, plural, concise)
eeb.crm.customer-lifecycle-events.v1  (descriptive, hyphenated)
eeb.fraud.ml-predictions.v1           (indicates ML use case)
```

**Examples - Poor:**
```
eeb.banking.txn.v1                    (acronym not clear)
eeb.crm.data.v1                       (too generic)
eeb.fraud.model_output.v1             (underscore inconsistent, unclear)
```

---

### Real-World Naming Scenarios

**Scenario 1: CDC Topic from Database**

**Requirement:** Capture changes from customer database table

**Poor naming:**
```
customers_cdc            (no eeb prefix, no version, underscore)
eeb.cdc.customers.v1     (domain should be business, not technical)
```

**Good naming:**
```
eeb.crm.customer-changes.v1
```

**Rationale:**
- `crm` is business domain (not `cdc` which is technical implementation)
- `customer-changes` describes the business event
- Consumers don't need to know it's CDC under the hood

---

**Scenario 2: Multiple Event Types from Same System**

**Requirement:** Track user actions in mobile app (logins, purchases, views)

**Poor naming:**
```
eeb.mobile.events.v1                  (too generic, all events in one topic)
eeb.mobile.user_actions.v1            (underscore, still too generic)
```

**Good naming:**
```
eeb.mobile.user-logins.v1
eeb.mobile.user-purchases.v1
eeb.mobile.user-page-views.v1
```

**Rationale:**
- Separate topics by event type for better filtering
- Clear dataset names enable targeted consumption
- Easier to manage permissions per event type

---

**Scenario 3: ML Model Output**

**Requirement:** Real-time fraud scores from ML model

**Poor naming:**
```
eeb.ml.output.v1                      (too generic)
eeb.fraud.scores.v1                   (unclear what generates scores)
fraud_detection_v1                    (no eeb prefix, underscore)
```

**Good naming:**
```
eeb.fraud.ml-predictions.v1
```

**Rationale:**
- `fraud` domain shows business context
- `ml-predictions` indicates automated scoring
- Consumers know it's ML-generated, not manual review

---

**Scenario 4: Aggregated/Derived Data**

**Requirement:** Hourly rollup of transaction volumes per merchant

**Poor naming:**
```
eeb.banking.transactions-agg.v1       (suffix abbreviation unclear)
eeb.banking.hourly-merchant-tx-vol.v1 (acronyms + complex)
```

**Good naming:**
```
eeb.banking.merchant-volume-hourly.v1
```

**Rationale:**
- `merchant-volume-hourly` clearly indicates aggregation and cadence
- No abbreviations
- Follows pattern: entity-metric-frequency

---

## Validation API

For programmatic validation in CI/CD pipelines or external tools:

### TypeScript/JavaScript

```typescript
import { validateTopicName, getRecommendations, suggestCorrection }
  from './utils/namingValidator';

const result = validateTopicName('eeb.banking.Transactions.v1');

if (!result.isValid) {
  console.error('Validation failed:');
  result.issues.forEach(issue => console.error(`  - ${issue}`));

  const corrected = suggestCorrection('eeb.banking.Transactions.v1');
  console.log(`Suggested: ${corrected}`);
}

const recommendations = getRecommendations('eeb.banking.transactions.v1');
recommendations.forEach(rec => console.log(`  ⚠ ${rec}`));
```

**Output:**
```
Validation failed:
  - Contains uppercase letters (should be lowercase)
Suggested: eeb.banking.transactions.v1
```

### Validation Functions

**`validateTopicName(name: string): ValidationResult`**
- Returns: `{ isValid: boolean, issues: string[] }`
- Checks all mandatory rules
- Returns list of violations

**`getRecommendations(name: string): string[]`**
- Returns: Array of best practice suggestions
- Non-blocking, informational only
- Helps improve naming even if technically valid

**`suggestCorrection(name: string): string`**
- Returns: Auto-corrected topic name
- Applies automatic fixes:
  - Lowercases all characters
  - Converts spaces to hyphens
  - Removes invalid characters
  - Removes consecutive dots
  - Trims leading/trailing dots
  - Truncates to 255 characters

---

## Exception Process

### When Exceptions Are Allowed

Naming exceptions may be granted for:
- **Legacy topics:** Pre-existing topics with established consumers
- **Third-party integrations:** External systems with fixed naming
- **Temporary topics:** Short-lived POC or test topics
- **Internal tooling:** Non-production internal tools

### Exception Request Process

1. **Document Exception Request**
   - Topic name (current and proposed compliant name)
   - Reason for exception (technical/business justification)
   - Number of consumers/producers affected by rename
   - Migration cost estimate (engineering hours)
   - Risk assessment of keeping non-compliant name

2. **Submit for Approval**
   - Create ticket in EEB governance tracker
   - Tag EEB Platform Lead for review
   - Include migration plan (if rename is feasible)

3. **If Approved:**
   - Register topic in dashboard as "Internal" classification
   - Add note: "Naming exception approved [ticket number] - [reason]"
   - Document in exception registry
   - Set review date (typically 6 months)

4. **If Denied:**
   - Plan migration to compliant name
   - Follow rename process (see below)

### Real-World Exception Example

**Topic:** `legacy_customer_data_v1`

**Exception Request:**
```
Current Name: legacy_customer_data_v1
Compliant Name: eeb.crm.customer-legacy.v1
Reason: Topic created 3 years ago before EEB naming standards.
         Currently consumed by 47 downstream systems including
         external partner integration (cannot easily change).
Consumers: 47 systems (23 internal, 24 external partners)
Migration Cost: 320 engineering hours + 60 days testing
Risk: High - External partners have fixed configuration
Decision: Exception APPROVED for 12 months
Next Review: Jan 2027 - Re-evaluate during partner contract renewal
```

**Dashboard Entry:**
```
Topic: legacy_customer_data_v1
Classification: Internal
Notes: "Naming exception approved [TICKET-12345]
        Pre-dates EEB standards (created 2022).
        External partner dependencies prevent rename.
        Review scheduled Jan 2027 during contract renewal.
        DO NOT use as reference for new topics."
```

---

## Remediation for Non-Compliant Topics

### Discovery of Non-Compliant Topic

When Kafka sync discovers a topic that doesn't meet naming standards:

1. **Automatic Classification:**
   - Dashboard classifies as "Unknown"
   - Validation issues listed in topic detail

2. **Review Process:**
   - Data engineer reviews topic within 5 business days
   - Determine if topic is:
     - Active production topic → Request exception or plan rename
     - Test/temporary topic → Delete or rename immediately
     - Abandoned topic → Mark for deletion

3. **Remediation Options:**

**Option A: Rename (Preferred)**
- Create new topic with compliant name
- Dual-write to both topics for migration period (30-90 days)
- Migrate consumers to new topic
- Deprecate old topic
- Delete old topic after grace period

**Option B: Exception (If Rename Not Feasible)**
- Follow exception request process above
- Document permanently in dashboard

**Option C: Delete (If Abandoned)**
- Verify no active consumers (check consumer lag)
- Mark as deprecated
- Delete after 30-day grace period

---

## Monitoring & Compliance

### Compliance Metrics

Track naming compliance with these metrics:

**Metric 1: Compliance Rate**
```
Compliance Rate = (Compliant Topics / Total Topics) × 100%

Target: >90% for production topics
```

**Metric 2: Exception Rate**
```
Exception Rate = (Topics with Approved Exceptions / Total Topics) × 100%

Target: <5% of production topics
```

**Metric 3: Unknown Classification Rate**
```
Unknown Rate = (Topics Classified as Unknown / Total Topics) × 100%

Target: <3% (should be reviewed and reclassified within 5 days)
```

### Dashboard Compliance View

**Topics Overview** shows compliance indicators:

```
✓ eeb.banking.transactions.v1          [Official] [Compliant]
✓ eeb.crm.customer-events.v2           [Official] [Compliant]
⚠ legacy_customer_data_v1              [Internal] [Exception Approved]
✗ temp_test_topic                      [Unknown]  [Non-Compliant - Needs Review]
```

**Compliance Report (Monthly):**
- Total topics: 67
- Compliant: 62 (92.5%)
- Exceptions: 3 (4.5%)
- Non-compliant: 2 (3.0%) ← Action required

---

## Related SOPs

- **SOP-001:** Topic Discovery & Registration
- **SOP-003:** Schema Design & Version Control
- **SOP-004:** Cost Modeling & ROM Generation
- **SOP-005:** Environment Promotion Workflow
- **SOP-006:** Incident Management & Escalation

---

## Quick Reference Card

**Required Pattern:**
```
eeb.<domain>.<dataset>.<version>
```

**Valid Example:**
```
eeb.banking.transactions.v1
```

**Character Rules:**
- ✓ Lowercase letters (a-z)
- ✓ Numbers (0-9)
- ✓ Dots (.)
- ✓ Hyphens (-)
- ✗ Uppercase (NO)
- ✗ Spaces (NO)
- ✗ Underscores (NO - except in special cases)
- ✗ Special characters (NO)

**Length:**
- Minimum: 1 character
- Maximum: 255 characters
- Recommended: 30-50 characters

**Version:**
- Format: `.v1`, `.v2`, `.v3`, etc.
- Start at v1 (not v0)
- Increment for breaking schema changes

**Dashboard Validation:**
- Real-time validation during topic creation
- Auto-suggest corrections
- Shows recommendations

**Exception Process:**
- Document justification
- Submit for approval
- Add note to dashboard
- Review periodically

---

## Appendix A: Validation Rules Reference

### Complete Regular Expression Patterns

```javascript
// Rule 1: Valid characters only
const VALID_CHARS = /^[a-z0-9._-]+$/;

// Rule 2: No consecutive dots
const NO_CONSECUTIVE_DOTS = /^(?!.*\.\.).*$/;

// Rule 3: No leading/trailing dots
const NO_EDGE_DOTS = /^(?!\.)(?!.*\.$).*$/;

// Rule 4: Length constraint
const LENGTH = /^.{1,255}$/;

// EEB Standard: Complete pattern
const EEB_PATTERN = /^eeb\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.v\d+$/;
```

### Error Code Reference

| Code | Error Message | Resolution |
|------|---------------|------------|
| E001 | Contains uppercase letters | Convert to lowercase |
| E002 | Contains whitespace | Replace spaces with hyphens |
| E003 | Contains invalid characters | Remove or replace with hyphens |
| E004 | Missing 'eeb' prefix | Add 'eeb.' to start |
| E005 | Missing version suffix | Add '.v1' to end |
| E006 | Incorrect version format | Change to '.v1' format |
| E007 | Too many segments | Combine into 4-segment pattern |
| E008 | Too few segments | Add missing domain or dataset |
| E009 | Consecutive dots | Remove extra dots |
| E010 | Leading or trailing dots | Remove edge dots |
| E011 | Exceeds 255 characters | Shorten name |
| E012 | Empty segment | Provide meaningful segment name |

---

## Appendix B: Migration Script Template

For renaming non-compliant topics:

```bash
#!/bin/bash
# Topic Rename Migration Script

OLD_TOPIC="legacy_customer_data_v1"
NEW_TOPIC="eeb.crm.customer-legacy.v1"
CLUSTER="lkc-prod-us-east"
MIGRATION_DAYS=60

echo "Starting migration: $OLD_TOPIC → $NEW_TOPIC"

# Step 1: Create new topic with same config
echo "Creating new topic..."
confluent kafka topic create $NEW_TOPIC \
  --cluster $CLUSTER \
  --partitions 30 \
  --config retention.ms=604800000

# Step 2: Set up mirroring (requires MirrorMaker or custom app)
echo "Setting up dual-write..."
# [Your mirroring logic here]

# Step 3: Monitor consumer lag on new topic
echo "Monitoring migration progress..."
# [Your monitoring logic here]

# Step 4: After $MIGRATION_DAYS, verify no lag on old topic
echo "Verifying old topic is no longer consumed..."
# [Your verification logic here]

# Step 5: Delete old topic
echo "Deleting old topic after grace period..."
# confluent kafka topic delete $OLD_TOPIC --cluster $CLUSTER

echo "Migration complete!"
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Q2 FY2026 | Data Engineering Team | Initial release with automated validation |

---

## Approval

**Reviewed by:**
- [ ] Senior Data Engineer
- [ ] EEB Platform Lead
- [ ] Data Governance Committee

**Approved by:** _________________________  Date: __________

---

**Questions or Feedback:** Contact EEB Data Engineering Team or submit via dashboard feedback system.
