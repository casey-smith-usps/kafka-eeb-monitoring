import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DATABRICKS_HOST = Deno.env.get('DATABRICKS_HOST')?.trim();
const DATABRICKS_TOKEN = Deno.env.get('DATABRICKS_TOKEN')?.trim();
const DATABRICKS_ENDPOINT_NAME = Deno.env.get('DATABRICKS_ENDPOINT_NAME')?.trim();

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  user_id?: string;
  request_type?: string;
}

// Estimate cost based on endpoint type and token usage
// NOTE: These are estimates - actual costs depend on your endpoint configuration
function estimateCost(promptTokens: number, completionTokens: number, endpointType: string = 'provisioned'): number {
  const totalTokens = promptTokens + completionTokens;

  if (endpointType === 'serverless-sql') {
    // SQL AI Functions on Serverless SQL Warehouse
    // ~0.002 DBU per 3-second query × $0.22/DBU = $0.00044
    return 0.00044;
  } else if (endpointType === 'serverless-model') {
    // Serverless Model Serving (token-based)
    // Approximate: $2 per million tokens
    return (totalTokens / 1_000_000) * 2.0;
  } else {
    // Provisioned endpoint - fixed cost regardless of usage
    // $144/day ÷ 1440 min/day = $0.10/min × 0.5 min = $0.05/request
    return 0.05;
  }
}

// Detect endpoint type from environment or response
function detectEndpointType(): string {
  const endpointName = DATABRICKS_ENDPOINT_NAME?.toLowerCase() || '';
  if (endpointName.includes('serverless') || endpointName.includes('sql')) {
    return 'serverless-sql';
  }
  // Default to provisioned if unknown
  return 'provisioned';
}

async function logUsage(
  userId: string | undefined,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  requestType: string,
  success: boolean,
  errorMessage?: string
) {
  try {
    const endpointType = detectEndpointType();
    const estimatedCost = estimateCost(promptTokens, completionTokens, endpointType);

    await supabase.from('ai_usage_log').insert({
      user_id: userId || 'anonymous',
      endpoint_name: DATABRICKS_ENDPOINT_NAME || 'databricks-ai',
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
      request_type: requestType || 'chat',
      success,
      error_message: errorMessage,
    });
  } catch (error) {
    console.error('Failed to log AI usage:', error);
    // Don't throw - logging failure shouldn't break the request
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!DATABRICKS_HOST || !DATABRICKS_TOKEN || !DATABRICKS_ENDPOINT_NAME) {
      throw new Error('Databricks configuration missing in environment variables');
    }

    const { messages, max_tokens = 2000, temperature = 0.7, user_id, request_type }: RequestBody = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Invalid request: messages array is required');
    }

    // Use the foundation model API endpoint format
    const databricksUrl = `${DATABRICKS_HOST}/serving-endpoints/${DATABRICKS_ENDPOINT_NAME}/invocations`;

    console.log('Constructed Databricks URL:', databricksUrl);
    console.log('DATABRICKS_HOST:', DATABRICKS_HOST);
    console.log('DATABRICKS_ENDPOINT_NAME:', DATABRICKS_ENDPOINT_NAME);

    const response = await fetch(databricksUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
      },
      body: JSON.stringify({
        messages,
        max_tokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Databricks API error:', response.status, errorText);

      // Log failed request
      const promptTokens = messages.reduce((sum, msg) => sum + msg.content.length / 4, 0);
      await logUsage(user_id, Math.round(promptTokens), 0, Math.round(promptTokens), request_type || 'chat', false, errorText);

      // Check for rate limiting error
      if (response.status === 429 || (response.status === 403 && errorText.includes('rate limit'))) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        throw new Error(`RATE_LIMIT: Please wait ${retryAfter} seconds before trying again. Your Databricks endpoint has a very low rate limit (5 per minute). Increase it in Databricks: Serving → Endpoints → [Your Endpoint] → Rate Limits.`);
      }

      throw new Error(`Databricks API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Log successful request with actual token usage
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || Math.round(messages.reduce((sum, msg) => sum + msg.content.length / 4, 0));
    const completionTokens = usage.completion_tokens || Math.round(data.choices?.[0]?.message?.content?.length / 4 || 0);
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;

    await logUsage(user_id, promptTokens, completionTokens, totalTokens, request_type || 'chat', true);

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in databricks-ai function:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
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
