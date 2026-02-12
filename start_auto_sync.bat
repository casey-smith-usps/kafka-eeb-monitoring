@echo off
REM Automatic Kafka Sync Startup Script (Windows)
REM This starts both Flask backend and the auto-sync scheduler

echo Starting Kafka Auto-Sync System...
echo.

REM Start Flask backend in background
start "Flask Backend" cmd /c python app.py

REM Wait 5 seconds for Flask to start
timeout /t 5 /nobreak

REM Start auto-sync scheduler
echo Starting scheduler...
python auto_sync.py

REM If scheduler exits, stop Flask too
taskkill /FI "WINDOWTITLE eq Flask Backend*" /T /F
