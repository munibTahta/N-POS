import { useEffect, useRef } from 'react';

/**
 * Hook for managing AbortController lifecycle
 * Automatically aborts pending requests when component unmounts
 * 
 * Usage:
 * const abort = useAbortController();
 * 
 * useEffect(() => {
 *   fetch('/api/data', { signal: abort.signal })
 *     .then(...);
 * }, [abort]);
 */
export const useAbortController = () => {
  const controllerRef = useRef(null);

  // Initialize controller safely in ref (safe pattern: checking if ref is null)
  if (controllerRef.current === null) {
    controllerRef.current = new AbortController();
  }

  useEffect(() => {
    return () => {
      // Abort any pending requests when component unmounts
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [controllerRef]);

  return {
    /**
     * AbortSignal to pass to fetch() or axios config
     */
    get signal() {
      return controllerRef.current.signal;
    },
    
    /**
     * Manually abort pending requests
     */
    abort: () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        // Create a new controller for potential future requests
        controllerRef.current = new AbortController();
      }
    },
    
    /**
     * Reset controller for fresh requests
     */
    reset: () => {
      controllerRef.current = new AbortController();
    },
    
    /**
     * Check if requests have been aborted
     */
    isAborted() {
      return controllerRef.current?.signal?.aborted ?? false;
    }
  };
};

export default useAbortController;
