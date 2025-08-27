/**
 * Retry strategy for handling failed requests
 * @enum {string}
 */
export enum RetryStrategy {
  /** Fixed delay between retries */
  Fixed = 'fixed',
  /** Linearly increasing delay between retries */
  Linear = 'linear',
  /** Exponentially increasing delay between retries */
  ExponentialBackoff = 'exponential',
  /** Exponential delay with random jitter to prevent thundering herd */
  ExponentialWithJitter = 'exponential_with_jitter',
}

/**
 * Configuration options for AI clients
 * @interface ClientConfig
 */
export interface ClientConfig {
  /** Request timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts for failed requests */
  retries: number;
  /** Sampling temperature (0.0-2.0). Higher values mean more random output */
  temperature?: number;
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  /** Top-p sampling parameter (0.0-1.0). Alternative to temperature */
  topP?: number;
  /** Frequency penalty (-2.0 to 2.0). Reduces repetition of token sequences */
  frequencyPenalty?: number;
  /** Presence penalty (-2.0 to 2.0). Reduces repetition of any tokens that have appeared */
  presencePenalty?: number;
  /** System message to set context for the AI */
  systemMessage?: string;
  /** Custom base URL for API endpoint (e.g., for Azure OpenAI or local models) */
  baseUrl?: string;
  /** Strategy for retry delays */
  retryStrategy?: RetryStrategy;
}

export const defaultClientConfig: ClientConfig = {
  timeout: 30000,
  retries: 0,
  temperature: undefined,
  maxTokens: 1024,
  topP: undefined,
  frequencyPenalty: undefined,
  presencePenalty: undefined,
  systemMessage: undefined,
  baseUrl: undefined,
  retryStrategy: RetryStrategy.ExponentialBackoff,
};

/**
 * Metadata about an AI response
 * @interface ResponseMetadata
 */
export interface ResponseMetadata {
  /** The actual model version used (may differ from requested) */
  modelUsed?: string;
  /** Number of tokens in the prompt */
  promptTokens?: number;
  /** Number of tokens in the completion */
  completionTokens?: number;
  /** Total tokens used (prompt + completion) */
  totalTokens?: number;
  /** Reason the generation ended (e.g., 'stop', 'length', 'content_filter') */
  finishReason?: string;
  /** Safety ratings or content filter results from the provider */
  safetyRatings?: any;
  /** Request ID for debugging and tracking */
  requestId?: string;
  /** Time taken to generate response in milliseconds */
  latencyMs?: number;
}

/**
 * AI response with content and metadata
 * @interface AiResponse
 */
export interface AiResponse {
  /** The actual text content of the response */
  content: string;
  /** Metadata about the response */
  metadata: ResponseMetadata;
}

/**
 * A chunk of streaming response
 * @interface StreamChunk
 */
export interface StreamChunk {
  /** Content of this chunk */
  content: string;
  /** Whether this is the final chunk */
  isComplete: boolean;
  /** Metadata (only populated on final chunk) */
  metadata?: ResponseMetadata;
}

/**
 * A single message in a conversation
 * @interface Message
 */
export interface Message {
  /** Role of the message sender */
  role: 'system' | 'user' | 'assistant';
  /** Content of the message */
  content: string;
}

/**
 * Represents a conversation with message history
 * @interface Conversation
 */
export interface Conversation {
  /** Array of messages in the conversation */
  messages: Message[];
  /** Add a message to the conversation */
  addMessage(message: Message): void;
  /** Add a user message to the conversation */
  addUserMessage(content: string): void;
  /** Add an assistant message to the conversation */
  addAssistantMessage(content: string): void;
  /** Clear all messages from the conversation */
  clear(): void;
  /** Get all messages in the conversation */
  getMessages(): Message[];
}

/**
 * Common interface for all AI clients
 * @interface AiClient
 */
export interface AiClient {
  /**
   * Send a single prompt and get a text response
   * @param {string} prompt - The prompt to send
   * @returns {Promise<string>} The AI's response
   * @throws {ClientError} On network, API, or configuration errors
   */
  sendPrompt(prompt: string): Promise<string>;
  
  /**
   * Send a prompt and get a response with metadata
   * @param {string} prompt - The prompt to send
   * @returns {Promise<AiResponse>} Response with content and metadata
   * @throws {ClientError} On network, API, or configuration errors
   */
  sendPromptWithMetadata(prompt: string): Promise<AiResponse>;
  
  /**
   * Send a prompt and stream the response
   * @param {string} prompt - The prompt to send
   * @returns {AsyncGenerator<StreamChunk>} Stream of response chunks
   * @throws {ClientError} On network, API, or configuration errors
   */
  sendPromptStream(prompt: string): AsyncGenerator<StreamChunk>;
  
  /**
   * Send a conversation and get a text response
   * @param {Conversation} conversation - The conversation history
   * @returns {Promise<string>} The AI's response
   * @throws {ClientError} On network, API, or configuration errors
   */
  sendConversation(conversation: Conversation): Promise<string>;
  
  /**
   * Send a conversation and get a response with metadata
   * @param {Conversation} conversation - The conversation history
   * @returns {Promise<AiResponse>} Response with content and metadata
   * @throws {ClientError} On network, API, or configuration errors
   */
  sendConversationWithMetadata(conversation: Conversation): Promise<AiResponse>;
  
  /**
   * Send a conversation and stream the response
   * @param {Conversation} conversation - The conversation history
   * @returns {AsyncGenerator<StreamChunk>} Stream of response chunks
   * @throws {ClientError} On network, API, or configuration errors
   */
  sendConversationStream(conversation: Conversation): AsyncGenerator<StreamChunk>;
  
  /**
   * Check if this client supports streaming responses
   * @returns {boolean} True if streaming is supported
   */
  supportsStreaming(): boolean;
  
  /**
   * Check if this client supports conversation history
   * @returns {boolean} True if conversations are supported
   */
  supportsConversations(): boolean;
  
  /**
   * Get the name of this AI client
   * @returns {string} Client name (e.g., 'ChatGPT', 'Claude', 'Gemini')
   */
  name(): string;
  
  /**
   * Get the model being used
   * @returns {string} Model identifier
   */
  model(): string;
}