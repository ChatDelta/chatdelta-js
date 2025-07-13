export enum ClientErrorType {
  Network = 'Network',
  Api = 'Api',
  Authentication = 'Authentication',
  Configuration = 'Configuration',
  Parse = 'Parse',
}

export class ClientError extends Error {
  public readonly type: ClientErrorType;

  constructor(type: ClientErrorType, message: string) {
    super(`${type} error: ${message}`);
    this.type = type;
    this.name = 'ClientError';
  }

  static network(message: string): ClientError {
    return new ClientError(ClientErrorType.Network, message);
  }

  static api(message: string): ClientError {
    return new ClientError(ClientErrorType.Api, message);
  }

  static authentication(message: string): ClientError {
    return new ClientError(ClientErrorType.Authentication, message);
  }

  static configuration(message: string): ClientError {
    return new ClientError(ClientErrorType.Configuration, message);
  }

  static parse(message: string): ClientError {
    return new ClientError(ClientErrorType.Parse, message);
  }
}