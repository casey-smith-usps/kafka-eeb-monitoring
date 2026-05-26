#!/bin/bash

echo "🔍 Verifying Confluent Cloud Configuration..."
echo ""

API_KEY="XW3T6QRAT4VPGPUO"
API_SECRET="cfltvsREZFEb2Nleb17TvjSzNHZYD723W8fPIC2qBqlRKQ1Gg0EjJ7vXJaLz7mmA"

echo "Step 1: Testing API credentials..."
echo "================================================"

# Test if credentials work by listing environments
env_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -u "${API_KEY}:${API_SECRET}" \
    "https://api.confluent.cloud/org/v2/environments" \
    -H "Content-Type: application/json")

http_code=$(echo "$env_response" | grep "HTTP_CODE:" | cut -d':' -f2)
env_data=$(echo "$env_response" | grep -v "HTTP_CODE:")

echo "HTTP Status: $http_code"

if [ "$http_code" == "200" ]; then
    echo "✅ API credentials are valid!"
    echo ""
    echo "Environments found:"
    echo "$env_data" | jq -r '.data[] | "  - \(.display_name) (ID: \(.id))"' 2>/dev/null || echo "$env_data"
    echo ""

    # Get the first environment ID
    ENV_ID=$(echo "$env_data" | jq -r '.data[0].id' 2>/dev/null)

    if [ ! -z "$ENV_ID" ] && [ "$ENV_ID" != "null" ]; then
        echo "Step 2: Listing clusters in environment $ENV_ID..."
        echo "================================================"

        clusters_response=$(curl -s -u "${API_KEY}:${API_SECRET}" \
            "https://api.confluent.cloud/cmk/v2/clusters?environment=$ENV_ID" \
            -H "Content-Type: application/json")

        echo "$clusters_response" | jq '.' 2>/dev/null || echo "$clusters_response"
        echo ""

        cluster_count=$(echo "$clusters_response" | jq '.data | length' 2>/dev/null || echo "0")
        echo "Found $cluster_count cluster(s)"
        echo ""

        if [ "$cluster_count" != "0" ]; then
            echo "Cluster details:"
            echo "$clusters_response" | jq -r '.data[] | "  Name: \(.spec.display_name)\n  ID: \(.id)\n  Bootstrap: \(.spec.kafka_bootstrap_endpoint)\n  REST Endpoint: \(.spec.http_endpoint)\n"' 2>/dev/null
        fi
    fi
else
    echo "❌ API credentials are invalid!"
    echo "Response: $env_data"
fi

echo ""
echo "================================================"
echo "Next steps:"
echo "  1. Verify your cluster ID from Confluent Cloud UI"
echo "  2. Go to: https://confluent.cloud/environments"
echo "  3. Select your cluster"
echo "  4. Copy the Cluster ID (should start with 'lkc-')"
echo "  5. Update your .env file with the correct ID"
