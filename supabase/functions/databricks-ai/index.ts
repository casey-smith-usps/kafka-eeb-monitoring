import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DATABRICKS_HOST = Deno.env.get('DATABRICKS_HOST');
const DATABRICKS_TOKEN = Deno.env.get('DATABRICKS_TOKEN');
const DATABRICKS_ENDPOINT = Deno.env.get('DATABRICKS_ENDPOINT');

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!DATABRICKS_HOST || !DATABRICKS_TOKEN || !DATABRICKS_ENDPOINT) {
      throw new Error('Databricks configuration missing in environment variables');
    }

    const { messages, max_tokens = 2000, temperature = 0.7 }: RequestBody = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Invalid request: messages array is required');
    }

    const databricksUrl = `${DATABRICKS_HOST}/serving-endpoints/${DATABRICKS_ENDPOINT}/invocations`;

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
      throw new Error(`Databricks API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

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
