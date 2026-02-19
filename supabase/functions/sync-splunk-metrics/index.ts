import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SplunkEvent {
  _time: string;
  topic_name?: string;
  consumer_lag?: number;
  messages_per_second?: number;
  bytes_per_second?: number;
  error_rate?: number;
  partition_metrics?: any;
  [key: string]: any;
}

interface SplunkSearchResult {
  results: SplunkEvent[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { splunkHost, splunkToken, searchQuery } = await req.json();

    if (!splunkHost || !splunkToken) {
      return new Response(
        JSON.stringify({ error: 'Splunk host and token are required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default search query for Kafka performance metrics
    const query = searchQuery || `search index=kafka earliest=-15m latest=now
      | stats avg(consumer_lag) as consumer_lag,
              avg(messages_per_second) as messages_per_second,
              avg(bytes_per_second) as bytes_per_second,
              avg(error_rate) as error_rate
        by topic_name, _time
      | sort - _time`;

    // Create a Splunk search job
    const searchUrl = `${splunkHost}/services/search/jobs`;

    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${splunkToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        search: query,
        output_mode: 'json',
        earliest_time: '-15m',
        latest_time: 'now',
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      return new Response(
        JSON.stringify({
          error: 'Failed to create Splunk search job',
          details: errorText
        }),
        { status: searchResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchData = await searchResponse.json();
    const searchId = searchData.sid;

    // Poll for search completion
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!isComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await fetch(
        `${splunkHost}/services/search/jobs/${searchId}?output_mode=json`,
        {
          headers: {
            'Authorization': `Bearer ${splunkToken}`,
          },
        }
      );

      const statusData = await statusResponse.json();
      isComplete = statusData.entry[0].content.isDone;
      attempts++;
    }

    if (!isComplete) {
      return new Response(
        JSON.stringify({ error: 'Search job timed out' }),
        { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get search results
    const resultsResponse = await fetch(
      `${splunkHost}/services/search/jobs/${searchId}/results?output_mode=json&count=1000`,
      {
        headers: {
          'Authorization': `Bearer ${splunkToken}`,
        },
      }
    );

    const resultsData: SplunkSearchResult = await resultsResponse.json();
    const events = resultsData.results || [];

    const processedMetrics = [];
    const errors = [];

    // Process each event and insert into database
    for (const event of events) {
      const topicName = event.topic_name;

      if (!topicName) {
        continue;
      }

      // Find the topic in our database
      const { data: topic } = await supabase
        .from('topics')
        .select('id')
        .eq('name', topicName)
        .maybeSingle();

      if (!topic) {
        errors.push({ topic: topicName, error: 'Topic not found in database' });
        continue;
      }

      // Insert performance metric
      const { error } = await supabase
        .from('performance_metrics')
        .insert({
          topic_id: topic.id,
          consumer_lag: event.consumer_lag ? parseInt(event.consumer_lag) : null,
          messages_per_second: event.messages_per_second ? parseFloat(event.messages_per_second) : null,
          bytes_per_second: event.bytes_per_second ? parseFloat(event.bytes_per_second) : null,
          error_rate: event.error_rate ? parseFloat(event.error_rate) : null,
          partition_metrics: event.partition_metrics || null,
          timestamp: new Date(event._time).toISOString(),
        });

      if (error) {
        errors.push({ topic: topicName, error: error.message });
      } else {
        processedMetrics.push({ topic: topicName, timestamp: event._time });

        // Create alerts for performance issues
        const errorRate = event.error_rate ? parseFloat(event.error_rate) : 0;
        const consumerLag = event.consumer_lag ? parseInt(event.consumer_lag) : 0;

        if (errorRate > 5) {
          await supabase.from('alerts').insert({
            topic_id: topic.id,
            alert_type: 'performance_degradation',
            severity: errorRate > 10 ? 'critical' : 'high',
            title: `High error rate on ${topicName}`,
            description: `Error rate: ${errorRate}%`,
            resolved: false,
          });
        }

        if (consumerLag > 10000) {
          await supabase.from('alerts').insert({
            topic_id: topic.id,
            alert_type: 'performance_degradation',
            severity: consumerLag > 50000 ? 'critical' : 'high',
            title: `High consumer lag on ${topicName}`,
            description: `Consumer lag: ${consumerLag} messages`,
            resolved: false,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedMetrics.length,
        metrics: processedMetrics,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error syncing Splunk metrics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
