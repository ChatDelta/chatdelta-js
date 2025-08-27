export interface ClientConfig {
  timeout: number;
  retries: number;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemMessage?: string;
  baseUrl?: string;
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

export enum RetryStrategy {
  Fixed = 'fixed',
  Linear = 'linear',
  ExponentialBackoff = 'exponential',
  ExponentialWithJitter = 'exponential_with_jitter',
}

export interface ResponseMetadata {
  modelUsed?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  finishReason?: string;
  safetyRatings?: any;
  requestId?: string;
  latencyMs?: number;
}

export interface AiResponse {
  content: string;
  metadata: ResponseMetadata;
}

export interface StreamChunk {
  content: string;
  isComplete: boolean;
  metadata?: ResponseMetadata;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Conversation {
  messages: Message[];
  addMessage(message: Message): void;
  addUserMessage(content: string): void;
  addAssistantMessage(content: string): void;
  clear(): void;
  getMessages(): Message[];
}

export interface AiClient {
  sendPrompt(prompt: string): Promise<string>;
  sendPromptWithMetadata(prompt: string): Promise<AiResponse>;
  sendPromptStream(prompt: string): AsyncGenerator<StreamChunk>;
  sendConversation(conversation: Conversation): Promise<string>;
  sendConversationWithMetadata(conversation: Conversation): Promise<AiResponse>;
  sendConversationStream(conversation: Conversation): AsyncGenerator<StreamChunk>;
  supportsStreaming(): boolean;
  supportsConversations(): boolean;
  name(): string;
  model(): string;
}