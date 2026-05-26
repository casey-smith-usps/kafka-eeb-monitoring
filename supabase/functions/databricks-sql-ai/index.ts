import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DATABRICKS_HOST = Deno.env.get('DATABRICKS_HOST')?.trim();
const DATABRICKS_TOKEN = Deno.env.get('DATABRICKS_TOKEN')?.trim();
const DATABRICKS_SQL_WAREHOUSE_ID = Deno.env.get('DATABRICKS_SQL_WAREHOUSE_ID')?.trim();

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

// Serverless SQL Warehouse cost estimation
// ~0.002 DBU per 3-second query × $0.22/DBU = $0.00044
function estimateCost(promptTokens: number, completionTokens: number): number {
  return 0.00044;
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
    const estimatedCost = estimateCost(promptTokens, completionTokens);

    await supabase.from('ai_usage_log').insert({
      user_id: userId || 'anonymous',
      endpoint_name: 'databricks-sql-serverless',
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
  }
}

async function executeStatement(warehouseId: string, sqlStatement: string): Promise<any> {
  const url = `${DATABRICKS_HOST}/api/2.0/sql/statements`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      warehouse_id: warehouseId,
      statement: sqlStatement,
      wait_timeout: '30s',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Databricks SQL API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!DATABRICKS_HOST || !DATABRICKS_TOKEN || !DATABRICKS_SQL_WAREHOUSE_ID) {
      throw new Error('Databricks SQL configuration missing. Required: DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_SQL_WAREHOUSE_ID');
    }

    const { messages, max_tokens = 2000, user_id, request_type }: RequestBody = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Invalid request: messages array is required');
    }

    // Build the conversation context
    const systemMessage = messages.find(m => m.role === 'system')?.content ||
      'You are a helpful AI assistant for the Enterprise Event Bus platform.';
    const conversationHistory = messages.filter(m => m.role !== 'system');
    const userQuestion = conversationHistory[conversationHistory.length - 1]?.content || '';

    // Build context from conversation history
    const context = conversationHistory.slice(0, -1)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    // Construct SQL query using ai_query function
    const prompt = context
      ? `${systemMessage}\n\nConversation History:\n${context}\n\nUser: ${userQuestion}`
      : `${systemMessage}\n\nUser: ${userQuestion}`;

    const sqlStatement = `SELECT ai_query('databricks-meta-llama-3-3-70b-instruct', '${prompt.replace(/'/g, "''")}')`;

    console.log('Executing SQL AI query...');
    console.log('SQL Statement:', sqlStatement);
    const result = await executeStatement(DATABRICKS_SQL_WAREHOUSE_ID, sqlStatement);
    console.log('Query result:', JSON.stringify(result, null, 2));

    // Extract response from result
    let aiResponse = '';
    if (result.result?.data_array && result.result.data_array.length > 0) {
      aiResponse = result.result.data_array[0][0] || '';
    }

    if (!aiResponse) {
      console.error('No response in result:', result);
      throw new Error('No response from AI query');
    }

    // Estimate token usage
    const promptTokens = Math.round(prompt.length / 4);
    const completionTokens = Math.round(aiResponse.length / 4);
    const totalTokens = promptTokens + completionTokens;

    await logUsage(user_id, promptTokens, completionTokens, totalTokens, request_type || 'chat', true);

    // Format response to match OpenAI-style format
    const response = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: aiResponse,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in databricks-sql-ai function:', error);

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
