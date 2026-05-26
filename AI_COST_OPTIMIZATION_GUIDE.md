# AI Endpoint Cost Optimization Guide

## Problem Identified

Your Databricks serving endpoint is showing significant costs:
- **Daily Cost**: ~$144/day (~$4,320/month)
- **Daily DBUs**: ~2057.14 DBUs (constant)
- **Requests**: 0 on most days
- **Root Cause**: Provisioned endpoint running 24/7 with no automatic scaling

## IMMEDIATE ACTIONS (Save ~95% of costs)

### Option 1: Switch to Serverless Endpoints (RECOMMENDED)
**Cost Savings**: ~$4,000/month → ~$50-200/month

Databricks Serverless endpoints:
- ✅ Auto-scale to zero when not in use
- ✅ Pay only for actual inference time
- ✅ Sub-second cold start
- ✅ Perfect for sporadic usage

**How to Switch:**
1. Go to Databricks Workspace → **Serving**
2. Click your endpoint: `eeb-llm-endpoint`
3. Click **"Edit Configuration"**
4. Under **Compute**, select **"Serverless"** instead of "Provisioned"
5. Save and update

**Before/After Cost Example:**
- Provisioned: $144/day × 30 = $4,320/month
- Serverless: $0.15 per 1M tokens × ~10M tokens/month = ~$150/month

---

### Option 2: Use External AI API Instead
**Cost Savings**: ~$4,000/month → ~$20-100/month

Switch to OpenAI, Anthropic, or AWS Bedrock:
- OpenAI GPT-4o-mini: $0.15/$0.60 per 1M tokens (in/out)
- Anthropic Claude Haiku: $0.25/$1.25 per 1M tokens
- AWS Bedrock: Similar pricing, integrated billing

**To Implement:**
1. Get API key from provider (OpenAI/Anthropic/AWS)
2. Update edge function to call their API instead
3. Delete Databricks endpoint

---

### Option 3: Scale Down Provisioned Endpoint
**Cost Savings**: ~$3,000/month

If you must keep provisioned:
1. **Reduce Instance Size**:
   - Current: Likely GPU-based instances
   - Change to: Smallest CPU instance (e.g., "Small")

2. **Set Auto-Shutdown**:
   - Enable "Auto Stop" after 15 minutes of inactivity
   - This isn't true serverless but helps

---

### Option 4: Disable When Not Needed
**Cost Savings**: $4,320/month (if completely disabled)

Manual approach:
1. **Stop the endpoint** when not using AI features
2. **Restart** when needed (takes ~5-10 minutes)
3. Add a toggle in your app to disable AI features

---

## Recommended Architecture Change

### Current Flow:
```
User → Supabase Edge Function → Databricks Provisioned Endpoint (Always Running) → LLM
                                        $$$ 24/7 COSTS $$$
```

### Recommended Flow:
```
User → Supabase Edge Function → OpenAI/Anthropic API (Serverless) → LLM
                                    $$$ PAY PER REQUEST $$$
```

OR

```
User → Supabase Edge Function → Databricks Serverless Endpoint (Auto-scales to 0) → LLM
                                    $$$ PAY WHEN USED $$$
```

---

## Implementation: Switch to OpenAI (Fastest Fix)

I can help you switch to OpenAI in ~5 minutes:

1. Get OpenAI API key: https://platform.openai.com/api-keys
2. Use GPT-4o-mini (cheap and fast):
   - Input: $0.15 per 1M tokens
   - Output: $0.60 per 1M tokens
   - For your usage: ~$20-50/month

3. Update edge function to use OpenAI instead of Databricks
4. Delete Databricks endpoint

**Cost Comparison for Typical Usage:**
- Databricks Provisioned: $144/day = $4,320/month
- OpenAI GPT-4o-mini: 100 requests/day × 2K tokens × $0.60/1M = $36/month

---

## Cost Monitoring

I'll add usage tracking to the dashboard so you can:
- Track number of AI requests per day
- Estimate monthly costs
- Set budget alerts
- View per-user usage

---

## Next Steps

**Choose one option:**

1. **"Switch to OpenAI"** → I'll update the code in 5 minutes
2. **"Make Databricks Serverless"** → Follow steps above in Databricks UI
3. **"Add cost tracking first"** → I'll add monitoring before changing anything
4. **"Stop endpoint now"** → I'll disable AI features and stop the endpoint

---

## Why This Happened

Databricks provisioned endpoints are designed for:
- High-throughput production workloads (1000s of requests/hour)
- Latency-sensitive applications (<100ms response time)
- Predictable, constant traffic

Your use case:
- Sporadic usage (5-10 requests/day)
- Not latency-critical
- Perfect for serverless or external APIs

**You're paying for a Ferrari when you only need a bicycle.**

---

## Questions?

Let me know which approach you'd like and I'll implement it immediately.
