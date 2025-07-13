import { ClientError, ClientErrorType } from '../error';

describe('ClientError', () => {
  it('should create network error', () => {
    const error = ClientError.network('Connection failed');
    expect(error.type).toBe(ClientErrorType.Network);
    expect(error.message).toBe('Network error: Connection failed');
    expect(error.name).toBe('ClientError');
  });

  it('should create API error', () => {
    const error = ClientError.api('Rate limit exceeded');
    expect(error.type).toBe(ClientErrorType.Api);
    expect(error.message).toBe('Api error: Rate limit exceeded');
  });

  it('should create authentication error', () => {
    const error = ClientError.authentication('Invalid API key');
    expect(error.type).toBe(ClientErrorType.Authentication);
    expect(error.message).toBe('Authentication error: Invalid API key');
  });

  it('should create configuration error', () => {
    const error = ClientError.configuration('Invalid config');
    expect(error.type).toBe(ClientErrorType.Configuration);
    expect(error.message).toBe('Configuration error: Invalid config');
  });

  it('should create parse error', () => {
    const error = ClientError.parse('JSON parsing failed');
    expect(error.type).toBe(ClientErrorType.Parse);
    expect(error.message).toBe('Parse error: JSON parsing failed');
  });
});