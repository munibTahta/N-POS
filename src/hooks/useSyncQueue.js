/**
 * Hook untuk auto-sync offline queue saat online
 * Mendengarkan perubahan koneksi dan trigger sync otomatis
 */

import { useEffect, useState, useCallback } from 'react';
import OfflineQueue from '../utils/OfflineQueue';
import { apiClient } from '../services/api';
import { useNetworkState } from './useNetworkState';

export const useSyncQueue = () => {
  const { isOnline } = useNetworkState();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [queueSize, setQueueSize] = useState(0);

  // Get queue size
  const updateQueueSize = useCallback(async () => {
    const size = await OfflineQueue.size();
    setQueueSize(size);
  }, []);

  // Sync offline queue
  const syncQueue = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    setSyncStatus({ status: 'syncing', message: 'Menyinkronkan data offline...' });

    try {
      const result = await OfflineQueue.syncAll(apiClient);

      if (result.synced > 0) {
        setSyncStatus({
          status: 'success',
          message: `✅ Sinkronisasi berhasil: ${result.synced} data disimpan`,
          synced: result.synced,
          failed: result.failed
        });
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => {
          setSyncStatus(null);
        }, 3000);
      } else if (result.failed > 0) {
        setSyncStatus({
          status: 'partial',
          message: `⚠️ Sinkronisasi sebagian: ${result.failed} data gagal`,
          synced: result.synced,
          failed: result.failed
        });
      } else {
        setSyncStatus(null);
      }

      // Update queue size
      await updateQueueSize();
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus({
        status: 'error',
        message: '❌ Sinkronisasi gagal: ' + (error.message || 'Unknown error')
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updateQueueSize]);

  // Trigger sync when coming online
  useEffect(() => {
    updateQueueSize();

    if (isOnline && queueSize > 0) {
      // Delay slightly to ensure connection is stable
      const timeout = setTimeout(() => {
        syncQueue();
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [isOnline, queueSize, syncQueue, updateQueueSize]);

  // Manual sync trigger
  const manualSync = useCallback(async () => {
    await syncQueue();
  }, [syncQueue]);

  // Clear queue
  const clearQueue = useCallback(async () => {
    await OfflineQueue.clear();
    setQueueSize(0);
    setSyncStatus(null);
  }, []);

  return {
    isSyncing,
    syncStatus,
    queueSize,
    syncQueue: manualSync,
    clearQueue,
    isOnline
  };
};
