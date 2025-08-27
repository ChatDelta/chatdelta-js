import axios, { AxiosInstance, AxiosError } from 'axios';
import { AiClient, ClientConfig, StreamChunk, Conversation, Message, AiResponse, ResponseMetadata } from '../types';
import { ClientError } from '../error';

interface GeminiContent {
  parts: Array<{
    text: string;
  }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  };
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: GeminiContent;
  }>;
}

export class Gemini implements AiClient {
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
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    });
  }

  async sendPrompt(prompt: string): Promise<string> {
    const generationConfig: any = {};
    if (this.config.temperature !== undefined) generationConfig.temperature = this.config.temperature;
    if (this.config.maxTokens !== undefined) generationConfig.maxOutputTokens = this.config.maxTokens;
    if (this.config.topP !== undefined) generationConfig.topP = this.config.topP;
    
    const body: GeminiRequest = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
      ...(this.config.systemMessage && {
        systemInstruction: {
          parts: [{ text: this.config.systemMessage }]
        }
      }),
    };

    let lastError: ClientError | null = null;
    
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.http.post<GeminiResponse>(
          `/models/${this.modelName}:generateContent?key=${this.key}`,
          body
        );
        
        const content = response.data.candidates[0]?.content?.parts[0]?.text;
        if (!content) {
          throw ClientError.api('No response from Gemini');
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
    return 'Gemini';
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
    // Note: Gemini streaming implementation would need Server-Sent Events
    // For now, fallback to non-streaming
    const result = await this.sendPrompt(prompt);
    yield { content: result, isComplete: true };
  }

  async sendConversation(conversation: Conversation): Promise<string> {
    const generationConfig: any = {};
    if (this.config.temperature !== undefined) generationConfig.temperature = this.config.temperature;
    if (this.config.maxTokens !== undefined) generationConfig.maxOutputTokens = this.config.maxTokens;
    if (this.config.topP !== undefined) generationConfig.topP = this.config.topP;
    
    const contents: GeminiContent[] = conversation.getMessages()
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        parts: [{ text: msg.content }]
      }));
    
    const body: GeminiRequest = {
      contents,
      ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
      ...(this.config.systemMessage && {
        systemInstruction: {
          parts: [{ text: this.config.systemMessage }]
        }
      }),
    };

    let lastError: ClientError | null = null;
    
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.http.post<GeminiResponse>(
          `/models/${this.modelName}:generateContent?key=${this.key}`,
          body
        );
        
        const content = response.data.candidates[0]?.content?.parts[0]?.text;
        if (!content) {
          throw ClientError.api('No response from Gemini');
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
    // Note: Gemini streaming implementation would need Server-Sent Events
    // For now, fallback to non-streaming
    const result = await this.sendConversation(conversation);
    yield { content: result, isComplete: true };
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
    return false; // Gemini streaming support coming soon
  }

  supportsConversations(): boolean {
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}