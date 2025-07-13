import axios from 'axios';
import { ChatGpt } from '../clients/openai';
import { Gemini } from '../clients/gemini';
import { Claude } from '../clients/claude';
import { ClientError } from '../error';
import { ClientConfig } from '../types';

jest.mock('axios');

const postMock = jest.fn();
(axios.create as jest.Mock).mockReturnValue({ post: postMock });

const baseConfig: ClientConfig = { timeout: 1, retries: 1 };

beforeEach(() => {
  jest.clearAllMocks();
  (axios.create as jest.Mock).mockReturnValue({ post: postMock });
});

describe.each([
  ['ChatGpt', ChatGpt],
  ['Gemini', Gemini],
  ['Claude', Claude],
])('%s client', (_name, ClientCtor) => {
  it('sends prompt successfully', async () => {
    postMock.mockResolvedValueOnce(
      ClientCtor === ChatGpt
        ? { data: { choices: [{ message: { content: 'ok' } }] } }
        : ClientCtor === Gemini
        ? { data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } }
        : { data: { content: [{ text: 'ok' }] } }
    );
    const client = new ClientCtor('key', 'model', baseConfig);
    const result = await client.sendPrompt('hi');
    expect(result).toBe('ok');
  });

  it('sends prompt with temperature', async () => {
    postMock.mockResolvedValueOnce(
      ClientCtor === ChatGpt
        ? { data: { choices: [{ message: { content: 'ok' } }] } }
        : ClientCtor === Gemini
        ? { data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } }
        : { data: { content: [{ text: 'ok' }] } }
    );
    const cfg: ClientConfig = { timeout: 1, retries: 0, temperature: 0.5 };
    const client = new ClientCtor('key', 'model', cfg);
    const result = await client.sendPrompt('hi');
    expect(result).toBe('ok');
  });

  it('throws when response missing', async () => {
    postMock.mockResolvedValueOnce(
      ClientCtor === ChatGpt
        ? { data: { choices: [{ message: {} }] } }
        : ClientCtor === Gemini
        ? { data: { candidates: [{ content: { parts: [{}] } }] } }
        : { data: { content: [{}] } }
    );
    const client = new ClientCtor('key', 'model', baseConfig);
    await expect(client.sendPrompt('hi')).rejects.toBeInstanceOf(ClientError);
  });

  it('retries and throws ClientError', async () => {
    (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
    postMock.mockRejectedValue(new Error('fail'));
    const client = new ClientCtor('key', 'model', baseConfig);
    (client as any).delay = jest.fn(() => Promise.resolve());
    await expect(client.sendPrompt('hi')).rejects.toBeInstanceOf(ClientError);
    expect((client as any).delay).toHaveBeenCalled();
  });

  it('delay helper resolves', async () => {
    const client = new ClientCtor('key', 'model', baseConfig);
    await expect((client as any).delay(0)).resolves.toBeUndefined();
  });

  describe('handleError branches', () => {
    let client: any;
    beforeEach(() => {
      client = new ClientCtor('key', 'model', baseConfig);
    });

    function call(err: any) {
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      return client.handleError(err);
    }

    it('timeout', () => {
      const err = { code: 'ETIMEDOUT' };
      expect(call(err).message).toBe('Network error: Request timeout');
    });

    it('connection failed', () => {
      const err = { code: 'ECONNREFUSED' };
      expect(call(err).message).toBe('Network error: Connection failed');
    });

    it('status 401', () => {
      const err = { code: 'ERR', response: { status: 401 }, message: 'm' };
      expect(call(err).message).toBe('Authentication error: Invalid API key');
    });

    it('status 429', () => {
      const err = { code: 'ERR', response: { status: 429 }, message: 'm' };
      expect(call(err).message).toBe('Api error: Rate limit exceeded');
    });

    it('status other', () => {
      const err = { code: 'ERR', response: { status: 500 }, message: 'oops' };
      expect(call(err).message).toBe('Api error: HTTP 500: oops');
    });

    it('network message', () => {
      const err = { code: 'ERR', message: 'bad' };
      expect(call(err).message).toBe('Network error: bad');
    });

    it('parse error', () => {
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
      const error = new Error('json');
      expect(client.handleError(error).message).toBe('Parse error: JSON parsing failed: json');
    });

    it('unknown', () => {
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
      expect(client.handleError(123).message).toBe('Network error: Unknown error occurred');
    });
  });
});
