/**
 * SyncStatus Component
 * Menampilkan status sinkronisasi offline queue
 */

import React from 'react';

export const SyncStatusNotification = ({ syncStatus, isSyncing, queueSize }) => {
  if (!syncStatus && queueSize === 0) return null;

  let bgColor = 'bg-blue-500';
  let icon = '🔄';

  if (isSyncing) {
    bgColor = 'bg-blue-500';
    icon = '🔄';
  } else if (syncStatus?.status === 'success') {
    bgColor = 'bg-green-500';
    icon = '✅';
  } else if (syncStatus?.status === 'error') {
    bgColor = 'bg-red-500';
    icon = '❌';
  } else if (syncStatus?.status === 'partial') {
    bgColor = 'bg-yellow-500';
    icon = '⚠️';
  } else if (queueSize > 0) {
    bgColor = 'bg-orange-500';
    icon = '📤';
  }

  return (
    <div className={`fixed top-16 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-40 max-w-sm`}>
      {isSyncing ? (
        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
      ) : (
        <span>{icon}</span>
      )}
      <div className="flex-1">
        {syncStatus?.message && (
          <p className="text-sm font-semibold">{syncStatus.message}</p>
        )}
        {queueSize > 0 && !isSyncing && !syncStatus && (
          <p className="text-sm">📤 {queueSize} data menunggu sinkronisasi</p>
        )}
      </div>
    </div>
  );
};

export default SyncStatusNotification;
