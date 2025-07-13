import axios, { AxiosInstance, AxiosError } from 'axios';
import { AiClient, ClientConfig } from '../types';
import { ClientError } from '../error';

interface OpenAIMessage {
  role: string;
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class ChatGpt implements AiClient {
  private http: AxiosInstance;
  private key: string;
  private modelName: string;
  private temperature?: number;
  private retries: number;

  constructor(key: string, model: string, config: ClientConfig) {
    this.key = key;
    this.modelName = model;
    this.temperature = config.temperature;
    this.retries = config.retries;
    
    this.http = axios.create({
      timeout: config.timeout,
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendPrompt(prompt: string): Promise<string> {
    const body: OpenAIRequest = {
      model: this.modelName,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      ...(this.temperature !== undefined && { temperature: this.temperature }),
    };

    let lastError: ClientError | null = null;
    
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.http.post<OpenAIResponse>('/chat/completions', body);
        
        const content = response.data.choices[0]?.message?.content;
        if (!content) {
          throw ClientError.api('No response from ChatGPT');
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}