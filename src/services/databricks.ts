interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface DatabricksResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class DatabricksClient {
  private edgeFunctionUrl: string;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase configuration missing. Please check your .env file.');
    }

    this.edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/databricks-ai`;
  }

  async chat(messages: Message[], maxTokens: number = 2000): Promise<string> {
    try {
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      const data: DatabricksResponse = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from AI model');
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling AI:', error);
      throw error;
    }
  }

  async analyzeIncident(incidentData: {
    title: string;
    description?: string;
    severity?: string;
    status?: string;
  }): Promise<string> {
    const systemPrompt = `You are an expert incident management assistant. Analyze incidents and provide:
1. Root cause analysis
2. Recommended actions
3. Similar past incidents
4. Priority assessment
Be concise and actionable.`;

    const userPrompt = `Analyze this incident:
Title: ${incidentData.title}
${incidentData.description ? `Description: ${incidentData.description}` : ''}
${incidentData.severity ? `Severity: ${incidentData.severity}` : ''}
${incidentData.status ? `Status: ${incidentData.status}` : ''}`;

    return this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }

  async suggestTopicName(context: {
    description?: string;
    domain?: string;
    dataType?: string;
  }): Promise<string> {
    const systemPrompt = `You are a Kafka topic naming expert. Generate topic names following conventions:
- Use kebab-case
- Include: domain.source.entity.version
- Be descriptive but concise`;

    const userPrompt = `Suggest a Kafka topic name for:
${context.description ? `Description: ${context.description}` : ''}
${context.domain ? `Domain: ${context.domain}` : ''}
${context.dataType ? `Data Type: ${context.dataType}` : ''}

Provide only the topic name, no explanation.`;

    return this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }

  async answerQuestion(question: string, context?: string): Promise<string> {
    const messages: Message[] = [];

    if (context) {
      messages.push({
        role: 'system',
        content: `You are a helpful assistant for a Kafka monitoring and incident management system. Use this context to answer questions:\n\n${context}`,
      });
    }

    messages.push({
      role: 'user',
      content: question,
    });

    return this.chat(messages);
  }
}

export const databricksClient = new DatabricksClient();
