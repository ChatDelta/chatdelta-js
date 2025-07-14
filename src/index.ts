import { AiClient, ClientConfig, defaultClientConfig } from './types';
import { ClientError } from './error';
import { ChatGpt, Claude, Gemini } from './clients';

export { AiClient, ClientConfig, ClientError, ChatGpt, Claude, Gemini };

/**
 * Factory function to create an AI client instance for a supported provider.
 * @param provider - The AI provider (e.g., 'openai', 'gemini', 'claude').
 * @param apiKey - The API key for the provider.
 * @param model - The model name to use.
 * @param config - Optional configuration overrides.
 * @returns An AiClient instance for the specified provider.
 * @throws {ClientError} If provider, apiKey, or model are invalid or unsupported.
 */
export function createClient(
  provider: string,
  apiKey: string,
  model: string,
  config: Partial<ClientConfig> = {}
): AiClient {
  if (!provider || typeof provider !== 'string') {
    throw ClientError.configuration('Provider must be a non-empty string.');
  }
  if (!apiKey || typeof apiKey !== 'string') {
    throw ClientError.configuration('API key must be a non-empty string.');
  }
  if (!model || typeof model !== 'string') {
    throw ClientError.configuration('Model must be a non-empty string.');
  }
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


/**
 * Executes a prompt in parallel across multiple AI clients.
 * @param clients - Array of AiClient instances.
 * @param prompt - The prompt to send to each client.
 * @returns Array of results from each client (name and result or error).
 */
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

/**
 * Generates a summary of multiple AI model responses using a provided client.
 * @param client - The AiClient to use for summarization.
 * @param responses - Array of objects with model name and response.
 * @returns A summary string highlighting differences and commonalities.
 */
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