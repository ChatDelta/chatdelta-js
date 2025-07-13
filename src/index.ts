import { AiClient, ClientConfig, defaultClientConfig } from './types';
import { ClientError } from './error';
import { ChatGpt, Claude, Gemini } from './clients';

export { AiClient, ClientConfig, ClientError, ChatGpt, Claude, Gemini };

export function createClient(
  provider: string,
  apiKey: string,
  model: string,
  config: Partial<ClientConfig> = {}
): AiClient {
  const finalConfig: ClientConfig = { ...defaultClientConfig, ...config };

  switch (provider.toLowerCase()) {
    case 'openai':
    case 'gpt':
    case 'chatgpt':
      return new ChatGpt(apiKey, model, finalConfig);
    
    case 'google':
    case 'gemini':
      return new Gemini(apiKey, model, finalConfig);
    
    case 'anthropic':
    case 'claude':
      return new Claude(apiKey, model, finalConfig);
    
    default:
      throw ClientError.configuration(
        `Unknown provider: ${provider}. Supported providers: openai, google, anthropic`
      );
  }
}

export async function executeParallel(
  clients: AiClient[],
  prompt: string
): Promise<Array<{ name: string; result: string | ClientError }>> {
  const promises = clients.map(async (client) => {
    try {
      const result = await client.sendPrompt(prompt);
      return { name: client.name(), result };
    } catch (error) {
      return { 
        name: client.name(), 
        result: error instanceof ClientError ? error : ClientError.network('Unknown error') 
      };
    }
  });

  return Promise.all(promises);
}

export async function generateSummary(
  client: AiClient,
  responses: Array<{ name: string; response: string }>
): Promise<string> {
  let summaryPrompt = 'Given these AI model responses:\n';
  
  for (const { name, response } of responses) {
    summaryPrompt += `${name}:\n${response}\n---\n`;
  }
  
  summaryPrompt += 'Summarize the key differences and commonalities.';
  
  return client.sendPrompt(summaryPrompt);
}