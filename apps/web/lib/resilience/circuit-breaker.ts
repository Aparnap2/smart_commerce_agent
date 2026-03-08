/**
 * Circuit Breaker Implementation
 * 
 * Provides circuit breaker pattern using opossum for resilience.
 * Wraps any async function to prevent cascade failures.
 * 
 * Default behavior:
 * - Opens circuit after 50% failure rate
 * - Returns degraded response (never throws to user)
 * - Resets after 30 seconds
 */

import CircuitBreaker from 'opossum';

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Timeout in milliseconds for each request */
  timeout?: number;
  /** Error threshold percentage to open circuit (0-100) */
  errorThresholdPercentage?: number;
  /** Time in milliseconds to wait before resetting */
  resetTimeout?: number;
  /** Volume threshold - minimum calls before circuit can open */
  volumeThreshold?: number;
}

/**
 * Degraded response type
 */
export interface DegradedResponse {
  content: string;
  degraded: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 10,
};

/**
 * Create a circuit breaker wrapper around any async function
 * 
 * @param fn - The async function to wrap
 * @param options - Circuit breaker options
 * @returns Circuit breaker instance with .fire() method
 */
export function createCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: CircuitBreakerOptions = {}
): CircuitBreaker {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const breaker = new CircuitBreaker(fn, {
    timeout: opts.timeout,
    errorThresholdPercentage: opts.errorThresholdPercentage,
    resetTimeout: opts.resetTimeout,
    volumeThreshold: opts.volumeThreshold,
  });

  // Set up fallback to return degraded response instead of throwing
  breaker.fallback(() => {
    const response: DegradedResponse = {
      content: "I'm having trouble right now. Please try again in a moment.",
      degraded: true,
    };
    return Promise.resolve(response);
  });

  return breaker;
}

/**
 * Wrap a function with circuit breaker and return a new function
 * 
 * @param fn - The async function to wrap
 * @param options - Circuit breaker options
 * @returns A new function that includes circuit breaker logic
 */
export function wrapWithCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: CircuitBreakerOptions = {}
): (() => Promise<unknown>) {
  const breaker = createCircuitBreaker(fn, options);
  return () => breaker.fire();
}

/**
 * Circuit Breaker Manager
 * 
 * Manages multiple circuit breakers for different services.
 * Provides singleton instances per service name.
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = options;
  }

  /**
   * Get or create a circuit breaker for a service
   * 
   * @param serviceName - Unique identifier for the service
   * @param fn - The function to wrap (only used on first call)
   * @returns Circuit breaker instance
   */
  getOrCreate<T extends (...args: unknown[]) => Promise<unknown>>(
    serviceName: string,
    fn: T
  ): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const breaker = createCircuitBreaker(fn, this.options);
      this.breakers.set(serviceName, breaker);
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all registered circuit breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get status of a specific circuit breaker
   */
  getStatus(serviceName: string): {
    enabled: boolean;
    status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
  } | null {
    const breaker = this.breakers.get(serviceName);
    if (!breaker) return null;

    return {
      enabled: true,
      status: breaker.status.status,
      failures: breaker.status.failures,
    };
  }

  /**
   * Clear a specific circuit breaker
   */
  clear(serviceName: string): void {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.destroy();
      this.breakers.delete(serviceName);
    }
  }

  /**
   * Clear all circuit breakers
   */
  clearAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.destroy();
    }
    this.breakers.clear();
  }
}

/**
 * Singleton circuit breaker manager instance
 */
let managerInstance: CircuitBreakerManager | null = null;

/**
 * Get the global circuit breaker manager
 */
export function getCircuitBreakerManager(): CircuitBreakerManager {
  if (!managerInstance) {
    managerInstance = new CircuitBreakerManager();
  }
  return managerInstance;
}

/**
 * Create a circuit breaker for LLM calls
 * Pre-configured for Azure AI Foundry
 */
export function createLLMCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): CircuitBreaker {
  return createCircuitBreaker(fn, {
    timeout: 30000, // Longer timeout for LLM calls
    errorThresholdPercentage: 50,
    resetTimeout: 60000, // 1 minute reset for LLM
    volumeThreshold: 3,
  });
}

/**
 * Create a circuit breaker for database calls
 */
export function createDBCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): CircuitBreaker {
  return createCircuitBreaker(fn, {
    timeout: 5000,
    errorThresholdPercentage: 30, // More sensitive for DB
    resetTimeout: 30000,
    volumeThreshold: 5,
  });
}
