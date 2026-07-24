/**
 * Production-Level Request Retry Logic
 * Implements exponential backoff dan network-aware retries
 */

import networkStateService from '../services/NetworkStateService';
import { TIMEOUTS } from '../config/appConstants.js';

class RetryManager {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second
    this.maxDelay = 30000; // 30 seconds
  }

  /**
   * Calculate backoff delay with jitter
   */
  getBackoffDelay(attempt) {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attempt - 1),
      this.maxDelay
    );
    
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.max(delay + jitter, this.baseDelay);
  }

  /**
   * Retry a request with exponential backoff
   */
  async retryRequest(request, attempt = 1) {
    try {
      const response = await request();
      
      // Record success in network service
      networkStateService.recordSuccess();
      
      return response;
    } catch (error) {
      // Record failure
      networkStateService.recordFailure();

      // Don't retry if:
      // 1. Max retries reached
      // 2. Offline (unless it's a temporary network blip)
      // 3. Error is not retryable (4xx errors except specific ones)
      if (attempt >= this.maxRetries) {
        console.warn(`❌ Max retries reached for request`);
        throw error;
      }

      // Don't retry client errors (4xx) except timeout and specific cases
      if (error.response?.status >= 400 && error.response?.status < 500) {
        if (error.response.status !== 408 && error.response.status !== 429) {
          throw error;
        }
      }

      // Wait before retry
      const delay = this.getBackoffDelay(attempt);
      
      
      await this.delay(delay);

      // Recursive retry
      return this.retryRequest(request, attempt + 1);
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error) {
    // Network errors are retryable
    if (!error.response) {
      return true;
    }

    const status = error.response.status;
    
    // Retryable server errors
    if (status === 408) return true; // Request Timeout
    if (status === 429) return true; // Too Many Requests
    if (status >= 500) return true;  // Server errors

    return false;
  }

  /**
   * Check if error is a timeout error
   */
  isTimeoutError(error) {
    if (error.code === 'ECONNABORTED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    if (error.message?.includes('timeout')) return true;
    if (error.isTimeout === true) return true;
    if (error.response?.status === 408) return true;
    return false;
  }
}

export const retryManager = new RetryManager();

/**
 * Add retry logic to axios interceptor
 */
export const setupRetryInterceptor = (apiClient) => {
  apiClient.interceptors.response.use(
    response => response,
    async error => {
      const config = error.config;

      // Skip retry if:
      // - Already retried too many times
      // - Logout request
      // - Not retryable error
      if (
        config?.__retryCount >= retryManager.maxRetries ||
        config?.url?.includes('/logout') ||
        !retryManager.isRetryable(error)
      ) {
        return Promise.reject(error);
      }

      config.__retryCount = (config.__retryCount || 0) + 1;

      // Wait before retry
      const delay = retryManager.getBackoffDelay(config.__retryCount);
      await retryManager.delay(delay);

      

      return apiClient(config);
    }
  );
};

export default RetryManager;
