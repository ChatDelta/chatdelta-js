import { ClientError, ClientErrorType } from './error';
import { RetryStrategy } from './types';

/**
 * Configuration for retry behavior
 * @interface RetryConfig
 */
export interface RetryConfig {
  strategy: RetryStrategy;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
}

/**
 * Default retry configuration
 * @constant {RetryConfig}
 */
export const defaultRetryConfig: RetryConfig = {
  strategy: RetryStrategy.ExponentialBackoff,
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Calculate delay based on retry strategy
 * @param {RetryStrategy} strategy - The retry strategy to use
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelayMs - Base delay in milliseconds
 * @param {number} [maxDelayMs] - Maximum delay cap
 * @returns {number} Calculated delay in milliseconds
 * @private
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
 * Check if an error is retryable.
 * Network errors, rate limits, timeouts, and 5xx errors are retryable.
 * Authentication and configuration errors are not retryable.
 * 
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ClientError)) {
    return false;
  }
  
  // Network errors are generally retryable
  if (error.type === ClientErrorType.Network) {
    return true;
  }
  
  // Rate limit errors are retryable
  if (error.type === ClientErrorType.Api && error.message.toLowerCase().includes('rate limit')) {
    return true;
  }
  
  // Timeout errors are retryable
  if (error.message.toLowerCase().includes('timeout')) {
    return true;
  }
  
  // 5xx server errors are retryable
  if (error.type === ClientErrorType.Api && error.message.match(/HTTP 5\d\d/)) {
    return true;
  }
  
  // Authentication and configuration errors are not retryable
  if (error.type === ClientErrorType.Authentication || error.type === ClientErrorType.Configuration) {
    return false;
  }
  
  return false;
}

/**
 * Execute a function with retry logic using the specified strategy.
 * Will retry on retryable errors up to maxAttempts times.
 * 
 * @template T - Return type of the function
 * @param {() => Promise<T>} fn - The async function to execute
 * @param {Partial<RetryConfig>} [config={}] - Retry configuration
 * @returns {Promise<T>} The result of the function
 * @throws {Error} The last error if all retries fail
 * 
 * @example
 * ```typescript
 * const result = await executeWithRetry(
 *   () => client.sendPrompt('Hello'),
 *   { maxAttempts: 5, strategy: RetryStrategy.ExponentialWithJitter }
 * );
 * ```
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
 * Create a retry wrapper for a function.
 * Returns a new function that automatically retries on failure.
 * 
 * @template T - Function type
 * @param {T} fn - The async function to wrap
 * @param {Partial<RetryConfig>} [config={}] - Retry configuration
 * @returns {T} A wrapped function with retry logic
 * 
 * @example
 * ```typescript
 * const sendPromptWithRetry = withRetry(
 *   client.sendPrompt.bind(client),
 *   { maxAttempts: 3 }
 * );
 * 
 * const response = await sendPromptWithRetry('Hello');
 * ```
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  return (async (...args: Parameters<T>) => {
    return executeWithRetry(() => fn(...args), config);
  }) as T;
}