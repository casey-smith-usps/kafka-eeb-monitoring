const { app } = require('@azure/functions');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

app.http('databricks-ai', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'function',
    handler: async (request, context) => {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

            const databricksHost = await client.getSecret('DATABRICKS-HOST');
            const databricksToken = await client.getSecret('DATABRICKS-TOKEN');
            const supabaseUrl = await client.getSecret('SUPABASE-URL');
            const supabaseKey = await client.getSecret('SUPABASE-SERVICE-ROLE-KEY');

            const body = await request.json();
            const { query, context: queryContext } = body;

            if (!query) {
                return {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Query is required' }),
                };
            }

            const aiPrompt = `You are a Kafka topic monitoring assistant.
Context: ${queryContext || 'General question about Kafka topics'}
Question: ${query}

Provide a helpful, concise answer based on the Kafka monitoring data available.`;

            const aiResponse = await fetch(
                `${databricksHost.value}/api/2.0/serving-endpoints/databricks-meta-llama-3-1-70b-instruct/invocations`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${databricksToken.value}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a helpful Kafka monitoring assistant.',
                            },
                            {
                                role: 'user',
                                content: aiPrompt,
                            },
                        ],
                        max_tokens: 1000,
                        temperature: 0.7,
                    }),
                }
            );

            if (!aiResponse.ok) {
                const errorText = await aiResponse.text();
                throw new Error(`Databricks AI error: ${errorText}`);
            }

            const aiData = await aiResponse.json();
            const answer = aiData.choices?.[0]?.message?.content || 'No response generated';

            const tokensUsed = aiData.usage?.total_tokens || 0;

            await fetch(`${supabaseUrl.value}/rest/v1/ai_usage_log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey.value,
                    'Authorization': `Bearer ${supabaseKey.value}`,
                },
                body: JSON.stringify({
                    query,
                    response: answer,
                    tokens_used: tokensUsed,
                    model: 'databricks-meta-llama-3-1-70b-instruct',
                }),
            });

            context.log(`AI query processed. Tokens used: ${tokensUsed}`);

            return {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answer,
                    tokensUsed,
                }),
            };
        } catch (error) {
            context.error('Error in databricks-ai:', error);
            return {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: error.message,
                }),
            };
        }
    }
});
