import React, { useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
import OfflineQueue from '../utils/OfflineQueue';

/**
 * DetailedSyncStatus Component
 * Shows real-time sync progress with detailed metrics
 * 
 * Displays:
 * - Queued, synced, failed counts
 * - Current endpoint being processed
 * - Overall progress percentage
 * - ETA for completion
 */
export const DetailedSyncStatus = () => {
  const { getSyncInfo } = useSync();
  const [syncStatus, setSyncStatus] = useState({
    queued: 0,
    synced: 0,
    failed: 0,
    currentEndpoint: '',
    estimatedTime: 0,
    progressPercent: 0,
    byStatus: {
      pending: 0,
      retry: 0,
      success: 0,
      failed: 0
    }
  });

  const [isVisible, setIsVisible] = useState(false);

  /**
   * Update sync status setiap 500ms
   */
  useEffect(() => {
    const updateStatus = async () => {
      try {
        const queueStatus = await OfflineQueue.getSyncStatus();
        
        if (!queueStatus || queueStatus.total === 0) {
          setIsVisible(false);
          return;
        }

        setIsVisible(true);

        const syncInfo = getSyncInfo?.();
        const totalQueued = queueStatus.pending + queueStatus.retry;
        const totalProcessed = queueStatus.success + queueStatus.failed;
        const progressPercent = queueStatus.total > 0 
          ? Math.round((totalProcessed / queueStatus.total) * 100) 
          : 0;

        // Estimate time (assuming ~200ms per request)
        const estimatedTime = Math.ceil(totalQueued * 0.2);

        setSyncStatus({
          queued: totalQueued,
          synced: queueStatus.success,
          failed: queueStatus.failed,
          currentEndpoint: syncInfo?.currentEndpoint || 'idle',
          estimatedTime,
          progressPercent,
          byStatus: {
            pending: queueStatus.pending,
            retry: queueStatus.retry,
            success: queueStatus.success,
            failed: queueStatus.failed
          },
          total: queueStatus.total
        });
      } catch (error) {
        console.error('Error updating sync status:', error);
        // Set visible to false on error and reset status
        setIsVisible(false);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 500);

    return () => clearInterval(interval);
  }, [getSyncInfo]);

  if (!isVisible) {
    return null;
  }

  const hasFailures = syncStatus.failed > 0;

  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-sm">
      {/* Main Status Card */}
      <div className={`
        rounded-lg shadow-xl border-2 overflow-hidden transition-all
        ${hasFailures 
          ? 'bg-red-50 border-red-300' 
          : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300'
        }
      `}>
        {/* Header */}
        <div className={`
          px-4 py-3 font-semibold text-white
          ${hasFailures ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}
        `}>
          <p className="text-sm">
            {syncStatus.currentEndpoint && syncStatus.currentEndpoint !== 'idle'
              ? `🔄 Syncing...`
              : `📊 Sync Status`
            }
          </p>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 font-medium">Progress</span>
            <span className="font-bold text-gray-800">
              {syncStatus.progressPercent}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`
                h-full rounded-full transition-all duration-300 
                ${hasFailures 
                  ? 'bg-gradient-to-r from-red-400 to-orange-400' 
                  : 'bg-gradient-to-r from-blue-400 to-indigo-500'
                }
              `}
              style={{ width: `${syncStatus.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="px-4 py-3 grid grid-cols-4 gap-2">
          {/* Synced */}
          <div className="bg-white bg-opacity-70 p-2 rounded border border-green-200">
            <p className="text-xs text-gray-500 font-medium">Synced</p>
            <p className="text-lg font-bold text-green-600">{syncStatus.synced}</p>
            <p className="text-xs text-green-700">{syncStatus.byStatus.success}✓</p>
          </div>

          {/* Queued */}
          <div className="bg-white bg-opacity-70 p-2 rounded border border-blue-200">
            <p className="text-xs text-gray-500 font-medium">Queued</p>
            <p className="text-lg font-bold text-blue-600">{syncStatus.queued}</p>
            <p className="text-xs text-blue-700">{syncStatus.byStatus.pending}⏳</p>
          </div>

          {/* Failed */}
          <div className={`
            bg-white bg-opacity-70 p-2 rounded border-2
            ${hasFailures ? 'border-red-300' : 'border-gray-200'}
          `}>
            <p className="text-xs text-gray-500 font-medium">Failed</p>
            <p className={`text-lg font-bold ${hasFailures ? 'text-red-600' : 'text-gray-600'}`}>
              {syncStatus.failed}
            </p>
            <p className={`text-xs ${hasFailures ? 'text-red-700' : 'text-gray-600'}`}>
              {syncStatus.byStatus.retry}🔄
            </p>
          </div>

          {/* ETA */}
          <div className="bg-white bg-opacity-70 p-2 rounded border border-amber-200">
            <p className="text-xs text-gray-500 font-medium">ETA</p>
            <p className="text-lg font-bold text-amber-600">
              {syncStatus.estimatedTime}s
            </p>
            <p className="text-xs text-amber-700">~{Math.ceil(syncStatus.queued / 50)}b</p>
          </div>
        </div>

        {/* Current Operation */}
        {syncStatus.currentEndpoint && syncStatus.currentEndpoint !== 'idle' && (
          <div className="px-4 py-2 border-t border-gray-300 bg-white bg-opacity-50">
            <p className="text-xs text-gray-700">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse" />
              <span className="font-semibold">Processing:</span>
              <span className="text-blue-700 ml-1 truncate">{syncStatus.currentEndpoint}</span>
            </p>
          </div>
        )}

        {/* Status Messages */}
        {syncStatus.queued === 0 && syncStatus.failed === 0 && (
          <div className="px-4 py-2 border-t border-green-300 bg-green-50">
            <p className="text-xs text-green-800 font-medium">✅ All synced!</p>
          </div>
        )}

        {hasFailures && (
          <div className="px-4 py-2 border-t border-red-300 bg-red-50">
            <p className="text-xs text-red-800 font-medium">
              ⚠️ {syncStatus.failed} failed - will retry automatically
            </p>
          </div>
        )}

        {/* Summary Stats */}
        <div className="px-4 py-2 bg-gray-100 border-t border-gray-300">
          <div className="text-xs text-gray-700 space-y-0.5">
            <p>📊 Total: <span className="font-bold">{syncStatus.total}</span> requests</p>
            <p>✓ Success rate: <span className="font-bold text-green-600">
              {syncStatus.total > 0 ? Math.round((syncStatus.synced / syncStatus.total) * 100) : 0}%
            </span></p>
          </div>
        </div>
      </div>

      {/* Info Badge */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        Real-time sync monitor
      </div>
    </div>
  );
};

export default DetailedSyncStatus;
