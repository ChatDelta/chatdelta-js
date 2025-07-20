import { createClient, executeParallel, generateSummary, createConversation } from '../index';
import { AiClient, ClientConfig, StreamChunk, Conversation } from '../types';
import { ClientError } from '../error';

class MockClient implements AiClient {
  private mockName: string;
  private mockModel: string;
  private responses: string[];
  private responseIndex = 0;

  constructor(name: string, model: string, responses: string[] = ['mock response']) {
    this.mockName = name;
    this.mockModel = model;
    this.responses = responses;
  }

  async sendPrompt(_prompt: string): Promise<string> {
    if (this.responseIndex >= this.responses.length) {
      throw ClientError.api('No more mock responses');
    }
    return this.responses[this.responseIndex++];
  }

  async *sendPromptStream(_prompt: string): AsyncGenerator<StreamChunk> {
    const response = await this.sendPrompt(_prompt);
    yield { content: response, isComplete: true };
  }

  async sendConversation(_conversation: Conversation): Promise<string> {
    return this.sendPrompt('conversation');
  }

  async *sendConversationStream(_conversation: Conversation): AsyncGenerator<StreamChunk> {
    const response = await this.sendConversation(_conversation);
    yield { content: response, isComplete: true };
  }

  name(): string {
    return this.mockName;
  }

  model(): string {
    return this.mockModel;
  }
}

describe('ChatDelta', () => {
  describe('createClient', () => {
    const config: ClientConfig = {
      timeout: 5000,
      retries: 1,
      temperature: 0.7,
      maxTokens: 500,
    };

    it('should create OpenAI client', () => {
      const client = createClient('openai', 'test-key', 'gpt-4', config);
      expect(client.name()).toBe('ChatGPT');
      expect(client.model()).toBe('gpt-4');
    });

    it('should create client with default config', () => {
      const client = createClient('openai', 'test-key', 'gpt-4');
      expect(client.name()).toBe('ChatGPT');
    });

    it('should create GPT client via alias', () => {
      const client = createClient('gpt', 'test-key', 'gpt-4', config);
      expect(client.name()).toBe('ChatGPT');
    });

    it('should create ChatGPT client via alias', () => {
      const client = createClient('chatgpt', 'test-key', 'gpt-4', config);
      expect(client.name()).toBe('ChatGPT');
    });

    it('should create Google client via alias', () => {
      const client = createClient('google', 'test-key', 'gemini-pro', config);
      expect(client.name()).toBe('Gemini');
    });

    it('should create Claude client', () => {
      const client = createClient('claude', 'test-key', 'claude-3', config);
      expect(client.name()).toBe('Claude');
      expect(client.model()).toBe('claude-3');
    });

    it('should create Gemini client', () => {
      const client = createClient('gemini', 'test-key', 'gemini-pro', config);
      expect(client.name()).toBe('Gemini');
      expect(client.model()).toBe('gemini-pro');
    });

    it('should create Anthropic client via alias', () => {
      const client = createClient('anthropic', 'test-key', 'claude-3', config);
      expect(client.name()).toBe('Claude');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        createClient('unknown', 'test-key', 'model', config);
      }).toThrow('Unknown provider: unknown');
    });
  });

  describe('executeParallel', () => {
    it('should execute multiple clients in parallel', async () => {
      const clients: AiClient[] = [
        new MockClient('client1', 'model1', ['response1']),
        new MockClient('client2', 'model2', ['response2']),
      ];

      const results = await executeParallel(clients, 'test prompt');
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('client1');
      expect(results[0].result).toBe('response1');
      expect(results[1].name).toBe('client2');
      expect(results[1].result).toBe('response2');
    });

    it('should handle client errors gracefully', async () => {
      const clients: AiClient[] = [
        new MockClient('client1', 'model1', ['response1']),
        new MockClient('client2', 'model2', []), // Will throw error
      ];

      const results = await executeParallel(clients, 'test prompt');
      
      expect(results).toHaveLength(2);
      expect(results[0].result).toBe('response1');
      expect(results[1].result).toBeInstanceOf(ClientError);
    });

    it('should wrap non ClientError exceptions', async () => {
      const bad: AiClient = {
        async sendPrompt() {
          throw new Error('boom');
        },
        async *sendPromptStream() {
          throw new Error('boom');
        },
        async sendConversation() {
          throw new Error('boom');
        },
        async *sendConversationStream() {
          throw new Error('boom');
        },
        name() {
          return 'bad';
        },
        model() {
          return 'm';
        },
      };

      const results = await executeParallel([bad], 'x');
      expect(results[0].result).toBeInstanceOf(ClientError);
      expect((results[0].result as ClientError).message).toBe('Network error: Unknown error');
    });
  });

  describe('generateSummary', () => {
    it('should generate summary from responses', async () => {
      const client = new MockClient('summarizer', 'model', ['This is a summary']);
      const responses = [
        { name: 'AI1', response: 'Response 1' },
        { name: 'AI2', response: 'Response 2' },
      ];

      const summary = await generateSummary(client, responses);
      expect(summary).toBe('This is a summary');
    });
  });
});