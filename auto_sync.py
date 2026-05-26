#!/usr/bin/env python3
"""
Automatic Kafka Topic Sync Scheduler

Runs every X hours to sync Kafka topics to Supabase.
Data is automatically available to anyone viewing the dashboard.

Usage:
  python auto_sync.py
"""

import os
import sys
import time
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Configuration
SYNC_INTERVAL_HOURS = 24  # Sync once per day (use 48 for every two days)
LOCAL_API_URL = "http://localhost:5000/api/sync-kafka-topics"

def sync_kafka_topics():
    """Trigger Kafka sync"""
    print("\n" + "=" * 80)
    print(f"AUTOMATIC SYNC TRIGGERED: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    try:
        # Get credentials from .env
        payload = {
            "admin_url": os.getenv('CONFLUENT_ADMIN_URL'),
            "cluster_id": os.getenv('CONFLUENT_CLUSTER_ID'),
            "api_key": os.getenv('CONFLUENT_API_KEY'),
            "api_secret": os.getenv('CONFLUENT_API_SECRET'),
            "cloud_provider": "Azure",
            "cluster_name": "Azure DEV"
        }

        print(f"Calling sync API at {LOCAL_API_URL}...")
        response = requests.post(LOCAL_API_URL, json=payload, timeout=300)

        if response.status_code == 200:
            result = response.json()
            print(f"✓ Sync successful!")
            print(f"  Topics synced: {result.get('synced_count', 0)}")
            print(f"  Errors: {result.get('error_count', 0)}")
        else:
            print(f"✗ Sync failed: {response.status_code}")
            print(f"  Response: {response.text}")

    except requests.exceptions.ConnectionError:
        print("✗ ERROR: Could not connect to Flask backend.")
        print("  Make sure app.py is running: python app.py")
    except Exception as e:
        print(f"✗ ERROR: {str(e)}")

    print("=" * 80 + "\n")

def main():
    """Run sync on schedule"""
    print("╔═══════════════════════════════════════════════════════════════════╗")
    print("║         Kafka Topic Auto-Sync Scheduler Started                  ║")
    print("╚═══════════════════════════════════════════════════════════════════╝")
    print(f"Sync interval: Every {SYNC_INTERVAL_HOURS} hours")
    print(f"Target API: {LOCAL_API_URL}")
    print("\nPress Ctrl+C to stop\n")

    # Run first sync immediately
    sync_kafka_topics()

    # Then run on schedule
    interval_seconds = SYNC_INTERVAL_HOURS * 3600

    while True:
        try:
            print(f"Next sync in {SYNC_INTERVAL_HOURS} hours...")
            time.sleep(interval_seconds)
            sync_kafka_topics()

        except KeyboardInterrupt:
            print("\n\nScheduler stopped by user.")
            sys.exit(0)
        except Exception as e:
            print(f"\nUnexpected error: {e}")
            print(f"Retrying in {SYNC_INTERVAL_HOURS} hours...")
            time.sleep(interval_seconds)

if __name__ == "__main__":
    main()
