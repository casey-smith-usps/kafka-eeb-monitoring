# Databricks Serverless Setup Guide

## Why Serverless Matters for Cost Savings

### Current State (Provisioned Endpoint)
- **Cost**: $144/day = $4,320/month (24/7 running)
- **Idle Time**: You pay even when dashboard is not in use
- **Problem**: 90%+ of your DBUs are wasted on idle time

### With Serverless
- **Cost**: Pay only for query execution seconds
- **Idle Time**: $0 when not in use
- **Savings**: 90-95% reduction for typical usage patterns

**Example Cost Comparison:**
- 100 AI queries/day × 3 seconds each = 300 seconds
- Serverless: ~$0.50/day vs Provisioned: $144/day
- **Savings: $143.50/day = $4,305/month**

---

## Setup Steps

### Step 1: Create a Serverless SQL Warehouse (Recommended Path)

This is the easiest and most cost-effective option for AI/SQL queries:

1. **Go to Databricks Workspace**
   - Navigate to: SQL → SQL Warehouses
   - Click "Create SQL Warehouse"

2. **Configure Serverless Settings**
   ```
   Name: eeb-ai-assistant-serverless
   Cluster size: Small (2X-Small is fine for AI queries)
   Auto-stop: 10 minutes
   Type: Serverless ✓ (CRITICAL - check this box!)
   ```

3. **Enable AI Functions**
   - In Advanced Options → SQL Configuration Parameters, add:
   ```
   spark.databricks.sql.functions.ai.enabled true
   ```

4. **Get SQL Warehouse ID**
   - After creation, click on the warehouse
   - Copy the HTTP Path (looks like: `/sql/1.0/warehouses/abc123xyz`)
   - The ID is the last part: `abc123xyz`

### Step 2: Update Edge Function to Use SQL Warehouse

Your current edge function uses Model Serving endpoints. For serverless, you have two options:

**Option A: SQL AI Functions (Recommended - True Serverless)**
- Uses `ai_query()` function in SQL
- Truly serverless - only runs when queries execute
- Cheapest option

**Option B: Serverless Model Serving**
- Creates a serverless serving endpoint
- Slightly more expensive but still far cheaper than provisioned
- Better for high-volume, low-latency needs

### Step 3: Check Your Current Endpoint Type

Run this to see if your endpoint is already serverless:

```bash
curl -X GET \
  "https://${DATABRICKS_HOST}/api/2.0/serving-endpoints/${DATABRICKS_ENDPOINT_NAME}" \
  -H "Authorization: Bearer ${DATABRICKS_TOKEN}"
```

Look for `"endpoint_core_config": { "served_entities": [...] }`
- If you see `"workload_type": "CPU"` or `"GPU"` → Provisioned (expensive)
- If you see `"workload_size": "Small"` → Serverless (cheap!)

---

## Implementation Options

### Option A: SQL AI Functions (Recommended)

**Pros:**
- True serverless - $0 when idle
- Sub-second startup
- Cheapest option (~$0.22 per DBU)
- No rate limits

**Setup:**
1. Create serverless SQL warehouse (above)
2. I'll update your edge function to use SQL AI queries
3. Update environment variables

**Cost Example:**
- 3-second query = ~0.002 DBUs
- Cost: 0.002 × $0.22 = $0.00044 per query
- 100 queries/day = $0.04/day = $1.20/month

---

### Option B: Convert to Serverless Model Serving

**Pros:**
- Better for streaming responses
- Lower latency for high volume
- Still much cheaper than provisioned

**Setup:**
1. Go to: Machine Learning → Serving
2. Create new endpoint or edit existing
3. Select "Serverless" compute
4. Choose "Databricks Foundation Models" or your custom model

**Cost Example:**
- ~$1-3 per million tokens (varies by model)
- Typical query: 500 tokens = $0.002
- 100 queries/day = $0.20/day = $6/month

---

## Quick Decision Guide

**Choose SQL AI Functions if:**
- ✓ You make <1000 queries/day
- ✓ Response time 1-3 seconds is acceptable
- ✓ You want the absolute lowest cost
- ✓ You're using standard AI tasks (summarization, Q&A, classification)

**Choose Serverless Model Serving if:**
- ✓ You need <500ms response times
- ✓ You need streaming responses
- ✓ You're using a fine-tuned custom model
- ✓ You make >1000 queries/day

---

## Let's Get Started

Tell me which option you prefer and I'll help you implement it:

1. **Option A**: SQL AI Functions (I recommend this - easiest and cheapest)
2. **Option B**: Serverless Model Serving (if you need lower latency)

Or if you want me to check your current setup first, I can help analyze what you already have configured.
