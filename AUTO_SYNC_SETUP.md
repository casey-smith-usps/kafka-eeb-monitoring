# Automatic Kafka Sync Setup Guide

This guide shows how to automatically sync Kafka topics to Supabase on a schedule.

## How It Works

1. **Your local machine** runs `app.py` (Flask backend with proxy access)
2. **Scheduler** (`auto_sync.py`) calls the Flask API every X hours
3. **Data syncs** to Supabase (cloud database)
4. **Dashboard** (GitHub Pages) shows live data to everyone

✓ You only need to keep your local machine running
✓ No manual syncing needed
✓ Everyone sees updated data automatically

---

## Quick Start

### Option 1: Run Manually (Simple)

1. **Terminal 1** - Start Flask backend:
   ```bash
   python app.py
   ```

2. **Terminal 2** - Start auto-sync scheduler:
   ```bash
   python auto_sync.py
   ```

Keep both terminals running. Sync happens every 6 hours.

### Option 2: Windows One-Click (Easier)

Double-click `start_auto_sync.bat`

This starts both Flask and the scheduler automatically.

---

## Configure Sync Interval

Edit `auto_sync.py` line 22:

```python
SYNC_INTERVAL_HOURS = 6  # Change to 1, 4, 12, 24, etc.
```

---

## Run as Windows Background Service

### Option A: Windows Task Scheduler (Recommended)

1. **Open Task Scheduler** (search in Start menu)

2. **Create Task** (right sidebar):
   - Name: `Kafka Auto Sync`
   - Description: `Automatically sync Kafka topics to Supabase`

3. **General tab**:
   - ✓ Check "Run whether user is logged on or not" (runs hidden in background)
   - ✓ Check "Run with highest privileges" (if needed for network access)
   - Configure for: `Windows 10`

4. **Triggers tab** → New:
   - Begin: `At log on` (your user account)
   - Advanced: Check "Enabled"

5. **Actions tab** → New:
   - Action: `Start a program`
   - Program: `pythonw.exe` (full path: `C:\Path\To\Python\pythonw.exe`)
   - Arguments: `auto_sync.py`
   - Start in: `C:\Path\To\Project`

   **Note:** Use `pythonw.exe` NOT `python.exe` - this runs without a console window!

6. **Conditions tab**:
   - Uncheck "Start only if computer is on AC power"
   - Uncheck "Stop if computer switches to battery"

7. **Settings tab**:
   - Check "Allow task to be run on demand"
   - Check "If task fails, restart every: 1 hour"
   - Uncheck "Stop task if it runs longer than"

8. Click **OK**, enter your Windows password when prompted

### Option B: NSSM (Non-Sucking Service Manager)

For running as a true Windows service:

1. Download NSSM: https://nssm.cc/download

2. Install as service:
   ```cmd
   nssm install KafkaAutoSync "C:\Path\To\Python\python.exe" "C:\Path\To\Project\auto_sync.py"
   nssm set KafkaAutoSync AppDirectory "C:\Path\To\Project"
   nssm start KafkaAutoSync
   ```

3. Service will auto-start with Windows

---

## Run on Linux/Mac (Cron)

1. Edit crontab:
   ```bash
   crontab -e
   ```

2. Add line for every 6 hours:
   ```cron
   0 */6 * * * cd /path/to/project && python3 auto_sync.py
   ```

Or use systemd timer for more control.

---

## Monitoring

### View Live Logs

When running manually, logs show in terminal:
```
AUTOMATIC SYNC TRIGGERED: 2026-02-12 10:30:00
✓ Sync successful!
  Topics synced: 47
  Errors: 0
Next sync in 6 hours...
```

### Check if Running

**Windows:**
```cmd
tasklist | findstr python
```

**Linux/Mac:**
```bash
ps aux | grep auto_sync.py
```

---

## Troubleshooting

### "Could not connect to Flask backend"

Flask (`app.py`) isn't running. Start it first:
```bash
python app.py
```

### Sync fails with proxy errors

Check `.env` has correct proxy settings:
```env
HTTP_PROXY=http://proxy.usps.gov:8080
HTTPS_PROXY=http://proxy.usps.gov:8080
```

### Want to sync NOW

Run manually:
```bash
python auto_sync.py
```
Press Ctrl+C after first sync to stop scheduler.

---

## Deploy Dashboard to GitHub Pages

Once auto-sync is running, deploy your dashboard:

```bash
npm run deploy
```

Dashboard URL: `https://yourusername.github.io/your-repo-name/`

Everyone with this link sees live data from Supabase (no login needed).

---

## Summary

✓ Run `start_auto_sync.bat` on your work machine
✓ Keep it running (Task Scheduler recommended)
✓ Data syncs to Supabase every 6 hours
✓ Dashboard shows live data to everyone
✓ No manual work needed!
