const { app } = require('@azure/functions');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

app.http('kafka-sync', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return {
                status: 200,
                headers: corsHeaders,
            };
        }

        try {
            const credential = new DefaultAzureCredential();
            const vaultName = process.env.KEY_VAULT_NAME;
            const url = `https://${vaultName}.vault.azure.net`;
            const client = new SecretClient(url, credential);

            const confluentApiKey = await client.getSecret('CONFLUENT-API-KEY');
            const confluentApiSecret = await client.getSecret('CONFLUENT-API-SECRET');
            const supabaseUrl = await client.getSecret('SUPABASE-URL');
            const supabaseKey = await client.getSecret('SUPABASE-SERVICE-ROLE-KEY');

            const clusterIds = [
                'lkc-abcde1',
                'lkc-abcde2',
                'lkc-abcde3',
                'lkc-abcde4',
            ];

            const auth = Buffer.from(
                `${confluentApiKey.value}:${confluentApiSecret.value}`
            ).toString('base64');

            const allTopics = [];

            for (const clusterId of clusterIds) {
                try {
                    const response = await fetch(
                        `https://api.confluent.cloud/kafka/v3/clusters/${clusterId}/topics`,
                        {
                            headers: {
                                Authorization: `Basic ${auth}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    if (!response.ok) {
                        context.warn(`Failed to fetch topics for cluster ${clusterId}: ${response.statusText}`);
                        continue;
                    }

                    const data = await response.json();
                    const topics = data.data || [];

                    for (const topic of topics) {
                        if (!topic.topic_name.startsWith('_confluent') &&
                            !topic.topic_name.startsWith('__confluent')) {
                            allTopics.push({
                                topic_name: topic.topic_name,
                                cluster_id: clusterId,
                                is_internal: topic.is_internal || false,
                                partitions_count: topic.partitions_count || 0,
                                replication_factor: topic.replication_factor || 0,
                            });
                        }
                    }
                } catch (error) {
                    context.error(`Error fetching topics for cluster ${clusterId}:`, error);
                }
            }

            const supabaseResponse = await fetch(`${supabaseUrl.value}/rest/v1/topics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey.value,
                    'Authorization': `Bearer ${supabaseKey.value}`,
                    'Prefer': 'resolution=merge-duplicates',
                },
                body: JSON.stringify(allTopics),
            });

            if (!supabaseResponse.ok) {
                const errorText = await supabaseResponse.text();
                throw new Error(`Supabase insert failed: ${errorText}`);
            }

            context.log(`Successfully synced ${allTopics.length} topics`);

            return {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    topicsSynced: allTopics.length,
                    timestamp: new Date().toISOString(),
                }),
            };
        } catch (error) {
            context.error('Error in kafka-sync:', error);
            return {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: error.message,
                }),
            };
        }
    }
});
