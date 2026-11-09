import React, { createContext, useContext, useState, useEffect } from 'react';
import syncEngine from '../services/syncEngine';
import networkStateService from '../services/NetworkStateService';

const SyncContext = createContext();

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

export const SyncProvider = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState({
    // Sourced from NetworkStateService (real health-check ping), not raw
    // navigator.onLine — this flag drives whether PosPage takes the durable
    // offline-queue checkout path or the direct-online path, so it must
    // reflect actual reachability, not just "device has a network interface".
    isOnline: networkStateService.isOnline,
    syncInProgress: false,
    lastSyncTime: null,
    pendingCount: 0,
    failedCount: 0
  });
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [lastStatusUpdate, setLastStatusUpdate] = useState(0);

  useEffect(() => {
    const updateSyncStatus = async () => {
      // Debounce: Skip if updated within last 5 seconds
      const now = Date.now();
      if (now - lastStatusUpdate < 5000) {
        return;
      }
      setLastStatusUpdate(now);

      let pendingCount = 0;
      let failedCount = 0;
      let lastSyncTime = null;

      // Get sync queue data via IPC
      if (window.electronAPI?.dbGetSyncQueue) {
        try {
          const queue = await window.electronAPI.dbGetSyncQueue();
          pendingCount = queue.length;
        } catch (error) {
          console.error('Failed to get sync queue:', error);
          // If database connection is not open (e.g., during backup/restore), skip this update
          if (error.message && error.message.includes('database connection is not open')) {
            return;
          }
        }
      }

      // Get failed items
      if (window.electronAPI?.dbSelect) {
        try {
          const failed = await window.electronAPI.dbSelect({
            table: 'sync_queue',
            whereClause: "status = 'failed'"
          });
          failedCount = failed.length;
        } catch (error) {
          console.error('Failed to get failed sync items:', error);
          // If database connection is not open (e.g., during backup/restore), skip this update
          if (error.message && error.message.includes('database connection is not open')) {
            return;
          }
        }
      }

      // Get last sync time
      if (window.electronAPI?.dbGetSyncMetadata) {
        try {
          lastSyncTime = await window.electronAPI.dbGetSyncMetadata({ key: 'last_sync_time' });
        } catch (error) {
          console.error('Failed to get last sync time:', error);
          // If database connection is not open (e.g., during backup/restore), skip this update
          if (error.message && error.message.includes('database connection is not open')) {
            return;
          }
        }
      }

      setSyncStatus(prev => ({
        ...prev,
        pendingCount,
        failedCount,
        lastSyncTime
      }));
    };

    // Follow NetworkStateService's health-checked status rather than raw
    // browser online/offline events (which can misfire — e.g. "online"
    // while connected to a wifi with no real internet).
    const unsubscribeNetwork = networkStateService.subscribe(({ isOnline }) => {
      setSyncStatus(prev => ({ ...prev, isOnline }));
      if (isOnline) updateSyncStatus();
    });

    // Update sync status periodically (increased from 2s to 10s interval)
    const interval = setInterval(updateSyncStatus, 10000);

    // Initial update
    updateSyncStatus();

    return () => {
      clearInterval(interval);
      unsubscribeNetwork();
    };
  }, [lastStatusUpdate]);

  const performSync = async () => {
    if (!syncStatus.isOnline) {
      throw new Error('Tidak dapat sync saat offline');
    }

    if (isManualSyncing) {
      throw new Error('Sync sedang berlangsung');
    }

    setIsManualSyncing(true);
    setSyncStatus(prev => ({ ...prev, syncInProgress: true }));

    try {
      // Validate IPC availability
      if (!window.electronAPI) {
        throw new Error('IPC tidak tersedia');
      }

      if (!window.electronAPI.dbGetSyncQueue || !window.electronAPI.dbUpdateSyncStatus) {
        throw new Error('Database API tidak tersedia');
      }

      await syncEngine.forceSync();

      // Get fresh sync info from database after successful sync
      let lastSyncTime = null;
      let pendingCount = 0;
      let failedCount = 0;

      if (window.electronAPI?.dbGetSyncMetadata) {
        try {
          lastSyncTime = await window.electronAPI.dbGetSyncMetadata({ key: 'last_sync_time' });
        } catch (error) {
          console.error('Failed to get last sync time after sync:', error);
        }
      }

      if (window.electronAPI?.dbGetSyncQueue) {
        try {
          const queue = await window.electronAPI.dbGetSyncQueue();
          pendingCount = queue.length;
        } catch (error) {
          console.error('Failed to get pending count after sync:', error);
        }
      }

      if (window.electronAPI?.dbSelect) {
        try {
          const failed = await window.electronAPI.dbSelect({
            table: 'sync_queue',
            whereClause: "status = 'failed'"
          });
          failedCount = failed.length;
        } catch (error) {
          console.error('Failed to get failed count after sync:', error);
        }
      }

      // Update sync status with fresh data from database
      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime,
        pendingCount,
        failedCount,
        syncInProgress: false
      }));

      return { success: true, message: 'Sync berhasil!' };
    } catch (error) {
      console.error('Manual sync failed:', error);
      setSyncStatus(prev => ({
        ...prev,
        syncInProgress: false,
        failedCount: prev.failedCount + 1
      }));

      // Provide user-friendly error messages
      let errorMessage = 'Sync gagal';
      if (error.message.includes('network')) {
        errorMessage = 'Koneksi internet bermasalah';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout - server tidak merespons';
      } else if (error.message.includes('unauthorized')) {
        errorMessage = 'Akses ditolak - periksa kredensial';
      }

      return { success: false, message: `${errorMessage}: ${error.message}` };
    } finally {
      setIsManualSyncing(false);
    }
  };

  const getConnectionStatus = () => {
    return {
      isOnline: syncStatus.isOnline,
      statusText: syncStatus.isOnline ? 'Online' : 'Offline',
      statusColor: syncStatus.isOnline ? 'text-green-600' : 'text-red-600',
      icon: syncStatus.isOnline ? '●' : '●'
    };
  };

  const getSyncInfo = () => {
    return {
      lastSyncTime: syncStatus.lastSyncTime,
      pendingCount: syncStatus.pendingCount,
      failedCount: syncStatus.failedCount,
      isSyncing: syncStatus.syncInProgress || isManualSyncing
    };
  };

  const value = {
    isOnline: syncStatus.isOnline,  // Expose isOnline directly
    syncStatus,
    performSync,
    getConnectionStatus,
    getSyncInfo,
    isManualSyncing,
    isSyncLocked: () => syncEngine.isSyncLocked()
  };

  return React.createElement(SyncContext.Provider, { value }, children);
};