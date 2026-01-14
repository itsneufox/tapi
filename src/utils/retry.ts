import { logger } from './logger';

export interface RetryOptions {
  /** Maximum number of attempts (default: 5) */
  maxAttempts?: number;
  /** Base delay in milliseconds (default: 250) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 4000) */
  maxDelay?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Status codes that should trigger a retry (default: 429, 500-599) */
  retryableStatusCodes?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 5,
  baseDelay: 250,
  maxDelay: 4000,
  jitter: true,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  // Exponential backoff: baseDelay * 2^(attempt-1)
  let delay = options.baseDelay * Math.pow(2, attempt - 1);

  // Cap at maxDelay
  delay = Math.min(delay, options.maxDelay);

  // Add jitter (0-200ms random)
  if (options.jitter) {
    delay += Math.random() * 200;
  }

  return delay;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a status code is retryable
 */
function isRetryableStatus(status: number, retryableCodes: number[]): boolean {
  return retryableCodes.includes(status) || (status >= 500 && status < 600);
}

/**
 * Fetch with automatic retries and exponential backoff
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      logger.routine(`Fetch attempt ${attempt}/${opts.maxAttempts}: ${url}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'tapi',
          ...options.headers,
        },
      });

      // Success
      if (response.ok) {
        return response;
      }

      // Check if we should retry
      if (!isRetryableStatus(response.status, opts.retryableStatusCodes)) {
        // Non-retryable error (4xx except 429)
        return response;
      }

      // Check for Retry-After header (rate limiting)
      const retryAfter = response.headers.get('Retry-After');
      let delay: number;

      if (retryAfter) {
        const retrySeconds = parseInt(retryAfter, 10);
        if (!isNaN(retrySeconds) && retrySeconds > 0 && retrySeconds <= 10) {
          delay = retrySeconds * 1000;
          logger.routine(
            `Rate limited, waiting ${retrySeconds}s (Retry-After header)`
          );
        } else {
          delay = calculateDelay(attempt, opts);
        }
      } else {
        delay = calculateDelay(attempt, opts);
      }

      if (attempt < opts.maxAttempts) {
        logger.routine(
          `Request failed with status ${response.status}, retrying in ${Math.round(delay)}ms...`
        );
        await sleep(delay);
      } else {
        // Last attempt failed
        lastError = new Error(
          `Request failed with status ${response.status} after ${opts.maxAttempts} attempts`
        );
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < opts.maxAttempts) {
        const delay = calculateDelay(attempt, opts);
        logger.routine(
          `Network error: ${lastError.message}, retrying in ${Math.round(delay)}ms...`
        );
        await sleep(delay);
      }
    }
  }

  throw (
    lastError || new Error(`Request failed after ${opts.maxAttempts} attempts`)
  );
}

/**
 * Download a file with retries, returning the response body as a readable stream
 */
export async function downloadWithRetry(
  url: string,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return fetchWithRetry(
    url,
    {
      headers: {
        Accept: 'application/octet-stream, application/*, */*',
      },
    },
    retryOptions
  );
}
