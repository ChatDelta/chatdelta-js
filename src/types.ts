export interface ClientConfig {
  timeout: number;
  retries: number;
  temperature?: number;
  maxTokens?: number;
}

export const defaultClientConfig: ClientConfig = {
  timeout: 30000,
  retries: 0,
  temperature: undefined,
  maxTokens: 1024,
};

export interface AiClient {
  sendPrompt(prompt: string): Promise<string>;
  name(): string;
  model(): string;
}