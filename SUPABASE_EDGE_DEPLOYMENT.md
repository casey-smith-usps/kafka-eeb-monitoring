# Supabase Edge Function Deployment - No Heroku Needed!

## ✅ The Solution (Free & Simple)

You already have a **Supabase Edge Function** that handles Kafka sync. It's serverless, free, and runs on Node.js.

**No Heroku account needed. No $7/month. Just push to GitHub Pages!**

---

## What Changed

Your app now calls the **Supabase Edge Function** instead of the Python backend:

```
Before: /api/sync-kafka-topics (Python - needs Heroku)
After:  https://dowixaqpokruwwqcykzo.supabase.co/functions/v1/sync-kafka-topics (Node.js - free!)
```

---

## Deploy in 3 Steps

### Step 1: Update Your Local Files

Copy these files from Bolt to your local project:
- `src/components/KafkaSync.tsx` (updated to use edge function)
- `.env` (removed Heroku URL)
- `.env.example` (updated)

### Step 2: Install Dependencies

```bash
cd /path/to/your/project
npm install
```

### Step 3: Build and Deploy to GitHub Pages

```bash
# Build the app
npm run build

# Deploy to GitHub Pages
npm run deploy
```

**That's it!** Your app will be at `https://usps-dataeng.github.io/` and sync will work.

---

## How It Works

```
┌─────────────────┐
│  GitHub Pages   │ ← Your React app (free hosting)
│  usps-dataeng   │
└────────┬────────┘
         │
         │ fetch()
         ↓
┌─────────────────┐
│  Supabase Edge  │ ← Node.js function (free, serverless)
│  sync-kafka-    │
│     topics      │
└────────┬────────┘
         │
         ├──→ Confluent Cloud (fetch topics)
         └──→ Supabase DB (save to database)
```

---

## Verify Edge Function is Deployed

Your edge function is already deployed and active:
- **Function Name**: `sync-kafka-topics`
- **Status**: ACTIVE
- **URL**: `https://dowixaqpokruwwqcykzo.supabase.co/functions/v1/sync-kafka-topics`

You can test it with:

```bash
curl -X POST \
  https://dowixaqpokruwwqcykzo.supabase.co/functions/v1/sync-kafka-topics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd2l4YXFwb2tydXd3cWN5a3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDMwMTYsImV4cCI6MjA4NTI3OTAxNn0.L5g60FLYwAZ9IRJXDN2U6sLJHrNnF_PtHQNP5cxV0oc" \
  -d '{"admin_url":"test","cluster_id":"test"}'
```

Should return an error about missing credentials (that's expected - means it's working!).

---

## Troubleshooting

### Issue: Still getting 405 errors after deploying

**Fix:**
1. Make sure you copied the updated `KafkaSync.tsx` file
2. Rebuild: `npm run build`
3. Redeploy: `npm run deploy`

### Issue: "Failed to connect to Kafka API"

**Cause:** Edge function can't reach Confluent through your corporate proxy

**Solution:** The edge function runs on Supabase's servers (not your machine), so it bypasses your corporate proxy. This should actually work better than the Python backend!

### Issue: Need to update the edge function

If you ever need to modify the edge function:

1. Edit `supabase/functions/sync-kafka-topics/index.ts`
2. Deploy with:
   ```bash
   # This uses the Supabase MCP tools - already configured in Bolt
   ```
3. Or ask me to deploy it for you!

---

## Cost Comparison

| Solution | Monthly Cost | Pros | Cons |
|----------|--------------|------|------|
| **Supabase Edge** | **$0** | Free, fast, serverless, no maintenance | None! |
| Heroku Free | $0 | Easy setup | App sleeps, deprecated |
| Heroku Basic | $7 | Never sleeps | Costs money unnecessarily |
| Python Backend | Varies | Full control | Need hosting, maintenance |

**Winner: Supabase Edge Functions!** 🎉

---

## What About the Python Backend?

The `app.py` file is still useful for:
- **Local development** - Run `python app.py` when testing locally
- **Corporate proxy support** - If you're behind USPS firewall and need to sync from your machine
- **Backup option** - In case you want to self-host later

But for **GitHub Pages deployment**, you don't need it anymore!

---

## Quick Reference

```bash
# Deploy to GitHub Pages (does everything)
npm run deploy

# Run locally (uses Python backend)
python app.py

# Then in another terminal:
npm run dev
```

---

## Summary

✅ **No Heroku account needed**
✅ **No $7/month subscription**
✅ **Supabase Edge Function is free and already deployed**
✅ **Just run `npm run deploy` and you're done!**

Your app is now using serverless architecture - this is the modern way! 🚀
