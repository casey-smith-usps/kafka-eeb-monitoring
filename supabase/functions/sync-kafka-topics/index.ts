import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface KafkaTopicInfo {
  name: string;
  partitions: number;
  replicationFactor: number;
  config?: {
    'retention.ms'?: string;
  };
}

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { kafkaAdminUrl, kafkaApiKey, kafkaApiSecret, clusterId, schemaRegistryUrl, schemaRegistryKey, schemaRegistrySecret } = body;

    if (!kafkaAdminUrl) {
      throw new Error('Kafka Admin URL is required');
    }

    if (!clusterId) {
      throw new Error('Cluster ID is required');
    }

    const authHeader = kafkaApiKey && kafkaApiSecret
      ? `Basic ${btoa(`${kafkaApiKey}:${kafkaApiSecret}`)}`
      : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const topicsUrl = `${kafkaAdminUrl}/kafka/v3/clusters/${clusterId}/topics`;
    console.log('Fetching topics from:', topicsUrl);
    console.log('Cluster ID:', clusterId);
    console.log('Request headers:', { ...headers, Authorization: authHeader ? '[REDACTED]' : 'none' });

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    let topicsResponse;
    try {
      topicsResponse = await fetch(topicsUrl, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request to Kafka API timed out after 25 seconds. Check your network connection and credentials.');
      }
      throw new Error(`Failed to connect to Kafka API: ${fetchError.message}`);
    }

    console.log('Response status:', topicsResponse.status);

    if (!topicsResponse.ok) {
      const errorBody = await topicsResponse.text();
      console.error('Kafka API error response:', errorBody);
      throw new Error(`Kafka API error (${topicsResponse.status}): ${errorBody || topicsResponse.statusText}`);
    }

    const topicsData = await topicsResponse.json();
    const topics: KafkaTopicInfo[] = topicsData.data || [];

    const results = {
      synced: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const topic of topics) {
      try {
        const { data: existingTopic } = await supabase
          .from('topics')
          .select('id, partition_count, replication_factor')
          .eq('name', topic.name)
          .maybeSingle();

        const retentionMs = topic.config?.['retention.ms']
          ? parseInt(topic.config['retention.ms'])
          : null;

        let schemaData: any = null;
        let schemaVersion: number | null = null;
        let schemaUrl: string | null = null;

        if (schemaRegistryUrl) {
          try {
            const schemaSubject = `${topic.name}-value`;
            const schemaAuthHeader = schemaRegistryKey && schemaRegistrySecret
              ? `Basic ${btoa(`${schemaRegistryKey}:${schemaRegistrySecret}`)}`
              : undefined;

            const schemaHeaders: Record<string, string> = {};
            if (schemaAuthHeader) {
              schemaHeaders['Authorization'] = schemaAuthHeader;
            }

            const schemaResponse = await fetch(
              `${schemaRegistryUrl}/subjects/${schemaSubject}/versions/latest`,
              { headers: schemaHeaders }
            );

            if (schemaResponse.ok) {
              const schemaJson = await schemaResponse.json();
              schemaData = typeof schemaJson.schema === 'string' ? JSON.parse(schemaJson.schema) : schemaJson.schema;
              schemaVersion = schemaJson.version;
              schemaUrl = `${schemaRegistryUrl}/subjects/${schemaSubject}`;
            }
          } catch (schemaError) {
            console.error(`Failed to fetch schema for ${topic.name}:`, schemaError);
          }
        }

        if (existingTopic) {
          const updateData: any = {
            partition_count: topic.partitions,
            replication_factor: topic.replicationFactor,
            retention_ms: retentionMs,
            updated_at: new Date().toISOString(),
          };

          if (schemaData) {
            updateData.latest_schema = schemaData;
            updateData.schema_version = schemaVersion;
            updateData.schema_registry_url = schemaUrl;
            updateData.schema_last_synced = new Date().toISOString();
          }

          await supabase
            .from('topics')
            .update(updateData)
            .eq('id', existingTopic.id);
          results.updated++;
        } else {
          const insertData: any = {
            name: topic.name,
            partition_count: topic.partitions,
            replication_factor: topic.replicationFactor,
            retention_ms: retentionMs,
            status: 'in_progress',
          };

          if (schemaData) {
            insertData.latest_schema = schemaData;
            insertData.schema_version = schemaVersion;
            insertData.schema_registry_url = schemaUrl;
            insertData.schema_last_synced = new Date().toISOString();
          }

          const { data: newTopic, error } = await supabase
            .from('topics')
            .insert(insertData)
            .select()
            .single();

          if (error) throw error;

          const namingPattern = /^(dev|sit|cat|prod)\./;
          if (!namingPattern.test(topic.name)) {
            await supabase.from('alerts').insert({
              topic_id: newTopic.id,
              alert_type: 'naming_violation',
              severity: 'medium',
              title: 'New topic detected with naming issues',
              description: `Topic "${topic.name}" does not follow naming convention`,
            });
          }

          results.synced++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${topic.name}: ${error.message}`);
      }
    }

    const { data: allTopics } = await supabase
      .from('performance_metrics')
      .select('topic_id')
      .order('timestamp', { ascending: false })
      .limit(100);

    const consumerLagData = allTopics || [];
    const avgLag = consumerLagData.length > 0
      ? consumerLagData.reduce((sum: number, m: any) => sum + (m.consumer_lag || 0), 0) / consumerLagData.length
      : 0;

    return new Response(
      JSON.stringify({
        success: true,
        results,
        stats: {
          totalTopics: topics.length,
          averageConsumerLag: Math.round(avgLag),
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Kafka sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
