# SOP-004: Cost Modeling & ROM Generation

**Version:** 1.0
**Effective Date:** Q2 FY2026
**Owner:** EEB Data Engineering Team
**Review Cycle:** Quarterly

---

## Purpose

This SOP provides standardized methods for estimating infrastructure costs and generating Rough Order of Magnitude (ROM) estimates for Enterprise Event Bus (EEB) Kafka topics. Accurate cost modeling enables:
- Informed decision-making during topic planning
- Budget forecasting and capacity planning
- Cost optimization opportunities identification
- Chargeback/showback to business units
- Resource allocation justification

---

## Scope

This procedure covers:
- Kafka infrastructure cost components
- Cost calculation methodology for EEB topics
- ROM generation for new topic proposals
- Tracking actual costs vs. estimates
- Cost optimization recommendations
- Dashboard cost modeling features

---

## Cost Components

### Confluent Cloud Pricing Model

EEB topics hosted on Confluent Cloud incur costs in these categories:

#### 1. Storage Costs

**What:** Data stored in Kafka topics

**Pricing:** Per GB per month

**Factors:**
- Data size (message size × message count)
- Retention period (longer retention = higher cost)
- Replication factor (3x replication = 3x storage cost)

**Formula:**
```
Monthly Storage Cost = (Data Volume GB) × (Retention Days / 30) × (Replication Factor) × (Price per GB/month)
```

**Example:**
```
Data: 100 GB/day incoming
Retention: 7 days
Replication: 3
Price: $0.10/GB/month

Storage = 100 GB/day × 7 days = 700 GB
With replication = 700 GB × 3 = 2,100 GB
Monthly cost = 2,100 GB × $0.10 = $210/month
```

---

#### 2. Throughput Costs

**What:** Data written to and read from Kafka

**Pricing:** Per GB transferred

**Factors:**
- Ingestion rate (producer throughput)
- Consumption rate (consumer count × throughput)
- Read/write ratio (typically consumers read more than producers write)

**Formula:**
```
Monthly Throughput Cost = (Write GB + Read GB) × (Price per GB)

Where:
Write GB = Daily Messages × Avg Message Size × 30 days / 1024³
Read GB = Write GB × Consumer Count
```

**Example:**
```
Ingestion: 10k messages/sec
Message size: 1 KB
Consumer count: 3

Write per day = 10,000 msg/sec × 1 KB × 86,400 sec/day = 864 GB/day
Write per month = 864 GB/day × 30 = 25,920 GB/month

Read per month = 25,920 GB × 3 consumers = 77,760 GB/month

Total throughput = 25,920 + 77,760 = 103,680 GB/month

Cost = 103,680 GB × $0.05/GB = $5,184/month
```

---

#### 3. Partition Costs

**What:** Kafka partition licensing

**Pricing:** Per partition per hour

**Factors:**
- Partition count (higher throughput topics need more partitions)
- Cluster type (dedicated vs. basic)

**Formula:**
```
Monthly Partition Cost = Partition Count × Price per Partition per Hour × 730 hours
```

**Example:**
```
Partitions: 50
Price: $0.05/partition/hour

Monthly cost = 50 × $0.05 × 730 = $1,825/month
```

---

#### 4. Network Transfer Costs (Optional)

**What:** Inter-region or egress traffic

**Pricing:** Per GB transferred across regions

**When Applicable:**
- Multi-region replication
- Cross-cloud data transfer
- Public internet egress

**Typical Cost:** $0.02 - $0.12 per GB depending on region

---

### Typical Cost Distribution

For a production topic, costs typically break down:

```
Storage:      15-25%
Throughput:   60-75%
Partitions:   10-20%
Network:      0-5% (if applicable)
```

**Key Insight:** Throughput (especially read operations by multiple consumers) is usually the largest cost driver.

---

## Cost Calculation Methodology

### Step 1: Gather Topic Requirements

Collect these parameters from topic planning:

| Parameter | Description | Typical Range | Source |
|-----------|-------------|---------------|--------|
| **Messages/sec** | Average ingestion rate | 10 - 100,000 | Producer capacity |
| **Message size** | Average message size in bytes | 500 B - 10 KB | Schema analysis |
| **Retention days** | How long data is kept | 1 - 90 days | Business requirements |
| **Replication factor** | Data redundancy | 2 - 3 | Environment (prod=3, non-prod=2) |
| **Partition count** | Parallelism level | 10 - 100 | Throughput ÷ (10 MB/sec per partition) |
| **Consumer count** | Number of consumer groups | 1 - 10 | Downstream systems |

---

### Step 2: Calculate Storage Cost

**Formula:**
```
Daily Data Volume (GB) = (Messages/sec × Message size bytes × 86,400 sec/day) / (1024³)
Retention Data (GB) = Daily Data Volume × Retention Days
Replicated Data (GB) = Retention Data × Replication Factor
Monthly Storage Cost = Replicated Data × Storage Price per GB
```

**Example Calculation:**

```
Topic: eeb.banking.transactions.v1

Parameters:
- Messages/sec: 5,000
- Message size: 2 KB (2,048 bytes)
- Retention: 7 days
- Replication: 3
- Storage price: $0.10/GB/month

Calculation:
Daily volume = (5,000 × 2,048 × 86,400) / 1,073,741,824 = 825.6 GB/day
Retention data = 825.6 GB × 7 days = 5,779 GB
Replicated data = 5,779 GB × 3 = 17,337 GB
Monthly storage cost = 17,337 GB × $0.10 = $1,734/month
```

---

### Step 3: Calculate Throughput Cost

**Formula:**
```
Monthly Write Volume (GB) = Daily Data Volume × 30 days
Monthly Read Volume (GB) = Monthly Write Volume × Consumer Count
Total Throughput (GB) = Write + Read
Monthly Throughput Cost = Total Throughput × Throughput Price per GB
```

**Example Calculation:**

```
Topic: eeb.banking.transactions.v1

Parameters:
- Daily volume: 825.6 GB (from Step 2)
- Consumer count: 4
- Throughput price: $0.05/GB

Calculation:
Monthly write = 825.6 GB × 30 = 24,768 GB
Monthly read = 24,768 GB × 4 consumers = 99,072 GB
Total throughput = 24,768 + 99,072 = 123,840 GB
Monthly throughput cost = 123,840 GB × $0.05 = $6,192/month
```

---

### Step 4: Calculate Partition Cost

**Formula:**
```
Partition Count = CEIL(Target Throughput MB/sec / 10 MB/sec per partition)
Monthly Partition Cost = Partition Count × Price per Partition/hour × 730 hours
```

**Example Calculation:**

```
Topic: eeb.banking.transactions.v1

Parameters:
- Messages/sec: 5,000
- Message size: 2 KB
- Price: $0.05/partition/hour

Calculation:
Target throughput = 5,000 msg/sec × 2 KB = 10,000 KB/sec = 9.77 MB/sec
Partition count = CEIL(9.77 / 10) = 1 partition (minimum 10 for production)
Use 30 partitions for growth + parallel consumption

Monthly partition cost = 30 × $0.05 × 730 = $1,095/month
```

---

### Step 5: Total Cost & ROM

**Formula:**
```
Total Monthly Cost = Storage Cost + Throughput Cost + Partition Cost + Network Cost
Annual Cost = Total Monthly Cost × 12
```

**Example Summary:**

```
Topic: eeb.banking.transactions.v1

Cost Breakdown:
Storage:       $1,734/month (19.4%)
Throughput:    $6,192/month (69.2%)
Partitions:    $1,095/month (12.3%)
Network:       $0/month (0% - same region)
─────────────────────────────────
TOTAL:         $9,021/month
Annual:        $108,252/year

ROM Categories:
Low estimate  (70% actual):  $6,315/month
Expected      (100% actual): $9,021/month
High estimate (130% actual): $11,727/month
```

---

## Dashboard Cost Calculator

### Using the Cost Modeling Feature

The EEB dashboard provides interactive cost estimation:

**Process:**

1. Navigate to **Topic Detail** modal for any topic
2. Scroll to **"Cost Modeling"** section
3. Enter or verify parameters:
   - Messages/sec
   - Average message size
   - Retention days
   - Consumer count
   - Partition count
4. Click **"Calculate ROM"**
5. Dashboard shows:
   - Cost breakdown by component
   - Monthly and annual estimates
   - Low/Expected/High ROM ranges

**Real-World Example:**

```
Topic: eeb.fraud.ml-predictions.v1
Environment: PROD

Input Parameters:
- Messages/sec: 15,000
- Message size: 500 bytes
- Retention: 3 days
- Replication: 3 (auto-set for prod)
- Partition count: 50
- Consumer count: 6

Calculated Output:
┌─────────────────────────────────────┐
│  Cost Breakdown                     │
├─────────────────────────────────────┤
│  Storage:         $892/month        │
│  Throughput:     $7,344/month       │
│  Partitions:     $1,825/month       │
│  ─────────────────────────────────  │
│  TOTAL:         $10,061/month       │
│  Annual:       $120,732/year        │
└─────────────────────────────────────┘

ROM Estimates:
  Low (70%):     $7,043/month
  Expected:     $10,061/month
  High (130%):  $13,079/month
```

---

## ROM Generation Process

### When to Generate ROM

Generate ROM estimates during these phases:

1. **Topic Planning:** Before creating topic
2. **Architecture Review:** For new system integrations
3. **Budget Planning:** Annual or quarterly forecasting
4. **Cost Optimization:** Comparing alternatives
5. **Showback/Chargeback:** Allocating costs to business units

---

### ROM Documentation Template

**Topic ROM Estimate**

```markdown
# ROM Estimate: eeb.banking.transactions.v1

**Date:** January 15, 2026
**Prepared by:** Jane Doe, Data Engineer
**Status:** Planning Phase

## Business Context
Core banking transaction events from mainframe CDC.
Supports fraud detection, analytics, and customer 360 use cases.
Expected launch: Q2 FY2026

## Technical Assumptions
- Messages/sec: 5,000 (peak: 12,000)
- Message size: 2 KB
- Retention: 7 days (compliance requirement)
- Replication: 3 (production standard)
- Partitions: 30 (allows 10x growth)
- Consumers: 4 (fraud ML, data lake, analytics, customer portal)

## Cost Estimate

| Component | Monthly Cost | Annual Cost | % of Total |
|-----------|--------------|-------------|------------|
| Storage | $1,734 | $20,808 | 19.2% |
| Throughput | $6,192 | $74,304 | 68.6% |
| Partitions | $1,095 | $13,140 | 12.1% |
| **Total** | **$9,021** | **$108,252** | **100%** |

## ROM Ranges

| Scenario | Monthly | Annual | Probability |
|----------|---------|--------|-------------|
| Low (70%) | $6,315 | $75,776 | 20% |
| Expected | $9,021 | $108,252 | 60% |
| High (130%) | $11,727 | $140,728 | 20% |

## Cost Drivers
1. **Throughput (69%):** 4 consumers reading data = 5x write volume
2. **Storage (19%):** 7-day retention with 3x replication
3. **Partitions (12%):** 30 partitions for growth headroom

## Optimization Opportunities
- Reduce retention to 3 days if compliance allows: -$742/month
- Compress messages (50% reduction): -$3,096/month
- Consolidate consumers (3 instead of 4): -$1,548/month

## Approval
- [ ] Technical Lead: _________________________
- [ ] Cost Center Owner: _________________________
- [ ] Finance: _________________________

## Next Steps
1. Validate assumptions with business stakeholders
2. Review with senior data engineer
3. Include in Q2 budget planning
4. Update after 30 days actual usage data
```

---

## Cost Tracking & Variance Analysis

### Comparing Estimated vs. Actual Costs

After topic deployment, track actual costs to refine estimates:

**Process:**

1. **Capture Initial ROM:** Save ROM estimate in topic notes
2. **Deploy Topic:** Launch in production
3. **Monitor for 30 Days:** Collect actual usage metrics
4. **Compare Actuals to ROM:**
   ```
   Variance % = ((Actual - Estimated) / Estimated) × 100%
   ```
5. **Update Topic Cost Model:** Adjust parameters based on actuals
6. **Document Lessons Learned:** Add to team knowledge base

**Example Variance Analysis:**

```
Topic: eeb.fraud.ml-predictions.v1
ROM Date: Jan 2026
Actual Date: Mar 2026 (60 days post-launch)

┌───────────────┬──────────────┬──────────────┬──────────┐
│ Component     │ Estimated    │ Actual       │ Variance │
├───────────────┼──────────────┼──────────────┼──────────┤
│ Storage       │ $892/month   │ $765/month   │ -14.2%   │
│ Throughput    │ $7,344/month │ $9,102/month │ +23.9%   │
│ Partitions    │ $1,825/month │ $1,825/month │  0%      │
├───────────────┼──────────────┼──────────────┼──────────┤
│ TOTAL         │ $10,061/mo   │ $11,692/mo   │ +16.2%   │
└───────────────┴──────────────┴──────────────┴──────────┘

Analysis:
✓ Storage lower than expected: Messages compressed by producer
✗ Throughput higher than expected: 2 additional consumers added post-launch
  (6 planned → 8 actual consumers)

Action Items:
1. Update topic record with 8 consumers
2. Re-run ROM calculation for future planning
3. Consider consumer consolidation to reduce read costs
4. Add note: "Typical consumer count higher than initial estimate"
```

---

## Cost Optimization Strategies

### Strategy 1: Reduce Retention Period

**Impact:** Lower storage costs

**Process:**
1. Review compliance and business requirements
2. Identify minimum retention needed
3. Reduce retention if possible
4. Monitor for issues

**Example:**
```
Before: 30-day retention = $5,000/month storage
After:  7-day retention  = $1,167/month storage
Savings: $3,833/month (77% reduction)
```

**Caution:** Ensure downstream systems can consume within new retention window

---

### Strategy 2: Message Compression

**Impact:** Lower throughput and storage costs

**Options:**
- Producer-side compression (gzip, snappy, lz4)
- Schema optimization (remove redundant fields)
- Compact data formats (Avro vs JSON)

**Example:**
```
Before: JSON messages, avg 5 KB
After:  Avro + snappy compression, avg 1.5 KB
Compression: 70%

Cost reduction:
- Storage: -70%
- Throughput: -70%
Total savings: ~$6,000/month for high-volume topic
```

---

### Strategy 3: Consumer Consolidation

**Impact:** Lower throughput (read) costs

**Process:**
1. Identify consumers with similar use cases
2. Consolidate into single consumer group
3. Fan out data post-consumption if needed

**Example:**
```
Before: 5 separate consumers reading independently
After:  1 consumer feeding shared data store
Read cost: 5x → 1x = 80% reduction
```

**Trade-off:** Increased coupling between consumer use cases

---

### Strategy 4: Tiered Storage

**Impact:** Lower storage costs for long retention

**Confluent Feature:** Tiered Storage (archives old data to S3)

**Example:**
```
Before: 90-day retention on Kafka = $15,000/month
After:  7-day hot + 83-day cold = $2,500/month
Savings: $12,500/month (83% reduction)
```

**Trade-off:** Higher latency accessing cold data

---

### Strategy 5: Right-Size Partitions

**Impact:** Lower partition costs without sacrificing performance

**Process:**
1. Monitor actual throughput vs. partition capacity
2. Reduce partition count if over-provisioned
3. Test with lower partition count in non-prod

**Example:**
```
Before: 100 partitions (over-provisioned) = $3,650/month
After:  30 partitions (right-sized) = $1,095/month
Savings: $2,555/month (70% reduction)
```

**Caution:** Cannot reduce partitions on existing topic; requires new topic

---

## Cost Allocation & Chargeback

### Showback Model

Provide cost visibility to business units without charging:

**Dashboard Feature:**
- Filter topics by **Owner Team**
- View total monthly cost per team
- Generate reports for transparency

**Example Report:**
```
EEB Monthly Cost by Team (March 2026)

Banking Platform:        $45,231 (35%)
  └─ 12 topics, avg $3,769/topic

Fraud Detection:         $38,102 (29%)
  └─ 8 topics, avg $4,763/topic

CRM Team:                $22,456 (17%)
  └─ 15 topics, avg $1,497/topic

Analytics:               $15,789 (12%)
  └─ 20 topics, avg $789/topic

Platform Infrastructure: $8,922 (7%)
  └─ 5 topics, avg $1,784/topic
─────────────────────────────────
Total:                  $130,500
```

---

### Chargeback Model

Allocate actual costs to business units:

**Process:**
1. Tag each topic with cost center code
2. Track actual monthly costs per topic
3. Generate chargeback invoices
4. Bill cost centers via internal accounting

**Dashboard Support:**
- Add custom field: `cost_center_code`
- Export cost report by cost center
- Schedule monthly automated reports

---

## Related SOPs

- **SOP-001:** Topic Discovery & Registration
- **SOP-002:** Naming Convention Validation
- **SOP-003:** Schema Design & Version Control
- **SOP-005:** Environment Promotion Workflow
- **SOP-006:** Incident Management & Escalation

---

## Quick Reference: Cost Estimation

**Key Formulas:**

```
Storage Cost = (Daily GB × Retention Days × Replication) × $0.10/GB

Throughput Cost = (Monthly Write GB + Read GB) × $0.05/GB

Partition Cost = Partition Count × $0.05/hour × 730 hours

Total = Storage + Throughput + Partitions
```

**Typical Ranges (Production Topic):**

| Volume | Msg/sec | Cost Range |
|--------|---------|------------|
| Low | 100 - 1,000 | $500 - $2,000/month |
| Medium | 1,000 - 10,000 | $2,000 - $15,000/month |
| High | 10,000 - 100,000 | $15,000 - $100,000/month |
| Very High | 100,000+ | $100,000+/month |

**Cost Optimization Checklist:**

- [ ] Retention minimized to business requirements
- [ ] Message compression enabled (gzip, snappy, lz4)
- [ ] Schema optimized (Avro over JSON)
- [ ] Consumers consolidated where feasible
- [ ] Partitions right-sized for actual throughput
- [ ] Tiered storage considered for long retention
- [ ] Cost tracking enabled for actual vs. estimate

---

## Appendix A: Confluent Cloud Pricing (Example)

**Note:** Prices vary by region and are subject to change. Verify current pricing with Confluent.

**Typical Pricing (US East, as of 2026):**

| Component | Price |
|-----------|-------|
| Storage | $0.10/GB/month |
| Ingress (Write) | $0.05/GB |
| Egress (Read) | $0.05/GB |
| Partition | $0.05/partition/hour |
| Network Transfer (Same Region) | $0/GB |
| Network Transfer (Cross-Region) | $0.02/GB |

**Volume Discounts:**
- 100+ TB/month: 10% discount
- 500+ TB/month: 20% discount
- Enterprise contract: Custom pricing

---

## Appendix B: Cost Calculation Spreadsheet

**Excel/Google Sheets Template:**

```
┌────────────────────────────────────────────────────────────┐
│ EEB Topic Cost Calculator                                  │
├────────────────────────────────────────────────────────────┤
│ INPUTS                                                     │
│ Messages/sec:              [    5000]                      │
│ Message size (bytes):      [    2048]                      │
│ Retention (days):          [       7]                      │
│ Replication factor:        [       3]                      │
│ Partition count:           [      30]                      │
│ Consumer count:            [       4]                      │
├────────────────────────────────────────────────────────────┤
│ PRICING (Update from Confluent)                           │
│ Storage ($/GB/month):      [    0.10]                      │
│ Throughput ($/GB):         [    0.05]                      │
│ Partition ($/hour):        [    0.05]                      │
├────────────────────────────────────────────────────────────┤
│ CALCULATED RESULTS                                         │
│ Daily volume (GB):         825.6                           │
│ Storage cost/month:        $1,734                          │
│ Throughput cost/month:     $6,192                          │
│ Partition cost/month:      $1,095                          │
│ ─────────────────────────────────────────────────────      │
│ TOTAL/month:               $9,021                          │
│ TOTAL/year:               $108,252                         │
├────────────────────────────────────────────────────────────┤
│ ROM RANGES                                                 │
│ Low (70%):                 $6,315/month                    │
│ Expected:                  $9,021/month                    │
│ High (130%):              $11,727/month                    │
└────────────────────────────────────────────────────────────┘
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Q2 FY2026 | Data Engineering Team | Initial release with dashboard calculator |

---

## Approval

**Reviewed by:**
- [ ] Senior Data Engineer
- [ ] EEB Platform Lead
- [ ] Finance Team
- [ ] Cost Center Owners

**Approved by:** _________________________  Date: __________

---

**Questions or Feedback:** Contact EEB Data Engineering Team or submit via dashboard feedback system.
