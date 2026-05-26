# Quick Deploy Guide - Fix 405 Error

## The Problem
GitHub Pages can't run your Python backend → 405 error when syncing.

## The Solution
Deploy backend to Heroku, frontend to GitHub Pages.

---

## Step 1: Update Your Local `.env` File

Edit your `.env` file and add this line at the top:

```env
VITE_BACKEND_URL=https://usps-kafka-backend.herokuapp.com
```

**Save the file!**

---

## Step 2: Deploy Backend to Heroku

```bash
# Login to Heroku
heroku login

# Create Heroku app
heroku create usps-kafka-backend

# Set environment variables
heroku config:set VITE_SUPABASE_URL="https://dowixaqpokruwwqcykzo.supabase.co"
heroku config:set VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd2l4YXFwb2tydXd3cWN5a3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDMwMTYsImV4cCI6MjA4NTI3OTAxNn0.L5g60FLYwAZ9IRJXDN2U6sLJHrNnF_PtHQNP5cxV0oc"

# Deploy
git push heroku main

# Verify it's running
heroku logs --tail
```

Press Ctrl+C to exit logs once you see "Running on http://0.0.0.0:5000"

---

## Step 3: Deploy Frontend to GitHub Pages

```bash
# Install gh-pages
npm install

# Build and deploy
npm run deploy
```

Done! Your app will be at `https://usps-dataeng.github.io/` and sync will work.

---

## Troubleshooting

**"Remote rejected" when pushing to Heroku**
- Make sure you're in the project directory
- Try: `git push heroku main:main`

**Still getting 405 errors**
1. Check your `.env` has `VITE_BACKEND_URL=https://usps-kafka-backend.herokuapp.com`
2. Rebuild: `npm run build`
3. Redeploy: `npm run deploy`

**Backend sleeping/slow first request**
- Free Heroku apps sleep after 30 min
- First request takes 5-10 seconds to wake up
- Upgrade to Basic ($7/mo) for always-on

---

## Full Documentation

See `DEPLOYMENT_GUIDE.md` for detailed instructions and troubleshooting.
