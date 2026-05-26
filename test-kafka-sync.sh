#!/bin/bash

# Test Kafka Sync Endpoint
# This script tests the Kafka sync functionality

echo "🔄 Testing Kafka Sync..."
echo ""

# Check if Python backend is running
if ! curl -s http://localhost:5000/api/health > /dev/null; then
    echo "❌ Python backend is not running!"
    echo "Please start it first with: python app.py"
    exit 1
fi

echo "✅ Python backend is running"
echo ""

# Test the sync endpoint
echo "📡 Calling sync endpoint..."
response=$(curl -s -X POST http://localhost:5000/api/sync-kafka-topics \
    -H "Content-Type: application/json")

echo "Response:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo ""

# Check if successful
if echo "$response" | grep -q '"success": true'; then
    echo "✅ Sync completed successfully!"

    # Extract stats
    synced=$(echo "$response" | jq -r '.synced_count // 0')
    total=$(echo "$response" | jq -r '.total_topics // 0')

    echo "📊 Stats:"
    echo "  - Topics synced: $synced"
    echo "  - Total topics: $total"
else
    echo "❌ Sync failed!"
    echo "$response" | jq -r '.error // .details // "Unknown error"'
fi
