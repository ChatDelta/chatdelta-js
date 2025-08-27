import axios, { AxiosInstance, AxiosError } from 'axios';
import { AiClient, ClientConfig, StreamChunk, Conversation, Message, AiResponse, ResponseMetadata } from '../types';
import { ClientError } from '../error';

interface OpenAIMessage {
  role: string;
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

interface OpenAIResponse {
  id?: string;
  model?: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class ChatGpt implements AiClient {
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
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendPrompt(prompt: string): Promise<string> {
    const response = await this.sendPromptWithMetadata(prompt);
    return response.content;
  }

  async sendPromptWithMetadata(prompt: string): Promise<AiResponse> {
    const messages: OpenAIMessage[] = [];
    
    if (this.config.systemMessage) {
      messages.push({ role: 'system', content: this.config.systemMessage });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    const body: OpenAIRequest = {
      model: this.modelName,
      messages,
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.maxTokens !== undefined && { max_tokens: this.config.maxTokens }),
      ...(this.config.topP !== undefined && { top_p: this.config.topP }),
      ...(this.config.frequencyPenalty !== undefined && { frequency_penalty: this.config.frequencyPenalty }),
      ...(this.config.presencePenalty !== undefined && { presence_penalty: this.config.presencePenalty }),
    };

    let lastError: ClientError | null = null;
    
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const startTime = Date.now();
        const response = await this.http.post<OpenAIResponse>('/chat/completions', body);
        const latencyMs = Date.now() - startTime;
        
        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          throw ClientError.api('No response from ChatGPT');
        }
        
        const metadata: ResponseMetadata = {
          modelUsed: response.data.model,
          promptTokens: response.data.usage?.prompt_tokens,
          completionTokens: response.data.usage?.completion_tokens,
          totalTokens: response.data.usage?.total_tokens,
          finishReason: response.data.choices[0]?.finish_reason,
          requestId: response.data.id,
          latencyMs,
        };
        
        return { content, metadata };
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
    return 'ChatGPT';
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
    const messages: OpenAIMessage[] = [];
    
    if (this.config.systemMessage) {
      messages.push({ role: 'system', content: this.config.systemMessage });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    const body: OpenAIRequest = {
      model: this.modelName,
      messages,
      stream: true,
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.maxTokens !== undefined && { max_tokens: this.config.maxTokens }),
      ...(this.config.topP !== undefined && { top_p: this.config.topP }),
      ...(this.config.frequencyPenalty !== undefined && { frequency_penalty: this.config.frequencyPenalty }),
      ...(this.config.presencePenalty !== undefined && { presence_penalty: this.config.presencePenalty }),
    };

    try {
      const response = await this.http.post('/chat/completions', body, {
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
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                yield { content, isComplete: false };
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
    const response = await this.sendConversationWithMetadata(conversation);
    return response.content;
  }

  async sendConversationWithMetadata(conversation: Conversation): Promise<AiResponse> {
    const messages: OpenAIMessage[] = [];
    
    if (this.config.systemMessage) {
      messages.push({ role: 'system', content: this.config.systemMessage });
    }
    
    messages.push(...conversation.getMessages().map(msg => ({
      role: msg.role,
      content: msg.content
    })));
    
    const body: OpenAIRequest = {
      model: this.modelName,
      messages,
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.maxTokens !== undefined && { max_tokens: this.config.maxTokens }),
      ...(this.config.topP !== undefined && { top_p: this.config.topP }),
      ...(this.config.frequencyPenalty !== undefined && { frequency_penalty: this.config.frequencyPenalty }),
      ...(this.config.presencePenalty !== undefined && { presence_penalty: this.config.presencePenalty }),
    };

    let lastError: ClientError | null = null;
    
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const startTime = Date.now();
        const response = await this.http.post<OpenAIResponse>('/chat/completions', body);
        const latencyMs = Date.now() - startTime;
        
        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          throw ClientError.api('No response from ChatGPT');
        }
        
        const metadata: ResponseMetadata = {
          modelUsed: response.data.model,
          promptTokens: response.data.usage?.prompt_tokens,
          completionTokens: response.data.usage?.completion_tokens,
          totalTokens: response.data.usage?.total_tokens,
          finishReason: response.data.choices[0]?.finish_reason,
          requestId: response.data.id,
          latencyMs,
        };
        
        return { content, metadata };
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
    const messages: OpenAIMessage[] = [];
    
    if (this.config.systemMessage) {
      messages.push({ role: 'system', content: this.config.systemMessage });
    }
    
    messages.push(...conversation.getMessages().map(msg => ({
      role: msg.role,
      content: msg.content
    })));
    
    const body: OpenAIRequest = {
      model: this.modelName,
      messages,
      stream: true,
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.maxTokens !== undefined && { max_tokens: this.config.maxTokens }),
      ...(this.config.topP !== undefined && { top_p: this.config.topP }),
      ...(this.config.frequencyPenalty !== undefined && { frequency_penalty: this.config.frequencyPenalty }),
      ...(this.config.presencePenalty !== undefined && { presence_penalty: this.config.presencePenalty }),
    };

    try {
      const response = await this.http.post('/chat/completions', body, {
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
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                yield { content, isComplete: false };
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