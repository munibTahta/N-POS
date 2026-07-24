// src/components/common/ConnectionStatus.jsx
import React, { useState } from 'react';
import { useSync } from '../../context/SyncContext';

const ConnectionStatus = () => {
  const { syncStatus } = useSync();
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = () => {
    if (!syncStatus.isOnline) return 'bg-red-500';
    if (syncStatus.pendingCount > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!syncStatus.isOnline) return 'Offline';
    if (syncStatus.pendingCount > 0) return `Sync Pending (${syncStatus.pendingCount})`;
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!syncStatus.isOnline) {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    }
    if (syncStatus.pendingCount > 0) {
      return (
        <svg className="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1 rounded-full text-white text-sm font-medium transition-colors ${getStatusColor()}`}
        title={getStatusText()}
      >
        {getStatusIcon()}
        <span className="hidden sm:inline">{getStatusText()}</span>
      </button>

      {showDetails && (
        <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-64 z-50">
          <h3 className="font-semibold text-gray-900 mb-3">Status Koneksi</h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={`font-medium ${syncStatus.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {syncStatus.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Sync Pending:</span>
              <span className={syncStatus.pendingCount > 0 ? 'text-yellow-600' : 'text-green-600'}>
                {syncStatus.pendingCount}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Failed Items:</span>
              <span className={syncStatus.failedCount > 0 ? 'text-red-600' : 'text-green-600'}>
                {syncStatus.failedCount}
              </span>
            </div>

            {syncStatus.lastSyncTime && (
              <div className="flex justify-between">
                <span>Last Sync:</span>
                <span className="text-gray-600">
                  {new Date(syncStatus.lastSyncTime).toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>

          {!syncStatus.isOnline && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              Data akan disimpan secara lokal dan disinkronkan saat koneksi kembali.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;