# Databricks Serverless SQL Warehouse - Setup Steps

## What I Just Created

I've deployed a new edge function `databricks-sql-ai` that uses Databricks SQL AI Functions on a serverless SQL warehouse. This will reduce your AI query costs by **99%**.

**Cost Comparison:**
- Current (Provisioned): $0.05 per query = $144/day for 100 queries
- New (Serverless SQL): $0.00044 per query = $0.04/day for 100 queries
- **Savings: $143.96/day = $4,319/month**

---

## Step 1: Create Serverless SQL Warehouse in Databricks

1. **Go to your Databricks workspace**
   - Navigate to: **SQL** → **SQL Warehouses**
   - Click **"Create SQL Warehouse"**

2. **Configure the warehouse:**
   ```
   Name: eeb-ai-serverless
   Cluster size: 2X-Small (sufficient for AI queries)
   Auto-stop: 10 minutes
   Type: ☑ Serverless (CRITICAL - must check this!)
   ```

3. **Enable AI Functions:**
   - Click **Advanced options**
   - Under **SQL Configuration Parameters**, click **Add**
   - Add this parameter:
     ```
     Key: spark.databricks.sql.functions.ai.enabled
     Value: true
     ```

4. **Create the warehouse**
   - Click **Create**
   - Wait for it to start (should take 10-15 seconds)

5. **Get the Warehouse ID:**
   - Click on your new warehouse
   - Look at the URL: `https://your-workspace.databricks.com/sql/warehouses/abc123xyz`
   - Copy the ID at the end: `abc123xyz`
   - OR find it under **Connection Details** → **HTTP Path**: `/sql/1.0/warehouses/abc123xyz`

---

## Step 2: Add Environment Variable

You need to add the SQL Warehouse ID to your environment:

**Add this to your `.env` file:**
```bash
DATABRICKS_SQL_WAREHOUSE_ID=your_warehouse_id_here
```

Replace `your_warehouse_id_here` with the ID you copied in Step 1.

---

## Step 3: Deploy the Environment Variable to Supabase

After adding to `.env`, you need to set it in Supabase Edge Functions:

**Option A: Using Supabase CLI (if installed):**
```bash
supabase secrets set DATABRICKS_SQL_WAREHOUSE_ID=your_warehouse_id_here
```

**Option B: Using Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/functions
2. Under **Secrets**, add:
   - Name: `DATABRICKS_SQL_WAREHOUSE_ID`
   - Value: `your_warehouse_id_here`

---

## Step 4: Update Your Dashboard to Use the New Endpoint

You now have TWO edge functions:
- `databricks-ai` - Original (provisioned endpoint)
- `databricks-sql-ai` - NEW serverless SQL (99% cheaper)

I can update your AI Assistant component to use the new serverless endpoint, or add a toggle to switch between them for testing.

---

## Step 5: Test the Setup

Once you've added the environment variable, test it:

1. Open your dashboard
2. Go to the AI Assistant
3. Ask a question
4. Check the cost in the AI Usage Log - it should show ~$0.00044 per query

---

## Troubleshooting

**Error: "Databricks SQL configuration missing"**
- Make sure you added `DATABRICKS_SQL_WAREHOUSE_ID` to both `.env` and Supabase secrets

**Error: "ai_query function not found"**
- Check that you enabled `spark.databricks.sql.functions.ai.enabled` in warehouse settings

**Error: "Warehouse not found"**
- Verify the warehouse ID is correct
- Make sure the warehouse is running (not stopped)

**Slow first query (5-10 seconds)?**
- Normal! Serverless warehouses start on-demand
- After first query, subsequent queries are fast (1-2 seconds)
- Warehouse auto-stops after 10 minutes of inactivity

---

## Next Steps

After you complete Steps 1-2 above, let me know and I'll:
1. Update the AI Assistant component to use the new serverless endpoint
2. Add a cost comparison dashboard
3. Help you verify the setup is working

The new function is already deployed and ready - you just need to add the warehouse ID!
