# Kafka EEB Ingestion Monitoring Dashboard

A comprehensive React-based monitoring dashboard for tracking Kafka topic ingestion, performance metrics, schema changes, and operational updates. Built for daily morning standups and real-time monitoring of your event-driven data pipeline.

## Features

### Core Functionality
- **Topic Management**: Add, edit, and track Kafka topics with complete metadata
- **Status Tracking**: Monitor topics across three states - In Progress, Complete, and Historical
- **Naming Convention Validation**: Real-time validation with automatic alerts for violations
- **Schema Version Control**: Track schema evolution with complete version history
- **Performance Metrics**: Monitor consumer lag, throughput, and error rates
- **Topic Lineage**: Visualize data flow and dependencies between topics
- **Morning Standup View**: Dedicated interface for daily team meetings
- **Alert System**: Automated and manual alerts with severity levels
- **Daily Updates**: Track blockers, status updates, and next steps

### Dashboard Views

1. **Overview Dashboard**: High-level metrics and recent activity
2. **All Topics**: Comprehensive topic list with filtering and search
3. **Morning Standup**: Daily meeting interface with update tracking
4. **Alerts**: Centralized alert management with severity filtering
5. **Topic Lineage**: Visualize topic relationships and data flow

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Python 3.11 + Flask
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **API Integration**: Confluent Cloud REST API
- **Real-time**: Supabase Realtime (optional enhancement)

## Database Schema

### Tables
- `topics` - Main topic information and configuration
- `schema_versions` - Schema evolution tracking
- `performance_metrics` - Time-series performance data
- `topic_lineage` - Relationship mapping between topics
- `updates` - Daily standup notes and status updates
- `alerts` - System and manual alerts

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- Supabase account (free tier works)

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd kafka-eeb-monitoring
```

2. Install Node dependencies
```bash
npm install
```

3. Install Python dependencies
```bash
pip install -r requirements.txt
```

4. Configure environment variables
The `.env` file should already contain your Supabase and Confluent credentials:
```
# Supabase
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Confluent Cloud
CONFLUENT_API_KEY=your-api-key
CONFLUENT_API_SECRET=your-api-secret
CONFLUENT_CLUSTER_ID=lkc-xxxxx
CONFLUENT_ENV_ID=env-xxxxx
```

### Running Locally (Development)

**Two options:**

#### Option 1: Full Stack Development (Frontend + Backend)
Run both servers simultaneously:

Terminal 1 (React frontend):
```bash
npm run dev
```

Terminal 2 (Python backend):
```bash
python app.py
```

Access the app at `http://localhost:5173` (Vite serves frontend, calls backend at port 5000)

#### Option 2: Production Mode (Single Server)
Build and run everything through Python:

```bash
npm run build
python app.py
```

Access the app at `http://localhost:5000` (Python serves both frontend and backend)

## Usage Guide

### Adding a New Topic
1. Navigate to "All Topics" view
2. Click "Add Topic" button
3. Enter topic name (validated against Kafka naming conventions)
4. Fill in optional metadata (environment, team, partitions, etc.)
5. Click "Create Topic"

### Morning Standup Workflow
1. Navigate to "Morning Standup" view
2. Review all in-progress topics
3. Click "Add Update" on each topic
4. Enter status update, blockers, and next steps
5. Active alerts are highlighted for each topic

### Tracking Schema Changes
1. Open a topic from the Topics list
2. Navigate to "Schema History" tab
3. Click "Add Version" to track a new schema
4. Enter schema definition (JSON format) and change description

### Monitoring Performance
1. Open a topic from the Topics list
2. Navigate to "Performance" tab
3. Click "Add Metric" to record current metrics
4. Enter consumer lag and throughput data

### Managing Alerts
1. Navigate to "Alerts" view
2. View active alerts by severity
3. Click "Resolve" when issues are fixed
4. Add manual alerts using "Add Alert" button

### Visualizing Lineage
1. Navigate to "Topic Lineage" view
2. Click "Add Relationship" to define data flow
3. Select source and target topics
4. Choose relationship type (produces to, consumes from, transforms to)

## Naming Convention Rules

The dashboard enforces Kafka topic naming conventions:
- Lowercase letters, numbers, dots, underscores, and hyphens only
- No consecutive dots
- Cannot start or end with a dot
- Maximum 255 characters
- No whitespace or special characters

**Recommendations**:
- Prefix with environment (dev., qa., prod.)
- Use domain-based naming: `<domain>.<subdomain>.<entity>`
- Add version suffix (e.g., .v1, .v2)

## Deployment

Since this app uses a Python backend, you need a platform that supports both Node.js (for building) and Python (for running).

### Option 1: Render (Recommended - Free Tier Available)
1. Push your code to GitHub
2. Go to [Render.com](https://render.com) and create new "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Build Command**: `npm install && npm run build && pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Environment**: Python 3
5. Add all environment variables from `.env`
6. Deploy

Your team accesses it at: `https://your-app-name.onrender.com`

### Option 2: Railway (Simple & Fast)
1. Push your code to GitHub
2. Go to [Railway.app](https://railway.app) and create new project
3. Connect your GitHub repo
4. Railway auto-detects Python and Node.js
5. Add environment variables
6. Deploy

### Option 3: Heroku (Classic Choice)
1. Create `Procfile` (already included):
   ```
   web: gunicorn app:app
   ```
2. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set VITE_SUPABASE_URL=...
   heroku config:set CONFLUENT_API_KEY=...
   # Add all other env vars
   git push heroku main
   ```

### Why Not Vercel/Netlify?
Vercel and Netlify are great for static sites and serverless functions, but this app uses a Python Flask backend that needs to run continuously. Use Render, Railway, or Heroku instead.

**See `PYTHON_DEPLOYMENT.md` for detailed deployment instructions.**

## Data Import

To import existing Kafka topic data:

1. Prepare your data in the following format:
```json
{
  "name": "prod.payments.transactions.v1",
  "description": "Payment transaction events",
  "status": "in_progress",
  "environment": "prod",
  "owner_team": "Data Engineering",
  "partition_count": 12,
  "replication_factor": 3,
  "retention_ms": 604800000
}
```

2. Use the Supabase dashboard or API to bulk insert records

## Automated Kafka Topic Sync ✨ NEW

This dashboard includes a standalone sync script that automatically pulls topics from Confluent Cloud.

### Quick Setup (5 minutes)

1. **Get your Confluent credentials** (see `QUICK_START_KAFKA_SYNC.md`)
2. **Update `.env`** with your credentials
3. **Test it**: `npm run sync:kafka`
4. **Schedule it** to run every 10 minutes

### What It Does

- ✅ Fetches all topics from Confluent Cloud
- ✅ Syncs to your Supabase database
- ✅ Creates alerts for naming violations
- ✅ Updates existing topic metadata
- ✅ Runs independently (no browser needed)

### Documentation

- **Quick Start**: `QUICK_START_KAFKA_SYNC.md` - Get up and running in 5 minutes
- **Full Guide**: `KAFKA_SYNC_DEPLOYMENT.md` - Deployment options, scheduling, monitoring

### Run Manually

```bash
npm run sync:kafka
```

### Schedule Automatically

Choose your deployment method:
- **GitHub Actions** (easiest if using GitHub)
- **Cron Job** (Linux/Mac servers)
- **Windows Task Scheduler**
- **Heroku Scheduler**
- **AWS Lambda**

See `KAFKA_SYNC_DEPLOYMENT.md` for step-by-step instructions.

## FY26 Goals Integration

This dashboard supports your FY26 goals by:
- Providing daily meeting structure and tracking
- Automating naming convention validation
- Maintaining complete audit trail of changes
- Enabling proactive monitoring and alerting
- Visualizing system architecture through lineage

## Future Enhancements

- Confluent Cloud API integration for automatic data sync
- Real-time metric updates using Supabase Realtime
- Advanced data visualization (charts for performance trends)
- Team-based access control and authentication
- Export reports for compliance and auditing
- Slack/Email notifications for critical alerts
- Advanced lineage visualization with interactive graph

## Support

For questions or issues, please refer to:
- Supabase documentation: https://supabase.com/docs
- React documentation: https://react.dev
- Tailwind CSS: https://tailwindcss.com

## License

This project is part of your internal FY26 goals and is for organizational use.
