import { useCallback, useRef, useState } from 'react';
import { TIMEOUTS } from '../config/appConstants.js';

/**
 * useSyncProgress Hook
 * Manages sync progress tracking and emits events for UI consumption
 * - Tracks per-table progress
 * - Computes overall percentage from parallel syncs
 * - Handles retry logic with exponential backoff
 * - Emits window events for component updates
 */
export const useSyncProgress = (_enabled = false) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const tableProgressRef = useRef({});
  const retryCountRef = useRef({});

  // Emit progress event
  const emitProgress = useCallback((eventType, detail) => {
    window.dispatchEvent(
      new CustomEvent(eventType, { detail })
    );
  }, []);

  // Calculate progress from multiple table syncs
  const calculateOverallProgress = useCallback(() => {
    const tables = Object.values(tableProgressRef.current);
    if (tables.length === 0) return 0;
    
    const totalPercent = tables.reduce((sum, t) => sum + (t.percent || 0), 0);
    return Math.round(totalPercent / tables.length);
  }, []);

  // Update table progress and emit event
  const updateTableProgress = useCallback((tableName, completed, total) => {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    tableProgressRef.current[tableName] = {
      completed,
      total,
      percent,
      lastUpdated: Date.now()
    };

    emitProgress('tableSyncProgress', {
      tableName,
      completed,
      total,
      percent
    });

    // Update overall progress
    const overallProgress = calculateOverallProgress();
    setProgress(overallProgress);

    return percent;
  }, [calculateOverallProgress, emitProgress]);

  // Sync table data with retry logic
  const syncTableData = useCallback(async (
    tableName,
    fetchFn,
    options = {}
  ) => {
    const { maxRetries = 3, delayMs = 1000 } = options;
    const retryKey = `${tableName}_retries`;
    retryCountRef.current[retryKey] = 0;

    const attemptSync = async (attempt = 0) => {
      try {
        // Add timeout to prevent fetch from hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Sync timeout for ${tableName} after ${TIMEOUTS.API_TIMEOUT}ms`)), TIMEOUTS.API_TIMEOUT)
        );
        
        const data = await Promise.race([fetchFn(), timeoutPromise]);
        const total = Array.isArray(data) ? data.length : Object.keys(data).length;
        
        // Update progress
        updateTableProgress(tableName, total, total);
        
        // Clear retry count on success
        retryCountRef.current[retryKey] = 0;
        
        return {
          success: true,
          tableName,
          itemsCount: total,
          data
        };
      } catch (error) {
        if (attempt < maxRetries) {
          // Exponential backoff
          const backoffDelay = delayMs * Math.pow(2, attempt);
          console.warn(
            `Retry ${attempt + 1}/${maxRetries} for ${tableName} after ${backoffDelay}ms`,
            error.message
          );
          
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return attemptSync(attempt + 1);
        }

        emitProgress('syncError', {
          table: tableName,
          message: error.message || `Failed to sync ${tableName}`
        });

        return {
          success: false,
          tableName,
          error: error.message
        };
      }
    };

    return attemptSync();
  }, [updateTableProgress, emitProgress]);

  // Sync multiple tables in parallel with progress tracking
  const syncMultipleTables = useCallback(async (tableConfigs) => {
    setIsSyncing(true);
    tableProgressRef.current = {};
    
    emitProgress('initialSyncStart', {
      totalTables: tableConfigs.length
    });

    try {
      // Initialize progress for all tables
      tableConfigs.forEach(config => {
        tableProgressRef.current[config.name] = {
          completed: 0,
          total: 0,
          percent: 0
        };
      });

      // Sync all tables in parallel
      const results = await Promise.allSettled(
        tableConfigs.map(config =>
          syncTableData(config.name, config.fetchFn, config.options)
        )
      );

      // Process results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

      emitProgress('syncComplete', {
        totalTables: tableConfigs.length,
        totalSynced: successful.length,
        totalFailed: failed.length,
        timestamp: new Date().toISOString()
      });

      setIsSyncing(false);
      setProgress(100);

      return {
        success: failed.length === 0,
        totalSynced: successful.length,
        totalFailed: failed.length,
        results
      };
    } catch (error) {
      emitProgress('syncError', {
        message: 'Critical sync error: ' + error.message
      });
      setIsSyncing(false);
      
      return {
        success: false,
        error: error.message
      };
    }
  }, [syncTableData, emitProgress]);

  // Reset sync state
  const reset = useCallback(() => {
    setIsSyncing(false);
    setProgress(0);
    tableProgressRef.current = {};
    retryCountRef.current = {};
  }, []);

  // Get current sync status
  const getStatus = useCallback(() => ({
    isSyncing,
    progress,
    tableProgress: tableProgressRef.current,
    retryCount: retryCountRef.current
  }), [isSyncing, progress]);

  return {
    isSyncing,
    progress,
    syncTableData,
    syncMultipleTables,
    updateTableProgress,
    reset,
    getStatus
  };
};

export default useSyncProgress;
