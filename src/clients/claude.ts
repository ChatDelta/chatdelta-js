import axios, { AxiosInstance, AxiosError } from 'axios';
import { AiClient, ClientConfig, StreamChunk, Conversation, Message, AiResponse, ResponseMetadata } from '../types';
import { ClientError } from '../error';

interface ClaudeMessage {
  role: string;
  content: string;
}

interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  system?: string;
  stream?: boolean;
}

interface ClaudeResponse {
  content: Array<{
    text: string;
  }>;
}

export class Claude implements AiClient {
  private http: AxiosInstance;
  private key: string;
  private modelName: string;
  private config: ClientConfig;
  private retries: number;

  constructor(key: string, model: string, config: ClientConfig) {
    this.key = key;
    this.modelName = model;
    this.config = config;
    this.retries = config.retries;
    
    this.http = axios.create({
      timeout: config.timeout,
      baseURL: 'https://api.anthropic.com/v1',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });
  }

  async sendPrompt(prompt: string): Promise<string> {
    const body: ClaudeRequest = {
      model: this.modelName,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: this.config.maxTokens || 1024,
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.topP !== undefined && { top_p: this.config.topP }),
      ...(this.config.systemMessage && { system: this.config.systemMessage }),
    };

    let lastError: ClientError | null = null;
    
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.http.post<ClaudeResponse>('/messages', body);
        
        const content = response.data.content[0]?.text;
        if (!content) {
          throw ClientError.api('No response from Claude');
        }
        
        return content;
      } catch (error) {
        lastError = this.handleError(error);
        
        if (attempt < this.retries) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    throw lastError!;
  }

  name(): string {
    return 'Claude';
  }

  model(): string {
    return this.modelName;
  }

  private handleError(error: unknown): ClientError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        return ClientError.network('Request timeout');
      }
      
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        return ClientError.network('Connection failed');
      }
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        if (status === 401) {
          return ClientError.authentication('Invalid API key');
        } else if (status === 429) {
          return ClientError.api('Rate limit exceeded');
        } else {
          return ClientError.api(`HTTP ${status}: ${axiosError.message}`);
        }
      }
      
      return ClientError.network(axiosError.message);
    }
    
    if (error instanceof Error) {
      return ClientError.parse(`JSON parsing failed: ${error.message}`);
    }
    
    return ClientError.network('Unknown error occurred');
  }

  async *sendPromptStream(prompt: string): AsyncGenerator<StreamChunk> {
    const body: ClaudeRequest = {
      model: this.modelName,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: this.config.maxTokens || 1024,
      stream: true,
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.topP !== undefined && { top_p: this.config.topP }),
      ...(this.config.systemMessage && { system: this.config.systemMessage }),
    };

    try {
      const response = await this.http.post('/messages', body, {
        responseType: 'stream',
      });

      let buffer = '';
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              yield { content: '', isComplete: true };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text;
                if (content) {
                  yield { content, isComplete: false };
                }
              } else if (parsed.type === 'message_stop') {
                yield { content: '', isComplete: true };
                return;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async sendConversation(conversation: Conversation): Promise<string> {
    const messages = conversation.getMessages().filter(msg => msg.role !== 'system');
    
    const body: ClaudeRequest = {
      model: this.modelName,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: this.config.maxTokens || 1024,
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.topP !== undefined && { top_p: this.config.topP }),
      ...(this.config.systemMessage && { system: this.config.systemMessage }),
    };

    let lastError: ClientError | null = null;
    
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.http.post<ClaudeResponse>('/messages', body);
        
        const content = response.data.content[0]?.text;
        if (!content) {
          throw ClientError.api('No response from Claude');
        }
        
        return content;
      } catch (error) {
        lastError = this.handleError(error);
        
        if (attempt < this.retries) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    throw lastError!;
  }

  async *sendConversationStream(conversation: Conversation): AsyncGenerator<StreamChunk> {
    const messages = conversation.getMessages().filter(msg => msg.role !== 'system');
    
    const body: ClaudeRequest = {
      model: this.modelName,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: this.config.maxTokens || 1024,
      stream: true,
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.topP !== undefined && { top_p: this.config.topP }),
      ...(this.config.systemMessage && { system: this.config.systemMessage }),
    };

    try {
      const response = await this.http.post('/messages', body, {
        responseType: 'stream',
      });

      let buffer = '';
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              yield { content: '', isComplete: true };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text;
                if (content) {
                  yield { content, isComplete: false };
                }
              } else if (parsed.type === 'message_stop') {
                yield { content: '', isComplete: true };
                return;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async sendPromptWithMetadata(prompt: string): Promise<AiResponse> {
    const startTime = Date.now();
    const content = await this.sendPrompt(prompt);
    const latencyMs = Date.now() - startTime;
    
    const metadata: ResponseMetadata = {
      modelUsed: this.modelName,
      latencyMs,
    };
    
    return { content, metadata };
  }

  async sendConversationWithMetadata(conversation: Conversation): Promise<AiResponse> {
    const startTime = Date.now();
    const content = await this.sendConversation(conversation);
    const latencyMs = Date.now() - startTime;
    
    const metadata: ResponseMetadata = {
      modelUsed: this.modelName,
      latencyMs,
    };
    
    return { content, metadata };
  }

  supportsStreaming(): boolean {
    return true;
  }

  supportsConversations(): boolean {
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}