import { ClientConfig, defaultClientConfig } from './types';

export class ClientConfigBuilder {
  private config: ClientConfig;

  constructor() {
    this.config = { ...defaultClientConfig };
  }

  timeout(timeout: number): ClientConfigBuilder {
    this.config.timeout = timeout;
    return this;
  }

  retries(retries: number): ClientConfigBuilder {
    this.config.retries = retries;
    return this;
  }

  temperature(temperature: number): ClientConfigBuilder {
    this.config.temperature = temperature;
    return this;
  }

  maxTokens(maxTokens: number): ClientConfigBuilder {
    this.config.maxTokens = maxTokens;
    return this;
  }

  topP(topP: number): ClientConfigBuilder {
    this.config.topP = topP;
    return this;
  }

  frequencyPenalty(frequencyPenalty: number): ClientConfigBuilder {
    this.config.frequencyPenalty = frequencyPenalty;
    return this;
  }

  presencePenalty(presencePenalty: number): ClientConfigBuilder {
    this.config.presencePenalty = presencePenalty;
    return this;
  }

  systemMessage(systemMessage: string): ClientConfigBuilder {
    this.config.systemMessage = systemMessage;
    return this;
  }

  build(): ClientConfig {
    return { ...this.config };
  }

  static builder(): ClientConfigBuilder {
    return new ClientConfigBuilder();
  }
}