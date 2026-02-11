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

    const {
      admin_url: kafkaAdminUrl,
      api_key: kafkaApiKey,
      api_secret: kafkaApiSecret,
      cluster_id: clusterId,
      cloud_provider: cloudProvider,
      cluster_name: clusterName
    } = body;

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
        // Check for existing topic by BOTH name AND cluster_id to prevent duplicates
        const { data: existingTopic } = await supabase
          .from('topics')
          .select('id, partition_count, replication_factor')
          .eq('name', topic.name)
          .eq('cluster_id', clusterId)
          .maybeSingle();

        const retentionMs = topic.config?.['retention.ms']
          ? parseInt(topic.config['retention.ms'])
          : null;

        if (existingTopic) {
          // Update existing topic with latest data
          await supabase
            .from('topics')
            .update({
              partition_count: topic.partitions,
              replication_factor: topic.replicationFactor,
              retention_ms: retentionMs,
              cloud_provider: cloudProvider || null,
              cluster_name: clusterName || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingTopic.id);
          results.updated++;
        } else {
          // Create new topic with cluster_id
          const { data: newTopic, error } = await supabase
            .from('topics')
            .insert({
              name: topic.name,
              partition_count: topic.partitions,
              replication_factor: topic.replicationFactor,
              retention_ms: retentionMs,
              status: 'in_progress',
              cloud_provider: cloudProvider || null,
              cluster_name: clusterName || null,
              cluster_id: clusterId,
            })
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
