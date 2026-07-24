// src/utils/errorRecovery.js

import React from 'react';

// Error recovery and resilience utilities

// Retry mechanism with exponential backoff
export const retryWithBackoff = async (
  fn,
  maxRetries = 3,
  baseDelay = 1000,
  maxDelay = 30000,
  backoffFactor = 2
) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Don't retry certain types of errors
      if (error.name === 'ValidationError' || error.status === 400) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt), maxDelay);
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

// Circuit breaker pattern
export class CircuitBreaker {
  constructor(failureThreshold = 5, recoveryTimeout = 60000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Global circuit breaker instances
export const apiCircuitBreaker = new CircuitBreaker(5, 60000);
export const dbCircuitBreaker = new CircuitBreaker(3, 30000);

// Graceful degradation utilities
export const withGracefulDegradation = (primaryFn, fallbackFn) => {
  return async (...args) => {
    try {
      return await primaryFn(...args);
    } catch (error) {
      console.warn('Primary function failed, using fallback:', error.message);
      try {
        return await fallbackFn(...args);
      } catch (fallbackError) {
        console.error('Fallback function also failed:', fallbackError.message);
        throw fallbackError;
      }
    }
  };
};

// Error boundary state management
export class ErrorRecoveryManager {
  constructor() {
    this.errorStates = new Map();
    this.recoveryStrategies = new Map();
  }

  registerRecoveryStrategy(componentId, strategy) {
    this.recoveryStrategies.set(componentId, strategy);
  }

  async recover(componentId, error) {
    const strategy = this.recoveryStrategies.get(componentId);
    if (strategy) {
      try {
        await strategy(error);
        this.errorStates.delete(componentId);
        return true;
      } catch (recoveryError) {
        console.error(`Recovery failed for ${componentId}:`, recoveryError);
        return false;
      }
    }
    return false;
  }

  setErrorState(componentId, error) {
    this.errorStates.set(componentId, {
      error,
      timestamp: Date.now(),
      retryCount: 0
    });
  }

  getErrorState(componentId) {
    return this.errorStates.get(componentId);
  }

  clearErrorState(componentId) {
    this.errorStates.delete(componentId);
  }
}

export const errorRecoveryManager = new ErrorRecoveryManager();

// Network resilience utilities
export const resilientFetch = async (url, options = {}) => {
  const {
    timeout = 10000,
    retries = 3,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await retryWithBackoff(
      () => fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      }),
      retries,
      retryDelay
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }

    throw error;
  }
};

// Offline queue for failed operations
export class OfflineQueue {
  constructor() {
    this.queue = [];
    this.isOnline = navigator.onLine;
    this.processing = false;

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async add(operation) {
    this.queue.push({
      operation,
      timestamp: Date.now(),
      retries: 0
    });

    if (this.isOnline && !this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.processing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.isOnline) {
      const item = this.queue[0];

      try {
        await item.operation();
        this.queue.shift(); // Remove successfully processed item
      } catch (error) {
        item.retries++;

        if (item.retries >= 3) {
          console.error('Operation failed permanently:', error);
          this.queue.shift(); // Remove failed item
        } else {
          // Move to end of queue for retry
          this.queue.push(this.queue.shift());
          break; // Stop processing to avoid infinite loops
        }
      }
    }

    this.processing = false;
  }

  clear() {
    this.queue = [];
  }

  getQueueLength() {
    return this.queue.length;
  }
}

export const offlineQueue = new OfflineQueue();

// Data validation with recovery
export const validateAndRecover = (data, schema, recoveryFn = null) => {
  try {
    // Basic validation
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data structure');
    }

    // Schema validation (simplified)
    for (const [key, validator] of Object.entries(schema)) {
      if (data[key] === undefined) {
        if (validator.required) {
          throw new Error(`Missing required field: ${key}`);
        }
        continue;
      }

      if (typeof data[key] !== validator.type) {
        throw new Error(`Invalid type for field ${key}: expected ${validator.type}, got ${typeof data[key]}`);
      }
    }

    return data;
  } catch (error) {
    console.warn('Data validation failed:', error.message);

    if (recoveryFn) {
      try {
        return recoveryFn(data, error);
      } catch (recoveryError) {
        console.error('Data recovery failed:', recoveryError);
      }
    }

    throw error;
  }
};

// Component error recovery hook
export const useErrorRecovery = (componentId, recoveryStrategy = null) => {
  const [error, setError] = React.useState(null);
  const [isRecovering, setIsRecovering] = React.useState(false);

  React.useEffect(() => {
    if (recoveryStrategy) {
      errorRecoveryManager.registerRecoveryStrategy(componentId, recoveryStrategy);
    }
  }, [componentId, recoveryStrategy]);

  const handleError = React.useCallback(async (error) => {
    setError(error);
    errorRecoveryManager.setErrorState(componentId, error);

    if (recoveryStrategy) {
      setIsRecovering(true);
      try {
        const recovered = await errorRecoveryManager.recover(componentId, error);
        if (recovered) {
          setError(null);
        }
      } catch (recoveryError) {
        console.error('Error recovery failed:', recoveryError);
      } finally {
        setIsRecovering(false);
      }
    }
  }, [componentId, recoveryStrategy]);

  const clearError = React.useCallback(() => {
    setError(null);
    errorRecoveryManager.clearErrorState(componentId);
  }, [componentId]);

  return {
    error,
    isRecovering,
    handleError,
    clearError,
    errorState: errorRecoveryManager.getErrorState(componentId)
  };
};

// Health check utilities
export const healthCheck = async (serviceUrl, timeout = 5000) => {
  try {
    const response = await resilientFetch(`${serviceUrl}/health`, {
      timeout,
      retries: 1
    });
    return response.ok;
  } catch (error) {
    console.warn(`Health check failed for ${serviceUrl}:`, error.message);
    return false;
  }
};

// Service discovery with fallback
export const serviceDiscovery = async (serviceName, endpoints) => {
  for (const endpoint of endpoints) {
    try {
      const isHealthy = await healthCheck(endpoint);
      if (isHealthy) {
        return endpoint;
      }
    } catch (error) {
      console.warn(`Service ${serviceName} at ${endpoint} is unhealthy:`, error);
    }
  }

  throw new Error(`No healthy endpoints found for service ${serviceName}`);
};

// Error reporting with deduplication
class ErrorReporter {
  constructor() {
    this.reportedErrors = new Set();
    this.reportTimeout = 60000; // 1 minute
  }

  report(error, context = {}) {
    const errorKey = `${error.message}-${error.stack?.substring(0, 100)}`;

    if (this.reportedErrors.has(errorKey)) {
      return; // Already reported
    }

    this.reportedErrors.add(errorKey);

    // Report to error monitoring service
    console.error('Reporting error:', error, context);

    // Clear from reported errors after timeout
    setTimeout(() => {
      this.reportedErrors.delete(errorKey);
    }, this.reportTimeout);
  }
}

export const errorReporter = new ErrorReporter();

// Initialize error recovery
export const initializeErrorRecovery = () => {
  // Global error handlers
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    errorReporter.report(event.reason, { type: 'unhandledrejection' });
  });

  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    errorReporter.report(event.error, {
      type: 'global',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Monitor network status
  window.addEventListener('online', () => {
    offlineQueue.processQueue();
  });

  window.addEventListener('offline', () => {
    console.warn('Network connection lost');
  });
};