#!/bin/bash

# Test the Python Flask backend

echo "🧪 Testing Python Backend..."
echo ""

# Check if Flask is running
echo "1️⃣ Checking if Flask is running on port 5000..."
if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Flask is running!"
    echo ""

    # Test health endpoint
    echo "2️⃣ Testing /api/health endpoint..."
    curl -s http://localhost:5000/api/health | python3 -m json.tool
    echo ""

    # Test sync endpoint
    echo "3️⃣ Testing /api/sync-kafka-topics endpoint..."
    curl -s -X POST http://localhost:5000/api/sync-kafka-topics | python3 -m json.tool
    echo ""
else
    echo "❌ Flask is NOT running on port 5000"
    echo ""
    echo "To start the Flask backend, run:"
    echo "  python3 app.py"
    echo ""
    echo "Make sure you have dependencies installed:"
    echo "  pip3 install flask flask-cors requests supabase python-dotenv"
fi
