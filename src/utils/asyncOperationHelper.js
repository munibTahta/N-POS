/**
 * Safe fetch wrapper with AbortController support
 * Handles network errors, aborted requests, and provides proper cleanup
 */
export const safeFetch = async (url, options = {}) => {
  const { signal, timeout = 30000, ...fetchOptions } = options;
  
  // Create AbortController if not provided
  const controller = signal ? new (signal.constructor)() : new AbortController();
  
  // Set up timeout if specified
  let timeoutId = null;
  if (!signal && timeout) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: signal || controller.signal
    });
    
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`Fetch aborted for ${url}`);
      const abortError = new Error('Request was aborted');
      abortError.code = 'ABORT_ERR';
      throw abortError;
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

/**
 * Create axios config with abort signal
 * @param {AbortSignal} signal - AbortSignal from useAbortController
 * @returns {Object} Axios config object
 */
export const getAxiosAbortConfig = (signal) => ({
  signal,
  timeout: 30000
});

/**
 * Utility to handle async operations with cleanup
 * Prevents state updates after unmount
 */
export const createAsyncOperation = (asyncFn, isMountedRef) => {
  return async (...args) => {
    try {
      const result = await asyncFn(...args);
      // Only proceed if component is still mounted
      if (isMountedRef.current) {
        return result;
      }
    } catch (error) {
      // Only process error if component is still mounted
      if (isMountedRef.current) {
        throw error;
      }
    }
  };
};

/**
 * Hook-compatible version of isMounted ref
 * Usage: const isMounted = useIsMounted();
 */
export const createIsMountedRef = () => {
  const isMountedRef = { current: true };
  return isMountedRef;
};

export default {
  safeFetch,
  getAxiosAbortConfig,
  createAsyncOperation,
  createIsMountedRef
};
