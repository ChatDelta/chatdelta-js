export enum ClientErrorType {
  Network = 'Network',
  Api = 'Api',
  Authentication = 'Authentication',
  Configuration = 'Configuration',
  Parse = 'Parse',
  Stream = 'Stream',
}

/**
 * Represents an error thrown by AI clients.
 */
export class ClientError extends Error {
  public readonly type: ClientErrorType;

  /**
   * Constructs a new ClientError.
   * @param type - The type of error.
   * @param message - The error message.
   */
  constructor(type: ClientErrorType, message: string) {
    super(`${type} error: ${message}`);
    this.type = type;
    this.name = 'ClientError';
  }

  /**
   * Serializes the error to a plain object.
   */
  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      stack: this.stack,
    };
  }

  /**
   * Creates a network error.
   */
  static network(message: string): ClientError {
    return new ClientError(ClientErrorType.Network, message);
  }

  /**
   * Creates an API error.
   */
  static api(message: string): ClientError {
    return new ClientError(ClientErrorType.Api, message);
  }

  /**
   * Creates an authentication error.
   */
  static authentication(message: string): ClientError {
    return new ClientError(ClientErrorType.Authentication, message);
  }

  /**
   * Creates a configuration error.
   */
  static configuration(message: string): ClientError {
    return new ClientError(ClientErrorType.Configuration, message);
  }

  /**
   * Creates a parse error.
   */
  static parse(message: string): ClientError {
    return new ClientError(ClientErrorType.Parse, message);
  }

  /**
   * Creates a stream error.
   */
  static stream(message: string): ClientError {
    return new ClientError(ClientErrorType.Stream, message);
  }
}