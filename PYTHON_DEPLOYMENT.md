# Python Backend Deployment Guide

This project uses a Python Flask backend to serve the React frontend and handle API calls (like Confluent Kafka sync).

## Architecture

- **Frontend**: React + Vite + TypeScript (in `src/`)
- **Backend**: Python Flask (in `app.py`)
- **Database**: Supabase PostgreSQL
- **API**: Python handles all external API calls (Confluent, etc.)

## Running Locally (Development)

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up Environment Variables

Make sure your `.env` file has all required variables:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Confluent Cloud
CONFLUENT_API_KEY=your_api_key
CONFLUENT_API_SECRET=your_api_secret
CONFLUENT_CLUSTER_ID=lkc-xxxxx
CONFLUENT_ENV_ID=env-xxxxx
```

### 3. Run Frontend (React Dev Server)

In one terminal:

```bash
npm run dev
```

This runs on `http://localhost:5173`

### 4. Run Backend (Python)

In another terminal:

```bash
python app.py
```

This runs on `http://localhost:5000`

The React app will automatically call the Python backend for API requests.

## Building for Production

### 1. Build the React App

```bash
npm run build
```

This creates the `dist/` folder with your compiled frontend.

### 2. Run Production Server

```bash
python app.py
```

The Python server will:
- Serve the built React app from `dist/`
- Handle all API requests at `/api/*`

Access at: `http://localhost:5000`

## Deploying to Production

### Option 1: Render (Recommended)

1. Push your code to GitHub
2. Go to [Render.com](https://render.com)
3. Create new "Web Service"
4. Connect your GitHub repo
5. Configure:
   - **Build Command**: `npm install && npm run build && pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Environment Variables**: Add all your `.env` variables
6. Deploy

Your team accesses it via: `https://your-app.onrender.com`

### Option 2: Railway

1. Push to GitHub
2. Go to [Railway.app](https://railway.app)
3. Create new project from GitHub
4. Configure:
   - **Build Command**: `npm install && npm run build && pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Environment Variables**: Add all your `.env` variables
5. Deploy

### Option 3: Heroku

1. Install Heroku CLI
2. Create `Procfile`:
   ```
   web: gunicorn app:app
   ```
3. Create `runtime.txt`:
   ```
   python-3.11
   ```
4. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set VITE_SUPABASE_URL=...
   heroku config:set VITE_SUPABASE_ANON_KEY=...
   # Add all other env vars
   git push heroku main
   ```

## Why Python Backend?

- **No Edge Function Timeouts**: Python server has no 30-second timeout limits
- **Better Error Handling**: Full control over error messages and logging
- **Easier Debugging**: Standard Python debugging tools
- **Team Familiar**: Most teams know Python/Flask
- **Simple Deployment**: One command to deploy both frontend and backend
- **Shared by URL**: Deploy once, whole team uses the same URL

## API Endpoints

- `GET /` - Serves React frontend
- `POST /api/sync-kafka-topics` - Syncs topics from Confluent Cloud
- `GET /api/health` - Health check endpoint

## Troubleshooting

### Frontend can't connect to backend in development

Make sure Python is running on port 5000. The React app is configured to call `http://localhost:5000` in development.

### Production deployment fails

Check that:
1. `npm run build` completes successfully
2. All environment variables are set
3. `requirements.txt` has all dependencies

### Kafka sync fails

Check that:
1. Confluent credentials are correct in `.env`
2. Cluster ID is correct (e.g., `lkc-xxxxx`)
3. Python backend is running and accessible
