import { useEffect, useState, useCallback } from 'react';
import { useNetworkState } from './useNetworkState';

/**
 * Hook untuk manage Offline/Online Mode
 * - Auto-detect network state dengan fallback checks
 * - Cache freshness monitoring
 * - Sync status tracking
 * - Error recovery mechanism
 * 
 * Production-ready features:
 * - Graceful degradation saat offline
 * - Auto-retry saat online kembali
 * - Data freshness warnings
 * - Comprehensive sync status
 */
export const useOfflineMode = () => {
  const { isOnline } = useNetworkState();
  
  // State
  const [cacheAge, setCacheAge] = useState(null); // Hours
  const [cacheSize, setCacheSize] = useState(0); // Items
  const [lastSyncFailed, setLastSyncFailed] = useState(false);
  const [syncRetrying, setSyncRetrying] = useState(false);
  
  // Derive mode from isOnline (no setState needed in effect)
  const mode = isOnline ? 'online' : 'offline';

  /**
   * Monitor cache freshness
   */
  const checkCacheFreshness = useCallback(async () => {
    try {
      const cacheMetadata = localStorage.getItem('productCacheMetadata');
      if (!cacheMetadata) {
        setCacheAge(null);
        setCacheSize(0);
        return;
      }
      
      const { timestamp, count } = JSON.parse(cacheMetadata);
      const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
      
      setCacheAge(ageHours);
      setCacheSize(count);
      
      if (ageHours > 24) {
        console.warn(`⚠️ Cache outdated (${ageHours.toFixed(1)} hours old)`);
      }
    } catch (err) {
      console.error('Error checking cache freshness:', err);
    }
  }, []);

  /**
   * Get offline mode info
   */
  const getOfflineModeInfo = useCallback(() => {
    const isFresh = cacheAge !== null && cacheAge < 24;
    const hasCache = cacheSize > 0;
    const canWorkOffline = hasCache && isFresh;
    
    return {
      mode,
      isOnline,
      hasCache,
      cacheSize,
      cacheAge,
      isFresh,
      canWorkOffline,
      lastSyncFailed,
      syncRetrying,
      status: {
        indicator: isOnline ? '🟢' : '🔴',
        message: isOnline 
          ? (cacheAge === null ? 'Online - No cached data' : `Online - Cache ${cacheAge.toFixed(1)}h old`)
          : (hasCache ? (isFresh ? 'Offline - Using fresh cache' : 'Offline - Cache is outdated') : 'Offline - No cached data'),
        canOperate: isOnline || canWorkOffline
      }
    };
  }, [mode, isOnline, cacheSize, cacheAge, lastSyncFailed, syncRetrying]);

  /**
   * Trigger retry sync saat online
   */
  const retrySync = useCallback(() => {
    if (!isOnline) {
      return;
    }
    
    setSyncRetrying(true);
    
    // Dispatch event untuk trigger useProductSync retry
    window.dispatchEvent(new CustomEvent('syncRetry', {
      detail: { forceFresh: true }
    }));
    
    // Auto-reset retry flag after 5 seconds
    setTimeout(() => setSyncRetrying(false), 5000);
  }, [isOnline]);

  /**
   * Mark sync as failed (untuk UI feedback)
   */
  const markSyncFailed = useCallback(() => {
    setLastSyncFailed(true);
    setTimeout(() => setLastSyncFailed(false), 10000); // Clear after 10s
  }, []);

  /**
   * Monitor cache freshness (async effect)
   * Note: checkCacheFreshness is defined below, so we can safely exclude it from deps
   * since it only calls setState which is stable
   */
  useEffect(() => {
    // Use async IIFE to avoid setState cascading
    const initCacheCheck = async () => {
      try {
        const cacheMetadata = localStorage.getItem('productCacheMetadata');
        if (!cacheMetadata) {
          setCacheAge(null);
          setCacheSize(0);
          return;
        }
        
        const { timestamp, count } = JSON.parse(cacheMetadata);
        const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
        
        setCacheAge(ageHours);
        setCacheSize(count);
        
        if (ageHours > 24) {
          console.warn(`⚠️ Cache outdated (${ageHours.toFixed(1)} hours old)`);
        }
      } catch (err) {
        console.error('Error checking cache freshness:', err);
      }
    };
    
    initCacheCheck();
    
    // Re-check every 5 minutes
    const interval = setInterval(initCacheCheck, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    ...getOfflineModeInfo(),
    checkCacheFreshness,
    retrySync,
    markSyncFailed
  };
};

export default useOfflineMode;
