import React, { useState, useEffect, useRef } from 'react';
import { useNetworkState } from '../hooks/useNetworkState';
import '../styles/InitialSyncProgress.css';

/**
 * InitialSyncProgress Component
 * Shows detailed sync progress on app initialization with non-blocking overlay
 * - Percentage-based progress tracking
 * - Per-table sync details
 * - Auto-dismiss when complete
 * - Allows user to continue working during sync
 */
export const InitialSyncProgress = () => {
  const { isOnline } = useNetworkState();
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, complete, error
  const [tableProgress, setTableProgress] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [estimatedTime, setEstimatedTime] = useState(0);
  const startTimeRef = useRef(null);
  const hasShownRef = useRef(false);

  // Listen for sync events from window
  useEffect(() => {
    const handleInitialSyncStart = (event) => {
      const { totalTables } = event.detail || {};
      
      // Only show if multiple tables or significant data
      if (totalTables && totalTables >= 3) {
        setIsVisible(true);
        setSyncStatus('syncing');
        setProgress(0);
        setErrorMessage('');
        setTableProgress({});
        startTimeRef.current = Date.now();
        hasShownRef.current = true;
      }
    };

    const handleTableSyncProgress = (event) => {
      const { tableName, completed, total } = event.detail || {};
      if (!tableName) return;

      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      setTableProgress(prev => ({
        ...prev,
        [tableName]: { completed, total, percent }
      }));

      // Calculate overall progress
      const allProgress = Object.values(tableProgress);
      if (allProgress.length > 0) {
        const totalPercent = Math.round(
          allProgress.reduce((sum, t) => sum + t.percent, 0) / allProgress.length
        );
        setProgress(totalPercent);
      }

      // Estimate time remaining
      if (startTimeRef.current) {
        const elapsedMs = Date.now() - startTimeRef.current;
        const estimatedTotalMs = (elapsedMs / Math.max(progress, 1)) * 100;
        const estimatedRemainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
        setEstimatedTime(Math.ceil(estimatedRemainingMs / 1000));
      }
    };

    const handleSyncComplete = (event) => {
      const { totalFailed } = event.detail || {};
      setSyncStatus('complete');
      setProgress(100);
      
      // Auto-hide after 2 seconds if successful
      if (totalFailed === 0) {
        setTimeout(() => {
          setIsVisible(false);
          setSyncStatus('idle');
        }, 2000);
      }
    };

    const handleSyncError = (event) => {
      const { message, table } = event.detail || {};
      setSyncStatus('error');
      setErrorMessage(message || `Failed to sync ${table}`);
    };

    window.addEventListener('initialSyncStart', handleInitialSyncStart);
    window.addEventListener('tableSyncProgress', handleTableSyncProgress);
    window.addEventListener('syncComplete', handleSyncComplete);
    window.addEventListener('syncError', handleSyncError);

    return () => {
      window.removeEventListener('initialSyncStart', handleInitialSyncStart);
      window.removeEventListener('tableSyncProgress', handleTableSyncProgress);
      window.removeEventListener('syncComplete', handleSyncComplete);
      window.removeEventListener('syncError', handleSyncError);
    };
  }, [progress, tableProgress]);

  if (!isVisible) return null;

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return '⏳';
      case 'complete':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📱';
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing data...';
      case 'complete':
        return 'Sync complete!';
      case 'error':
        return 'Sync error';
      default:
        return 'Preparing...';
    }
  };

  const syncedTables = Object.keys(tableProgress).filter(k => tableProgress[k].percent === 100);
  const totalTables = Object.keys(tableProgress).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-start justify-center pt-16 z-40 pointer-events-none">
      <div className="bg-white rounded-lg shadow-2xl w-96 p-6 pointer-events-auto animate-fadeIn">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{getStatusIcon()}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{getStatusText()}</h3>
            <p className="text-xs text-gray-500">
              {isOnline ? '🌐 Online' : '📱 Offline'}
            </p>
          </div>
        </div>

        {/* Main Progress */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                syncStatus === 'complete'
                  ? 'bg-green-500'
                  : syncStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Table Progress Details */}
        {totalTables > 0 && (
          <div className="mb-4 max-h-32 overflow-y-auto border border-gray-200 rounded p-3 bg-gray-50">
            <div className="text-xs font-semibold text-gray-600 mb-2">
              Tables: {syncedTables.length}/{totalTables}
            </div>
            <div className="space-y-1">
              {Object.entries(tableProgress).map(([table, data]) => (
                <div key={table} className="text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-700">{table}</span>
                    <span className="font-semibold text-gray-600">
                      {data.percent}%
                    </span>
                  </div>
                  <div className="w-full h-1 bg-gray-300 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 transition-all duration-200"
                      style={{ width: `${data.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Info Section */}
        <div className="grid grid-cols-2 gap-3 text-center text-xs">
          <div className="p-2 bg-blue-50 rounded">
            <div className="font-semibold text-blue-700">{totalTables}</div>
            <div className="text-gray-600">Tables</div>
          </div>
          <div className="p-2 bg-green-50 rounded">
            <div className="font-semibold text-green-700">
              {estimatedTime > 0 ? `${estimatedTime}s` : 'Soon'}
            </div>
            <div className="text-gray-600">Est. Time</div>
          </div>
        </div>

        {/* Footer Message */}
        <div className="mt-4 text-xs text-gray-600 text-center">
          {syncStatus === 'syncing' && (
            <p>Data is syncing in the background. You can continue working.</p>
          )}
          {syncStatus === 'complete' && (
            <p className="text-green-700">✓ All data synced successfully</p>
          )}
          {syncStatus === 'error' && (
            <p className="text-red-700">⚠️ Some data failed to sync. Retrying...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default InitialSyncProgress;
