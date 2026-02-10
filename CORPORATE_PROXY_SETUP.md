# Corporate Proxy Setup Guide (USPS Network)

## Problem
Connection to `api.confluent.cloud` times out because USPS network blocks direct internet access.

## Solution
Configure proxy settings so Python can connect through your corporate proxy.

---

## Step 1: Find Your Proxy Settings (Windows)

### Option A: Check Windows Proxy Settings
1. Press `Windows + I` to open Settings
2. Go to **Network & Internet** → **Proxy**
3. Look for **Manual proxy setup** or **Automatic proxy configuration**
4. Note the proxy address (e.g., `proxy.usps.gov:8080`)

### Option B: Check Internet Explorer Settings
1. Open Internet Explorer (yes, really)
2. Go to **Tools** → **Internet Options** → **Connections** → **LAN Settings**
3. Look for the proxy server address and port

### Option C: Check Environment Variables
1. Open Command Prompt
2. Run:
   ```cmd
   echo %HTTP_PROXY%
   echo %HTTPS_PROXY%
   ```
3. If they show a value, that's your proxy

### Option D: Ask IT
Contact your IT department and ask: "What is the HTTP/HTTPS proxy server address and port for accessing external APIs?"

---

## Step 2: Update Your .env File

**SECURITY NOTE:** Never commit your `.env` file to GitHub! It contains sensitive credentials. The `.env.example` file shows the structure but doesn't contain real values.

Once you have the proxy address (e.g., `proxy.usps.gov:8080`), update your `.env` file (NOT `.env.example`):

```env
# Corporate Proxy Settings
HTTP_PROXY=http://proxy.usps.gov:8080
HTTPS_PROXY=http://proxy.usps.gov:8080
```

**If proxy requires authentication:**
```env
HTTP_PROXY=http://username:password@proxy.usps.gov:8080
HTTPS_PROXY=http://username:password@proxy.usps.gov:8080
```

---

## Step 3: Restart Python Backend

1. **Stop** the Flask server (press `Ctrl+C` in the terminal running `python app.py`)
2. **Restart** it:
   ```bash
   python app.py
   ```
3. The app will now use the proxy settings

---

## Step 4: Test Again

1. Open http://localhost:5173 in your browser
2. Click "Sync from Kafka"
3. Should now work through the proxy

---

## Common Issues

### Proxy Authentication Required
If you get a 407 error, the proxy requires username/password:
```env
HTTPS_PROXY=http://YOUR_WINDOWS_USERNAME:YOUR_PASSWORD@proxy.usps.gov:8080
```

### SSL Certificate Errors
If you get SSL errors, your company might use SSL inspection. Contact IT for the corporate certificate.

### Still Timing Out
1. Verify proxy address is correct
2. Check if VPN is required
3. Test proxy with curl:
   ```bash
   curl -x http://proxy.usps.gov:8080 https://api.confluent.cloud
   ```

---

## Alternative: Use VPN

If proxy doesn't work, check if USPS provides a VPN:
1. Connect to USPS VPN
2. Run `python app.py` again
3. VPN might bypass proxy requirements

---

## Quick Test

Test if proxy works:
```bash
# Set proxy temporarily (Windows CMD)
set HTTPS_PROXY=http://proxy.usps.gov:8080
curl https://api.confluent.cloud

# Set proxy temporarily (PowerShell)
$env:HTTPS_PROXY="http://proxy.usps.gov:8080"
curl https://api.confluent.cloud
```

If curl works, Python will work too.

---

## Need Help?

1. Check with IT for proxy settings
2. Verify you can access `https://api.confluent.cloud` from your browser
3. Make sure proxy is added to `.env` file
4. Restart Python backend after changing `.env`
