export interface ClientConfig {
  timeout: number;
  retries: number;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemMessage?: string;
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
};

export interface StreamChunk {
  content: string;
  isComplete: boolean;
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
  sendPromptStream(prompt: string): AsyncGenerator<StreamChunk>;
  sendConversation(conversation: Conversation): Promise<string>;
  sendConversationStream(conversation: Conversation): AsyncGenerator<StreamChunk>;
  name(): string;
  model(): string;
}