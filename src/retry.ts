import { ClientError } from './error';
import { RetryStrategy } from './types';

/**
 * Configuration for retry behavior
 * Ported from chatdelta-rs/src/utils.rs
 */
export interface RetryConfig {
  strategy: RetryStrategy;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

/**
 * Default retry configuration
 */
export const defaultRetryConfig: RetryConfig = {
  strategy: RetryStrategy.ExponentialBackoff,
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Calculate delay based on retry strategy
 */
function calculateDelay(
  strategy: RetryStrategy,
  attempt: number,
  baseDelayMs: number,
  maxDelayMs?: number
): number {
  let delay: number;
  
  switch (strategy) {
    case RetryStrategy.Fixed:
      delay = baseDelayMs;
      break;
    
    case RetryStrategy.Linear:
      delay = baseDelayMs * (attempt + 1);
      break;
    
    case RetryStrategy.ExponentialBackoff:
      delay = baseDelayMs * Math.pow(2, attempt);
      break;
    
    case RetryStrategy.ExponentialWithJitter:
      const baseExponential = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * baseExponential * 0.1; // 10% jitter
      delay = baseExponential + jitter;
      break;
    
    default:
      delay = baseDelayMs;
  }
  
  // Cap at maximum delay if specified
  if (maxDelayMs) {
    delay = Math.min(delay, maxDelayMs);
  }
  
  return Math.floor(delay);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ClientError)) {
    return false;
  }
  
  // Network errors are generally retryable
  if (error.type === 'network') {
    return true;
  }
  
  // Rate limit errors are retryable
  if (error.type === 'api' && error.message.toLowerCase().includes('rate limit')) {
    return true;
  }
  
  // Timeout errors are retryable
  if (error.message.toLowerCase().includes('timeout')) {
    return true;
  }
  
  // 5xx server errors are retryable
  if (error.type === 'api' && error.message.match(/HTTP 5\d\d/)) {
    return true;
  }
  
  // Authentication and configuration errors are not retryable
  if (error.type === 'authentication' || error.type === 'configuration') {
    return false;
  }
  
  return false;
}

/**
 * Execute a function with retry logic
 * Ported from chatdelta-rs/src/utils.rs execute_with_retry
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig: RetryConfig = { ...defaultRetryConfig, ...config };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= fullConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry if this is the last attempt
      if (attempt >= fullConfig.maxAttempts) {
        break;
      }
      
      // Don't retry if the error is not retryable
      if (!isRetryableError(error)) {
        break;
      }
      
      // Calculate and apply delay
      const delay = calculateDelay(
        fullConfig.strategy,
        attempt,
        fullConfig.baseDelayMs,
        fullConfig.maxDelayMs
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Create a retry wrapper for a function
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  return (async (...args: Parameters<T>) => {
    return executeWithRetry(() => fn(...args), config);
  }) as T;
}