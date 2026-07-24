/**
 * useTransactionQueue Hook
 * 
 * Provides React interface for transaction queue management
 * Handles queue processing, auto-sync on network restoration
 * Exposes stats and control methods to components
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetworkState } from './useNetworkState';
import {
  enqueueTransaction,
  getPendingTransactions,
  getQueueStats,
  markProcessing,
  markCompleted,
  markFailed,
  getTransaction,
  resetTransaction,
  getFailedTransactions,
  calculateRetryDelay,
  initializeTransactionQueue
} from '../utils/transactionQueue';

/**
 * Hook for managing offline transaction queue
 * 
 * Usage:
 * const {
 *   pendingCount,
 *   failedCount,
 *   isProcessing,
 *   enqueue,
 *   processQueue,
 *   retryFailed,
 *   stats
 * } = useTransactionQueue();
 */
export const useTransactionQueue = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  
  const { isOnline } = useNetworkState();
  const processingRef = useRef(false);
  const retryTimeoutRef = useRef(null);
  const processQueueRef = useRef(null);

  /**
   * Initialize queue on mount
   */
  useEffect(() => {
    const initQueue = async () => {
      await initializeTransactionQueue();
      await refreshStats();
    };
    
    initQueue().catch(err => {
      console.error('Failed to initialize queue:', err);
      setError(err.message);
    });

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [refreshStats]);

  /**
   * Auto-process queue when coming online
   */
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isProcessing && !processingRef.current) {
      processQueue().catch(err => {
        console.error('Auto-sync failed:', err);
      });
    }
  }, [isOnline, pendingCount, isProcessing, processQueue]);

  /**
   * Refresh queue statistics
   */
  const refreshStats = useCallback(async () => {
    try {
      const stats = await getQueueStats();
      setPendingCount(stats.pending);
      setCompletedCount(stats.completed);
      setFailedCount(stats.failed);
    } catch (err) {
      console.error('Failed to refresh stats:', err);
    }
  }, []);

  /**
   * Enqueue a new transaction
   */
  const enqueue = useCallback(
    async (transactionId, type, data, metadata = {}) => {
      try {
        setError(null);
        await enqueueTransaction(transactionId, type, data, metadata);
        await refreshStats();
        return true;
      } catch (err) {
        const errorMsg = err.message || 'Failed to enqueue transaction';
        console.error(errorMsg);
        setError(errorMsg);
        return false;
      }
    },
    [refreshStats]
  );

  /**
   * Process single transaction with retry logic
   */
  const processTransaction = useCallback(
    async (transaction, submitFn) => {
      try {
        await markProcessing(transaction.transaction_id);

        // Submit to API
        const response = await submitFn(
          JSON.parse(transaction.data),
          JSON.parse(transaction.metadata || '{}')
        );

        // Mark as completed
        await markCompleted(transaction.transaction_id, response);
        return true;
      } catch (err) {
        const errorMsg = err.message || 'Unknown error';
        console.error(`❌ Transaction failed: ${transaction.transaction_id}`, errorMsg);

        // Mark failed (will retry if under limit)
        await markFailed(transaction.transaction_id, errorMsg);

        // Schedule retry using ref callback (breaks circular dependency)
        if (transaction.retry_count < 5) {
          const delay = calculateRetryDelay(transaction.retry_count + 1);
          retryTimeoutRef.current = setTimeout(() => {
            // Call via ref to access latest processQueue without circular dependency
            if (processQueueRef.current) {
              processQueueRef.current().catch(err => console.error('Retry failed:', err));
            }
          }, delay);
        }

        return false;
      }
    },
    []
  );

  /**
   * Process all pending transactions
   * Requires submitFn to submit transaction to API
   * 
   * submitFn signature: async (transactionData, metadata) => response
   */
  const processQueue = useCallback(
    async (submitFn = null) => {
      if (processingRef.current || !isOnline) {
        return;
      }

      processingRef.current = true;
      setIsProcessing(true);

      try {
        const pending = await getPendingTransactions();
        
        if (pending.length === 0) {
          setLastSync(new Date());
          await refreshStats();
          return;
        }
        let successCount = 0;
        let failureCount = 0;

        for (const transaction of pending) {
          try {
            let success;

            if (submitFn && typeof submitFn === 'function') {
              // Use provided submit function
              success = await processTransaction(transaction, submitFn);
            } else {
              // Auto-submit to default endpoint
              const defaultSubmit = async (data) => {
                const response = await window.electronAPI.apiCall({
                  method: 'POST',
                  endpoint: `/api/${transaction.type}`,
                  data
                });
                return response;
              };

              success = await processTransaction(transaction, defaultSubmit);
            }

            if (success) {
              successCount++;
            } else {
              failureCount++;
            }
          } catch (err) {
            console.error(`Error processing transaction ${transaction.transaction_id}:`, err);
            failureCount++;
          }
        }
        setLastSync(new Date());
        await refreshStats();

      } catch (err) {
        const errorMsg = err.message || 'Failed to process queue';
        console.error('Queue processing error:', errorMsg);
        setError(errorMsg);
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    },
    [isOnline, processTransaction, refreshStats]
  );

  /**
   * Retry failed transactions
   */
  const retryFailed = useCallback(async () => {
    try {
      const failed = await getFailedTransactions();
      
      if (failed.length === 0) {
        return;
      }
      for (const transaction of failed) {
        // Reset to pending status
        await resetTransaction(transaction.transaction_id);
      }

      await refreshStats();

      // Auto-process if online
      if (isOnline) {
        await processQueue();
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to retry transactions';
      console.error(errorMsg);
      setError(errorMsg);
    }
  }, [isOnline, processQueue, refreshStats]);

  /**
   * Get details of specific transaction
   */
  const getTransactionDetails = useCallback(
    async (transactionId) => {
      try {
        return await getTransaction(transactionId);
      } catch (err) {
        console.error(`Failed to get transaction details: ${transactionId}`, err);
        return null;
      }
    },
    []
  );

  /**
   * Manually retry specific transaction
   */
  const retryTransaction = useCallback(
    async (transactionId) => {
      try {
        await resetTransaction(transactionId);
        await refreshStats();
        
        if (isOnline) {
          await processQueue();
        }
      } catch (err) {
        console.error(`Failed to retry transaction ${transactionId}:`, err);
        setError(err.message);
      }
    },
    [isOnline, processQueue, refreshStats]
  );

  return {
    // State
    pendingCount,
    completedCount,
    failedCount,
    isProcessing,
    error,
    lastSync,
    isOnline,

    // Actions
    enqueue,
    processQueue,
    retryFailed,
    retryTransaction,
    getTransactionDetails,
    refreshStats,

    // Combined stats
    totalCount: pendingCount + completedCount + failedCount,
    hasPending: pendingCount > 0,
    hasFailed: failedCount > 0,
    hasError: error !== null
  };
};

export default useTransactionQueue;
