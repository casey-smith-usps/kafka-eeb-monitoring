#!/bin/bash

# Test with corrected URL (without port)
echo "🔄 Testing Kafka Sync with corrected URL..."
echo ""

SUPABASE_URL="https://dowixaqpokruwwqcykzo.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd2l4YXFwb2tydXd3cWN5a3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDMwMTYsImV4cCI6MjA4NTI3OTAxNn0.L5g60FLYwAZ9IRJXDN2U6sLJHrNnF_PtHQNP5cxV0oc"

# Try without the :443 port
KAFKA_URL="https://lkc-33v902.dom4gl8rd6w.eastus.azure.confluent.cloud"
CLUSTER_ID="lkc-33v902"
API_KEY="XW3T6QRAT4VPGPUO"
API_SECRET="cfltvsREZFEb2Nleb17TvjSzNHZYD723W8fPIC2qBqlRKQ1Gg0EjJ7vXJaLz7mmA"

echo "📡 Testing direct Kafka REST API first..."
echo "   URL: https://api.confluent.cloud/kafka/v3/clusters/${CLUSTER_ID}/topics"
echo ""

# Test direct Kafka API call
kafka_response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -u "${API_KEY}:${API_SECRET}" \
    "https://api.confluent.cloud/kafka/v3/clusters/${CLUSTER_ID}/topics" \
    -H "Content-Type: application/json" | grep -v "HTTP_STATUS")

http_code=$(curl -s -w "%{http_code}" -u "${API_KEY}:${API_SECRET}" \
    "https://api.confluent.cloud/kafka/v3/clusters/${CLUSTER_ID}/topics" \
    -H "Content-Type: application/json" -o /dev/null)

echo "HTTP Status: $http_code"

if [ "$http_code" == "200" ]; then
    echo "✅ Direct Kafka API connection successful!"
    echo ""
    topics_count=$(echo "$kafka_response" | jq '.data | length' 2>/dev/null || echo "0")
    echo "   Found $topics_count topics in Kafka"
    echo ""

    echo "📡 Now testing Supabase Edge Function..."
    response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/sync-kafka-topics" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
        -d "{
            \"kafkaAdminUrl\": \"https://api.confluent.cloud\",
            \"clusterId\": \"${CLUSTER_ID}\",
            \"kafkaApiKey\": \"${API_KEY}\",
            \"kafkaApiSecret\": \"${API_SECRET}\"
        }")

    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""

    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        synced=$(echo "$response" | jq -r '.results.synced // 0')
        updated=$(echo "$response" | jq -r '.results.updated // 0')
        failed=$(echo "$response" | jq -r '.results.failed // 0')

        echo "✅ Sync completed successfully!"
        echo "   🆕 New: $synced | 🔄 Updated: $updated | ❌ Failed: $failed"
    else
        echo "❌ Edge function sync failed"
    fi
else
    echo "❌ Direct Kafka API connection failed!"
    echo "   Status: $http_code"
    echo "   Response: $kafka_response"
    echo ""
    echo "Possible issues:"
    echo "   1. Invalid API credentials"
    echo "   2. Wrong cluster ID"
    echo "   3. Network restrictions"
fi
