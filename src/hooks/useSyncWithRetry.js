/**
 * Hook untuk sync dengan retry logic
 * - Exponential backoff (1s, 2s, 4s, 8s, 16s)
 * - Max 5 retries
 * - Smart error handling
 */

import { useCallback, useState, useRef } from 'react';

export const useSyncWithRetry = (syncFn) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState(null);
  const retryTimeoutRef = useRef(null);

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const getBackoffDelay = (attempt) => {
    return Math.min(1000 * Math.pow(2, attempt), 16000);
  };

  const syncWithRetry = useCallback(async (maxRetries = 5) => {
    if (isSyncing) return { success: false, reason: 'Already syncing' };

    setIsSyncing(true);
    setRetryCount(0);
    setLastError(null);

    let lastErr = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const result = await syncFn();
        setIsSyncing(false);
        setRetryCount(0);
        return { success: true, result };
      } catch (err) {
        lastErr = err;
        attempt++;

        // Retry only on network errors, not validation errors
        const isNetworkError = 
          err.code === 'ECONNABORTED' ||
          err.code === 'ENOTFOUND' ||
          err.message === 'Network Error' ||
          err.response?.status >= 500;

        if (attempt <= maxRetries && isNetworkError) {
          const delay = getBackoffDelay(attempt - 1);
          setRetryCount(attempt);
          setLastError(`Retry attempt ${attempt}/${maxRetries} in ${delay}ms...`);
          
          console.warn(`Sync failed, retry ${attempt}/${maxRetries} after ${delay}ms:`, err.message);
          
          // Wait before retry
          await sleep(delay);
        } else {
          // Don't retry for validation errors or max retries reached
          break;
        }
      }
    }

    // All retries failed
    setIsSyncing(false);
    setLastError(`Sync failed after ${attempt} attempts: ${lastErr?.message || 'Unknown error'}`);
    console.error('Sync failed after all retries:', lastErr);
    
    return {
      success: false,
      error: lastErr,
      attempts: attempt,
      reason: lastErr?.message
    };
  }, [syncFn, isSyncing]);

  const resetRetry = useCallback(() => {
    setRetryCount(0);
    setLastError(null);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
  }, []);

  return {
    syncWithRetry,
    isSyncing,
    retryCount,
    lastError,
    resetRetry
  };
};

export default useSyncWithRetry;
