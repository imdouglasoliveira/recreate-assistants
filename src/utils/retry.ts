import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: number[]; // HTTP status codes
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [429, 500, 502, 503, 504],
};

/**
 * Execute a function with exponential backoff retry
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Do not retry if not a retryable error
      const statusCode = error?.status || error?.response?.status;
      if (statusCode && !opts.retryableErrors.includes(statusCode)) {
        throw error;
      }

      // Last attempt, do not retry
      if (attempt === opts.maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );

      logger.warn(
        `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`,
        { error: error.message, statusCode }
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
