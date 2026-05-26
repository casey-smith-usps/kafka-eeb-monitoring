#!/bin/bash

# Test Kafka Sync via Edge Function
echo "🔄 Testing Kafka Sync Edge Function..."
echo ""

SUPABASE_URL="https://dowixaqpokruwwqcykzo.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd2l4YXFwb2tydXd3cWN5a3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDMwMTYsImV4cCI6MjA4NTI3OTAxNn0.L5g60FLYwAZ9IRJXDN2U6sLJHrNnF_PtHQNP5cxV0oc"

KAFKA_URL="https://lkc-33v902.dom4gl8rd6w.eastus.azure.confluent.cloud:443"
CLUSTER_ID="lkc-33v902"
API_KEY="XW3T6QRAT4VPGPUO"
API_SECRET="cfltvsREZFEb2Nleb17TvjSzNHZYD723W8fPIC2qBqlRKQ1Gg0EjJ7vXJaLz7mmA"

echo "📡 Calling Supabase Edge Function..."
echo "   URL: ${SUPABASE_URL}/functions/v1/sync-kafka-topics"
echo ""

response=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/sync-kafka-topics" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -d "{
        \"kafkaAdminUrl\": \"${KAFKA_URL}\",
        \"clusterId\": \"${CLUSTER_ID}\",
        \"kafkaApiKey\": \"${API_KEY}\",
        \"kafkaApiSecret\": \"${API_SECRET}\"
    }")

echo "📥 Response:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"
echo ""

# Parse results
if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
    synced=$(echo "$response" | jq -r '.results.synced // 0')
    updated=$(echo "$response" | jq -r '.results.updated // 0')
    failed=$(echo "$response" | jq -r '.results.failed // 0')
    total=$(echo "$response" | jq -r '.stats.totalTopics // 0')

    echo "✅ Sync completed successfully!"
    echo ""
    echo "📊 Results:"
    echo "   🆕 New topics synced: $synced"
    echo "   🔄 Existing topics updated: $updated"
    echo "   ❌ Failed: $failed"
    echo "   📈 Total topics in Kafka: $total"
else
    echo "❌ Sync failed!"
    error=$(echo "$response" | jq -r '.error // "Unknown error"')
    echo "   Error: $error"
fi
