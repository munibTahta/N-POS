import { useEffect, useState, useCallback, useRef } from 'react';
import { useSync } from '../context/SyncContext';
import { useNetworkState } from './useNetworkState';
import offlineDataSync from '../services/offlineDataSync';

/**
 * Hook untuk initialize dan manage complete offline functionality
 * - Pre-cache essential data saat app load
 * - Setup offline storage dengan sync progress tracking
 * - Monitor sync status dengan percentage indicator
 * - Manage pending transactions
 * - Emit events untuk UI progress display
 */
export const useOfflineInitialization = () => {
  const { isOnline: isSyncOnline } = useSync();
  const { isOnline: isNetworkOnline } = useNetworkState();
  const isOnline = isSyncOnline || isNetworkOnline;
  const [offlineReady, setOfflineReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [cacheStats, setCacheStats] = useState(null);
  const [lastSync, setLastSync] = useState(localStorage.getItem('lastOfflineSync') || null);
  const [databaseReady, setDatabaseReady] = useState(false);
  const hasInitializedRef = useRef(false);

  /**
   * Wait for database to be ready (max 10 seconds)
   */
  const waitForDatabaseReady = useCallback(async () => {
    const maxAttempts = 20; // 20 * 500ms = 10 seconds
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        // Check if we have access to electronAPI (Electron environment)
        if (!window.electronAPI || !window.electronAPI.queryDbReady) {
          console.warn(`Database API not available (attempt ${attempts + 1}/${maxAttempts}) - Electron context missing`);
        } else {
          const status = await window.electronAPI.queryDbReady();
          if (status && status.ready) {
            setDatabaseReady(true);
            return true;
          }
        }
      } catch (err) {
        console.warn(`Database not ready yet (attempt ${attempts + 1}/${maxAttempts}):`, err.message);
      }
      
      // Wait 500ms before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    console.error('❌ Database failed to initialize after 10 seconds');
    return false;
  }, []);

  /**
   * Initialize offline storage on app load
   */
  useEffect(() => {
    const initializeOffline = async () => {
      // Prevent multiple initializations
      if (hasInitializedRef.current) return;
      hasInitializedRef.current = true;

      try {
        setIsInitializing(true);
        
        // CRITICAL: Wait for database to be ready before proceeding
        const dbReady = await waitForDatabaseReady();
        if (!dbReady) {
          throw new Error('Database initialization timeout - application may be unstable');
        }
        
        // Emit start event for UI
        window.dispatchEvent(new CustomEvent('initialSyncStart', { detail: { totalTables: 5 } }));
        
        // Initialize sync (first-time full sync or resume) - NOW database is guaranteed to be ready
        await offlineDataSync.initialize();
        
        // Get pending transactions count
        try {
          const pending = await offlineDataSync.getPendingTransactions();
          setPendingCount(pending?.length || 0);
        } catch (err) {
          console.warn('Could not get pending transactions:', err);
          setPendingCount(0);
        }
        
        // Get sync status
        const status = offlineDataSync.getStatus();
        setCacheStats(status);
        
        // Emit complete event
        window.dispatchEvent(new CustomEvent('syncComplete', {
          detail: {
            totalSynced: 5,
            totalFailed: 0,
            timestamp: new Date().toISOString()
          }
        }));
        
        setOfflineReady(true);
      } catch (error) {
        console.error('Error initializing offline mode:', error);
        window.dispatchEvent(new CustomEvent('syncError', {
          detail: { message: error.message }
        }));
        setOfflineReady(false);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeOffline();
  }, [waitForDatabaseReady]);

  /**
   * Update pending transactions count periodically
   */
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const pending = await offlineDataSync.getPendingTransactions();
        setPendingCount(pending?.length || 0);
        
        const status = offlineDataSync.getStatus();
        setCacheStats(status);
      } catch (error) {
        console.warn('Error updating pending count:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Update last sync time when online
   */
  useEffect(() => {
    if (isOnline && offlineReady) {
      const now = new Date().toISOString();
      localStorage.setItem('lastOfflineSync', now);
      setLastSync(now);
    }
  }, [isOnline, offlineReady]);

  /**
   * Store transaction in offline storage
   */
  const storeOfflineTransaction = useCallback(async (transactionData) => {
    try {
      const transaction = await offlineDataSync.storeOfflineTransaction(transactionData);
      
      // Update pending count
      const pending = await offlineDataSync.getPendingTransactions();
      setPendingCount(pending.length);
      
      return transaction;
    } catch (error) {
      console.error('Error storing offline transaction:', error);
      throw error;
    }
  }, []);

  /**
   * Get database statistics
   */
  const getStats = useCallback(async () => {
    try {
      return offlineDataSync.getStatus();
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }, []);

  /**
   * Get pending transactions
   */
  const getPending = useCallback(async () => {
    try {
      return await offlineDataSync.getPendingTransactions();
    } catch (error) {
      console.error('Error getting pending:', error);
      return [];
    }
  }, []);

  /**
   * Start a new sync
   */
  const startSync = useCallback(async () => {
    try {
      return await offlineDataSync.startFullSync();
    } catch (error) {
      console.error('Error starting sync:', error);
      return false;
    }
  }, []);

  return {
    offlineReady,
    isInitializing,
    pendingCount,
    cacheStats,
    lastSync,
    databaseReady,
    storeOfflineTransaction,
    getStats,
    getPending,
    startSync
  };
};

export default useOfflineInitialization;
