import { 
  AiClient, 
  ClientConfig, 
  defaultClientConfig, 
  StreamChunk, 
  Conversation, 
  Message,
  ResponseMetadata,
  AiResponse,
  RetryStrategy
} from './types';
import { ClientError } from './error';
import { ChatGpt, Claude, Gemini } from './clients';
import { Conversation as ConversationImpl } from './conversation';
import { ClientConfigBuilder } from './config';
import { ChatSession } from './session';

export { 
  AiClient, 
  ClientConfig, 
  ClientError, 
  ChatGpt, 
  Claude, 
  Gemini,
  StreamChunk,
  Conversation,
  Message,
  ConversationImpl,
  ClientConfigBuilder,
  ChatSession,
  ResponseMetadata,
  AiResponse,
  RetryStrategy
};

/**
 * Factory function to create an AI client instance for a supported provider.
 * 
 * @param {string} provider - The AI provider ('openai'|'gpt'|'chatgpt'|'google'|'gemini'|'anthropic'|'claude')
 * @param {string} apiKey - The API key for the provider
 * @param {string} model - The model name to use (e.g., 'gpt-4', 'claude-3-sonnet', 'gemini-pro')
 * @param {Partial<ClientConfig>} [config={}] - Optional configuration overrides
 * @returns {AiClient} An AiClient instance for the specified provider
 * @throws {ClientError} If provider, apiKey, or model are invalid or unsupported
 * 
 * @example
 * ```typescript
 * const client = createClient('openai', process.env.OPENAI_KEY, 'gpt-4', {
 *   temperature: 0.7,
 *   maxTokens: 2048,
 *   retryStrategy: RetryStrategy.ExponentialWithJitter
 * });
 * ```
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
 * 
 * @param {AiClient[]} clients - Array of AiClient instances
 * @param {string} prompt - The prompt to send to each client
 * @returns {Promise<Array<{name: string, result: string | ClientError}>>} Array of results from each client
 * 
 * @example
 * ```typescript
 * const clients = [
 *   createClient('openai', key1, 'gpt-4'),
 *   createClient('claude', key2, 'claude-3-sonnet')
 * ];
 * const results = await executeParallel(clients, 'Explain quantum computing');
 * ```
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
 * Executes a conversation in parallel across multiple AI clients.
 * 
 * @param {AiClient[]} clients - Array of AiClient instances
 * @param {Conversation} conversation - The conversation to send to each client
 * @returns {Promise<Array<{name: string, result: string | ClientError}>>} Array of results from each client
 * 
 * @example
 * ```typescript
 * const conversation = createConversation();
 * conversation.addUserMessage('What is AI?');
 * const results = await executeParallelConversation(clients, conversation);
 * ```
 */
export async function executeParallelConversation(
  clients: AiClient[],
  conversation: Conversation
): Promise<Array<{ name: string; result: string | ClientError }>> {
  const promises = clients.map(async (client) => {
    try {
      const result = await client.sendConversation(conversation);
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
 * Creates a new conversation instance.
 * 
 * @returns {Conversation} A new Conversation instance
 * 
 * @example
 * ```typescript
 * const conversation = createConversation();
 * conversation.addUserMessage('Hello');
 * conversation.addAssistantMessage('Hi! How can I help you?');
 * ```
 */
export function createConversation(): Conversation {
  return new ConversationImpl();
}

/**
 * Generates a summary of multiple AI model responses using a provided client.
 * Useful for comparing outputs from different models.
 * 
 * @param {AiClient} client - The AiClient to use for summarization
 * @param {Array<{name: string, response: string}>} responses - Array of model responses
 * @returns {Promise<string>} A summary highlighting differences and commonalities
 * 
 * @example
 * ```typescript
 * const responses = [
 *   { name: 'GPT-4', response: 'Response from GPT-4...' },
 *   { name: 'Claude', response: 'Response from Claude...' }
 * ];
 * const summary = await generateSummary(client, responses);
 * ```
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

/**
 * Execute with retry logic using exponential backoff.
 * @deprecated Use executeWithRetry from './retry' instead
 * 
 * @param {() => Promise<T>} fn - The async function to execute
 * @param {number} [retries=3] - Number of retry attempts
 * @param {number} [baseDelay=1000] - Base delay in milliseconds
 * @returns {Promise<T>} The result of the function
 * @throws {Error} The last error if all retries fail
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}