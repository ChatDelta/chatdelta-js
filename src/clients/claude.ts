import axios, { AxiosInstance, AxiosError } from 'axios';
import { AiClient, ClientConfig } from '../types';
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
  private maxTokens: number;
  private temperature?: number;
  private retries: number;

  constructor(key: string, model: string, config: ClientConfig) {
    this.key = key;
    this.modelName = model;
    this.maxTokens = config.maxTokens || 1024;
    this.temperature = config.temperature;
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
      max_tokens: this.maxTokens,
      ...(this.temperature !== undefined && { temperature: this.temperature }),
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}