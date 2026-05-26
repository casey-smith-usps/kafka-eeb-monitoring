# GitHub Pages + Heroku Deployment Guide

## The Problem

GitHub Pages **only hosts static files** (HTML, CSS, JavaScript). It **cannot** run your Python backend (`app.py`).

When you visit `https://usps-dataeng.github.io/`, you're accessing static files, but the Python Flask server is not running, which causes the 405 error when trying to sync Kafka topics.

## The Solution: Two-Part Deployment

Deploy your **frontend** and **backend** separately:

1. **Frontend** (React app) → GitHub Pages
2. **Backend** (Python Flask app) → Heroku

---

## Part 1: Deploy Python Backend to Heroku

### Step 1: Create Heroku App

```bash
# Navigate to your project
cd /path/to/your/usps-kafka-project

# Login to Heroku (opens browser)
heroku login

# Create a new Heroku app
heroku create usps-kafka-backend
```

### Step 2: Set Environment Variables on Heroku

```bash
# Supabase credentials
heroku config:set VITE_SUPABASE_URL="https://dowixaqpokruwwqcykzo.supabase.co"
heroku config:set VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd2l4YXFwb2tydXd3cWN5a3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDMwMTYsImV4cCI6MjA4NTI3OTAxNn0.L5g60FLYwAZ9IRJXDN2U6sLJHrNnF_PtHQNP5cxV0oc"

# If you're behind a corporate proxy (USPS network)
heroku config:set HTTP_PROXY="http://proxy.usps.gov:8080"
heroku config:set HTTPS_PROXY="http://proxy.usps.gov:8080"
```

### Step 3: Deploy to Heroku

```bash
# Deploy your backend
git push heroku main

# Check if it's running
heroku logs --tail

# Open in browser to verify
heroku open
```

Your backend will be available at: `https://usps-kafka-backend.herokuapp.com`

---

## Part 2: Deploy Frontend to GitHub Pages

### Step 1: Update `.env` File

Edit your **local** `.env` file:

```env
# Point to your Heroku backend
VITE_BACKEND_URL=https://usps-kafka-backend.herokuapp.com

VITE_SUPABASE_URL=https://dowixaqpokruwwqcykzo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd2l4YXFwb2tydXd3cWN5a3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDMwMTYsImV4cCI6MjA4NTI3OTAxNn0.L5g60FLYwAZ9IRJXDN2U6sLJHrNnF_PtHQNP5cxV0oc
```

**Important:** The `.env` file is used at **build time** by Vite. The `VITE_BACKEND_URL` will be baked into your JavaScript bundle.

### Step 2: Build and Deploy Frontend

```bash
# Build the React app with the new backend URL
npm run build

# Deploy to GitHub Pages (assumes you have gh-pages set up)
npm run deploy
```

If you don't have `gh-pages` set up, add this to your `package.json`:

```json
{
  "scripts": {
    "deploy": "gh-pages -d dist"
  },
  "devDependencies": {
    "gh-pages": "^6.1.0"
  }
}
```

Then run:

```bash
# Install gh-pages
npm install --save-dev gh-pages

# Deploy
npm run deploy
```

---

## Part 3: Verify Deployment

### Test Backend

```bash
# Test that your backend is running
curl https://usps-kafka-backend.herokuapp.com/api/sync-kafka-topics

# Should return a 500 error with "Missing Confluent credentials" (that's expected - it means the endpoint is working)
```

### Test Frontend

1. Open `https://usps-dataeng.github.io/`
2. Click "Sync Kafka"
3. Select a cluster and sync
4. Should now work without 405 errors!

---

## Troubleshooting

### Issue: Backend returns 500 errors

**Cause:** Environment variables not set on Heroku

**Fix:**
```bash
# Check what's set
heroku config

# Set missing variables
heroku config:set VITE_SUPABASE_URL="your-url"
heroku config:set VITE_SUPABASE_ANON_KEY="your-key"
```

### Issue: Frontend still shows 405 errors

**Cause:** `.env` file not updated before build

**Fix:**
1. Update `.env` with correct `VITE_BACKEND_URL`
2. Rebuild: `npm run build`
3. Redeploy: `npm run deploy`

### Issue: CORS errors in browser console

**Cause:** Backend CORS not configured for your GitHub Pages domain

**Fix:** Your `app.py` already has `CORS(app)` which allows all origins. If you see CORS errors, check that:
1. Backend is running on Heroku
2. `VITE_BACKEND_URL` in `.env` matches your Heroku URL exactly
3. Rebuild the frontend after changing `.env`

### Issue: Heroku app goes to sleep

**Free tier Heroku apps sleep after 30 minutes of inactivity**

**Options:**
1. Upgrade to Heroku Basic ($7/month) - never sleeps
2. Use Heroku's "keep-alive" service
3. Accept 5-10 second delay on first sync after sleep

### Issue: Corporate proxy blocking Heroku

If you're on USPS network:

```bash
# Set proxy on Heroku
heroku config:set HTTP_PROXY="http://proxy.usps.gov:8080"
heroku config:set HTTPS_PROXY="http://proxy.usps.gov:8080"

# Restart the app
heroku restart
```

---

## Alternative: Run Everything on Heroku

If you don't want to use GitHub Pages, you can host both frontend and backend on Heroku:

### Option A: Single Heroku App (Current Setup)

Your `app.py` already serves the frontend from the `dist` folder:

```bash
# Just deploy everything to Heroku
heroku create usps-kafka-app
heroku config:set [your env vars]
git push heroku main

# Access at: https://usps-kafka-app.herokuapp.com
```

No need for GitHub Pages at all!

### Option B: Keep GitHub Pages for Frontend

Advantages:
- GitHub Pages is free and fast (CDN)
- Better for static content
- Separates concerns (frontend/backend)

Disadvantage:
- Requires two deployments (but worth it!)

---

## Recommended Setup Summary

1. **Backend on Heroku**: `https://usps-kafka-backend.herokuapp.com`
   - Handles all API calls
   - Runs Python Flask server
   - Connects to Confluent and Supabase

2. **Frontend on GitHub Pages**: `https://usps-dataeng.github.io/`
   - Serves React app (static files)
   - Makes API calls to Heroku backend
   - Fast and free hosting

This is the industry-standard approach for full-stack web apps!

---

## Quick Reference Commands

```bash
# Deploy backend to Heroku
git push heroku main
heroku logs --tail

# Build and deploy frontend to GitHub Pages
npm run build
npm run deploy

# Check Heroku config
heroku config

# Restart Heroku app
heroku restart

# View Heroku logs
heroku logs --tail
```
