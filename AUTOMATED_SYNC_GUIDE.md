# Automated Kafka Sync Guide

## Current Status After Cleanup

✅ **Fixed Issues:**
- Removed 195 duplicate/misplaced topics from SIT C1 GCP
- Fixed sync function to check both `name` AND `cluster_id` to prevent future duplicates
- Current counts (as of cleanup):
  - **SIT Azure**: 110 topics ✓
  - **SIT E4 GCP**: 393 topics ✓
  - **SIT C1 GCP**: 328 topics ⚠️ (missing 65 topics)
  - **Total SIT**: 831 topics (should be 896)

⚠️ **Action Needed:** Re-sync SIT C1 GCP to get the missing 65 topics

---

## How to Use the Improved Sync Feature

### Quick Sync (Recommended)

1. **Open the Kafka Sync modal** from the dashboard
2. **Select a predefined cluster** from the green dropdown at the top:
   - All credentials auto-fill automatically
   - No manual entry needed
   - Prevents mistakes
3. **Click "Sync Topics"**
4. Done!

### Available Clusters

#### DEV Environment
- DEV Azure (lkc-33v902)
- DEV GCP (lkc-y9zr9j)

#### SIT Environment
- SIT C1 GCP (lkc-6zkk3q) - Central region replica
- SIT E4 GCP (lkc-rkrr50) - East region replica
- SIT Azure (lkc-q9212m)

#### CAT Environment
- CAT GCP (lkc-10v633) - Full schema access ✓
- CAT Azure (lkc-y3v5qj) - **Limited schema access** ⚠️

---

## CAT Azure Schema Strategy (Option B)

Since you're limited to 10 API keys and CAT Azure only has 84 topics with 7 schemas:

### Recommended Approach:
1. **Sync CAT Azure WITHOUT schema credentials**
   - Select "CAT Azure" from the dropdown
   - Clear the Schema Registry fields (leave empty)
   - Click "Sync Topics"
   - Result: All 84 topics sync, but no schemas (acceptable)

2. **If you need the 7 CAT Azure schemas later:**
   - Create a temporary Schema API key in Confluent
   - Manually re-sync CAT Azure with schema credentials
   - Delete the API key immediately after
   - The schemas will persist in the database

### Why This Works:
- CAT Azure has minimal schemas (7) compared to CAT GCP (full set)
- Topics data is more important than schemas
- You can manually upload the 7 schemas if absolutely needed
- Saves you an API key slot

---

## Mass Delete Feature

If you need to clean up a cluster (e.g., incorrect sync):

1. Open Kafka Sync modal
2. Select the cluster you want to delete
3. Click **"Mass Delete Cluster"** (red button, bottom left)
4. Type `DELETE [cluster-id]` to confirm
   - Example: `DELETE lkc-6zkk3q`
5. All topics and related data for that cluster are removed

**Use cases:**
- Wrong cluster was synced
- Duplicate data needs cleanup
- Starting fresh with a cluster

---

## Automated Syncing Every 2 Days

### Option 1: Manual Process (Current Setup)

**Every 2 days:**
1. Open your app
2. Click "Sync Kafka"
3. Select each cluster from the dropdown
4. Click "Sync Topics"
5. Repeat for all 7 clusters

**Time required:** ~5-10 minutes for all 7 clusters

### Option 2: Browser Automation Script

Create a script that opens the app and triggers syncs automatically.

#### Using Python + Selenium:

```python
# install: pip install selenium
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
import time

# Configuration
APP_URL = "https://your-app-url.com"
CLUSTERS_TO_SYNC = [
    "dev-azure",
    "dev-gcp",
    "sit-c1-gcp",
    "sit-e4-gcp",
    "sit-azure",
    "cat-azure",
    "cat-gcp"
]

def sync_all_clusters():
    driver = webdriver.Chrome()  # or Firefox()

    try:
        # Open app
        driver.get(APP_URL)
        time.sleep(3)

        for cluster_id in CLUSTERS_TO_SYNC:
            print(f"Syncing {cluster_id}...")

            # Click Sync Kafka button
            sync_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Sync Kafka')]"))
            )
            sync_button.click()
            time.sleep(2)

            # Select cluster from dropdown
            cluster_dropdown = Select(driver.find_element(By.ID, "cluster-select"))
            cluster_dropdown.select_by_value(cluster_id)
            time.sleep(1)

            # Click Sync Topics button
            sync_topics_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Sync Topics')]")
            sync_topics_button.click()

            # Wait for sync to complete (adjust time as needed)
            time.sleep(30)

            # Close modal
            close_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Done')]")
            close_button.click()
            time.sleep(2)

            print(f"✓ {cluster_id} synced")

        print("All clusters synced successfully!")

    finally:
        driver.quit()

if __name__ == "__main__":
    sync_all_clusters()
```

#### Schedule with Windows Task Scheduler:

1. Save the script as `sync_kafka.py`
2. Open Task Scheduler
3. Create a new task:
   - **Trigger**: Every 2 days at 2 AM
   - **Action**: Start a program
   - **Program**: `python`
   - **Arguments**: `C:\path\to\sync_kafka.py`
4. Done - runs automatically every 2 days

#### Schedule with Mac/Linux Cron:

```bash
# Edit crontab
crontab -e

# Add this line (runs every 2 days at 2 AM)
0 2 */2 * * /usr/bin/python3 /path/to/sync_kafka.py
```

### Option 3: Backend Scheduled Job

Create a backend service that calls the sync function directly:

```python
# scheduled_sync.py
import requests
import os
from datetime import datetime

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')

CLUSTERS = [
    {
        "id": "dev-azure",
        "admin_url": "https://lkc-33v902.dom4gl8rd6w.eastus.azure.confluent.cloud",
        "cluster_id": "lkc-33v902",
        "api_key": "XW3T6QRAT4VPGPUO",
        "api_secret": "cfltvsREZFEb2Nleb17TvjSzNHZYD723W8fPIC2qBqlRKQ1Gg0EjJ7vXJaLz7mmA",
        "cloud_provider": "Azure",
        "cluster_name": "DEV Azure",
        "schema_registry_url": "https://psrc-67zq6.us-east4.gcp.confluent.cloud",
        "schema_registry_key": "URC4AVTEVT7LGPDJ",
        "schema_registry_secret": "cflt+WYTC9sXDGiKywm/Lu62w6+OxFtaNPO4KAzo68Ut3lnvvMbcxEZgniOK0I6g"
    },
    # ... add all 7 clusters here
]

def sync_cluster(cluster):
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/sync-kafka-topics",
            json=cluster,
            timeout=300
        )

        if response.ok:
            result = response.json()
            print(f"✓ {cluster['cluster_name']}: {result['results']['synced']} new, {result['results']['updated']} updated")
            return True
        else:
            print(f"✗ {cluster['cluster_name']}: {response.text}")
            return False
    except Exception as e:
        print(f"✗ {cluster['cluster_name']}: {str(e)}")
        return False

def sync_all():
    print(f"\n=== Kafka Sync Started at {datetime.now()} ===\n")

    success_count = 0
    for cluster in CLUSTERS:
        if sync_cluster(cluster):
            success_count += 1

    print(f"\n=== Sync Complete: {success_count}/{len(CLUSTERS)} clusters synced successfully ===\n")

if __name__ == "__main__":
    sync_all()
```

Then schedule this with cron or Task Scheduler as shown above.

---

## Immediate Next Steps

1. **Re-sync SIT C1 GCP** to get the missing 65 topics:
   - Open Kafka Sync
   - Select "SIT C1 GCP"
   - Click "Sync Topics"
   - Should update to 393 topics

2. **Sync CAT Azure without schemas** (Option B):
   - Open Kafka Sync
   - Select "CAT Azure"
   - Clear Schema Registry fields
   - Click "Sync Topics"
   - 84 topics will sync

3. **Verify final counts:**
   - SIT: 896 topics (393+393+110)
   - Total: ~2080 topics across all environments

4. **Set up automation** using one of the methods above

---

## Troubleshooting

### "Topics showing wrong count"
- Use Mass Delete to remove the cluster
- Re-sync from Confluent
- The fix now prevents duplicates

### "Sync is slow"
- The Python backend handles corporate proxies better
- Each cluster takes 30-60 seconds
- Schema sync adds extra time

### "Can't create more API keys"
- Use Option B for CAT Azure (no schema credentials)
- Delete old unused API keys in Confluent
- You only need 7 API key pairs (one per cluster)

---

## Files Modified

- `src/config/clusterConfig.ts` - Hardcoded cluster credentials
- `src/components/KafkaSync.tsx` - Auto-fill dropdown and mass delete
- `supabase/functions/sync-kafka-topics/index.ts` - Duplicate prevention fix
- `src/components/TopicDetail.tsx` - Schema History tab shows synced schemas

All changes are deployed and ready to use!
