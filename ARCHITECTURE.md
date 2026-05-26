# Application Architecture

## Overview

This application combines a React frontend with a Python Flask backend to create a full-stack monitoring dashboard for Kafka topics. The architecture is designed for:

- **Reliability**: No timeout issues with external API calls
- **Simplicity**: Easy to deploy and share with your team
- **Familiarity**: Standard web stack (React + Python)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User's Browser                        │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │           React Frontend (TypeScript)              │     │
│  │  - UI Components                                   │     │
│  │  - State Management                                │     │
│  │  - Data Visualization                              │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/HTTPS
                       │ (API Calls)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Python Flask Backend                       │
│  ┌───────────────────────────────────────────────────┐      │
│  │  Flask App (app.py)                               │      │
│  │  - Serves built React app from /dist              │      │
│  │  - API endpoints (/api/*)                         │      │
│  │  - Handles Confluent API calls                    │      │
│  │  - Database operations                            │      │
│  └───────────────────────────────────────────────────┘      │
└──────────────┬────────────────────────┬─────────────────────┘
               │                        │
               │                        │
               ▼                        ▼
┌──────────────────────┐    ┌──────────────────────┐
│   Supabase Database  │    │  Confluent Cloud     │
│   (PostgreSQL)       │    │  (Kafka REST API)    │
│   - Topics           │    │  - Topic Metadata    │
│   - Alerts           │    │  - Configurations    │
│   - Metrics          │    │  - Cluster Info      │
└──────────────────────┘    └──────────────────────┘
```

## Technology Stack

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Styling
- **Lucide React**: Icons

### Backend
- **Python 3.11**: Server runtime
- **Flask**: Web framework
- **gunicorn**: Production WSGI server
- **Requests**: HTTP client for Confluent API
- **python-dotenv**: Environment variable management

### Database
- **Supabase**: PostgreSQL database with REST API
- **supabase-py**: Python client library

### External Integrations
- **Confluent Cloud REST API**: Kafka topic synchronization

## File Structure

```
project/
├── src/                          # React frontend source
│   ├── components/               # React components
│   │   ├── KafkaSync.tsx        # Kafka sync UI
│   │   ├── TopicsOverview.tsx   # Topics list
│   │   └── ...
│   ├── services/                # Data services
│   └── utils/                   # Utility functions
│
├── dist/                         # Built React app (after npm run build)
│   ├── index.html
│   └── assets/
│
├── supabase/                     # Supabase configuration
│   ├── migrations/               # Database schema migrations
│   └── functions/                # (Legacy edge functions - not used)
│
├── app.py                        # Python Flask backend
├── requirements.txt              # Python dependencies
├── package.json                  # Node.js dependencies
├── .env                          # Environment variables (not committed)
│
├── README.md                     # Main documentation
├── PYTHON_DEPLOYMENT.md          # Deployment guide
└── ARCHITECTURE.md               # This file
```

## Data Flow

### 1. Loading the Application

```
User → Browser
Browser → Flask Server (/): Request homepage
Flask Server → Browser: Serve index.html from /dist
Browser → Flask Server (/assets/*): Request JS/CSS bundles
Flask Server → Browser: Serve static assets
React App: Loads and initializes
```

### 2. Viewing Topics

```
User → React: Navigate to "All Topics"
React → Supabase: Query topics table (client-side)
Supabase → React: Return topics data
React → Browser: Render topics list
```

### 3. Syncing Kafka Topics

```
User → React: Click "Sync from Kafka"
React → Flask Backend: POST /api/sync-kafka-topics
Flask Backend → Confluent Cloud: GET /kafka/v3/clusters/{id}/topics
Confluent Cloud → Flask Backend: Return topics data
Flask Backend → Supabase: Upsert topics (via Python client)
Supabase → Flask Backend: Confirm updates
Flask Backend → React: Return sync results
React → Browser: Display success message
```

## API Endpoints

### Backend Endpoints (Python Flask)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves React app |
| `/api/sync-kafka-topics` | POST | Syncs topics from Confluent |
| `/api/health` | GET | Health check |

### Frontend API Calls

The React frontend makes two types of API calls:

1. **To Supabase (direct)**: Using `@supabase/supabase-js` client
   - Reading topics, alerts, metrics
   - Creating/updating/deleting records
   - Real-time subscriptions (if enabled)

2. **To Flask Backend (via fetch)**: For operations requiring API keys
   - Syncing Kafka topics from Confluent
   - Any future integrations requiring secrets

## Development vs Production

### Development Mode

**Two servers running:**
- React dev server on `http://localhost:5173` (Vite)
- Python backend on `http://localhost:5000` (Flask)

React makes API calls to `http://localhost:5000/api/*`

**Advantages:**
- Hot module replacement for React
- Fast development feedback loop
- Separate logs for frontend and backend

### Production Mode

**Single server:**
- Python Flask on configured port (default 5000)
- Serves built React app from `/dist` folder
- Handles API requests at `/api/*`

**Advantages:**
- Simpler deployment
- Single URL for your team
- Lower resource usage

## Environment Variables

### Required for All Environments

```env
# Supabase (used by both Python and React)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Confluent Cloud (used by Python backend)
CONFLUENT_API_KEY=ABCDEFGHIJ123456
CONFLUENT_API_SECRET=xxxxxxxxxxxxx
CONFLUENT_CLUSTER_ID=lkc-xxxxx
CONFLUENT_ENV_ID=env-xxxxx
```

### Optional

```env
# Python server port (default: 5000)
PORT=5000
```

## Security Considerations

### API Key Management
- **Confluent credentials** stored as environment variables
- **Never exposed** to frontend JavaScript
- Python backend handles all authenticated API calls

### Database Security
- Row Level Security (RLS) policies on Supabase tables
- Anon key has limited permissions
- No sensitive data in frontend code

### CORS Configuration
- Flask-CORS enabled for development
- In production, served from same origin (no CORS needed)

## Deployment

### Build Process

1. **Build React app**: `npm run build`
   - Compiles TypeScript to JavaScript
   - Bundles all assets
   - Outputs to `/dist` folder

2. **Install Python dependencies**: `pip install -r requirements.txt`
   - Installs Flask, Supabase client, etc.

3. **Run with gunicorn**: `gunicorn app:app`
   - Production-ready WSGI server
   - Handles concurrent requests
   - Serves both static files and API

### Recommended Platforms

1. **Render**: Free tier, auto-deploys from GitHub
2. **Railway**: Simple setup, good free tier
3. **Heroku**: Classic choice, paid plans

All support Python + Node.js builds natively.

## Scaling Considerations

### Current Architecture (Good for up to ~1000 users)
- Single Python server
- Supabase handles database scaling
- Confluent API calls are infrequent (sync operation)

### Future Scaling Options
1. **Horizontal scaling**: Deploy multiple Python instances with load balancer
2. **Caching**: Add Redis for frequently accessed data
3. **Background jobs**: Move Kafka sync to scheduled jobs (Celery)
4. **CDN**: Serve static assets from CloudFront/Cloudflare
5. **Database optimization**: Add indexes, materialized views

## Why This Architecture?

### Advantages over Edge Functions
- **No timeouts**: Python server has no 30-second limit
- **Better error handling**: Full control over error messages
- **Easier debugging**: Standard Python debugging tools
- **Team familiar**: Most teams know Python/Flask

### Advantages over Pure Frontend
- **API key security**: Credentials never exposed to browser
- **Better performance**: Server-side processing for heavy operations
- **Simpler error handling**: Centralized error logging

### Advantages over Microservices
- **Simplicity**: One codebase, one deployment
- **Lower latency**: No service-to-service calls
- **Easier development**: Run everything locally
- **Cost effective**: Single server instead of multiple services

## Troubleshooting

### Common Issues

**Frontend can't connect to backend in development**
- Make sure Python is running on port 5000
- Check browser console for CORS errors
- Verify `.env` is loaded in both React and Python

**Kafka sync fails**
- Verify Confluent credentials in `.env`
- Check cluster ID is correct
- Look at Python server logs for detailed error

**Deployment fails**
- Ensure `npm run build` completes successfully
- Check all environment variables are set on platform
- Verify Python version is 3.11+

## Next Steps

1. **Set up monitoring**: Add logging (e.g., Sentry)
2. **Add authentication**: Use Supabase Auth
3. **Implement caching**: Cache Confluent API responses
4. **Add tests**: Unit tests for Python, integration tests for API
5. **CI/CD**: Automated testing and deployment via GitHub Actions
