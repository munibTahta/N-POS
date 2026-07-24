/**
 * TransactionQueueStatus Component
 * 
 * Shows queue status, pending/failed count
 * Allows manual sync and retry operations
 * Non-intrusive design for POS page
 */

import React, { useState } from 'react';
import useTransactionQueue from '../hooks/useTransactionQueue';

export const TransactionQueueStatus = () => {
  const {
    pendingCount,
    failedCount,
    isProcessing,
    isOnline,
    lastSync,
    processQueue,
    retryFailed,
    error
  } = useTransactionQueue();

  const [showDetails, setShowDetails] = useState(false);

  if (pendingCount === 0 && failedCount === 0) {
    return null; // Don't show if no queue items
  }

  const handleManualSync = async () => {
    await processQueue();
  };

  const handleRetry = async () => {
    await retryFailed();
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-sm">
      {/* Main Status Card */}
      <div
        className={`
          rounded-lg shadow-lg p-4 text-white
          ${failedCount > 0 ? 'bg-red-500' : 'bg-amber-500'}
          transition-all duration-300
        `}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isProcessing ? (
              <div className="animate-spin">⏳</div>
            ) : (
              <span>📤</span>
            )}
            <span className="font-semibold">Transaksi Offline</span>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-white/80 hover:text-white text-lg"
          >
            {showDetails ? '▼' : '▶'}
          </button>
        </div>

        {/* Summary Line */}
        <div className="text-sm mb-3">
          {pendingCount > 0 && (
            <div>⏳ {pendingCount} transaksi pending</div>
          )}
          {failedCount > 0 && (
            <div className="text-red-100">❌ {failedCount} gagal</div>
          )}
          {isOnline && pendingCount > 0 && !isProcessing && (
            <div className="text-green-100">🌐 Siap disync</div>
          )}
          {!isOnline && (
            <div className="text-yellow-100">📵 Offline - akan disync otomatis saat online</div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {pendingCount > 0 && isOnline && !isProcessing && (
            <button
              onClick={handleManualSync}
              className="flex-1 px-3 py-2 bg-white text-amber-600 rounded font-semibold text-sm hover:bg-gray-100 transition"
            >
              Sync Sekarang
            </button>
          )}
          {failedCount > 0 && (
            <button
              onClick={handleRetry}
              className="flex-1 px-3 py-2 bg-white text-red-600 rounded font-semibold text-sm hover:bg-gray-100 transition"
            >
              Coba Lagi
            </button>
          )}
          {isProcessing && (
            <div className="flex-1 px-3 py-2 bg-white text-amber-600 rounded font-semibold text-sm text-center">
              Processing...
            </div>
          )}
        </div>

        {/* Last Sync Time */}
        {lastSync && (
          <div className="text-xs mt-2 opacity-75">
            Last sync: {lastSync.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Detailed View */}
      {showDetails && (
        <div className="bg-white rounded-lg shadow-lg p-4 mt-2 text-gray-800 text-sm">
          <h3 className="font-semibold mb-2">📊 Queue Details</h3>

          <div className="space-y-2">
            <div className="flex justify-between py-1 border-b">
              <span>Pending:</span>
              <span className="font-semibold">{pendingCount}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span>Failed:</span>
              <span className="font-semibold text-red-600">{failedCount}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Network:</span>
              <span className={isOnline ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 mt-3 text-red-800 text-xs">
              ⚠️ {error}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">
            💡 Transaksi offline akan disimpan dan otomatis disync saat internet tersedia.
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Minimal Badge Component
 * For integration into existing POS header/status bar
 */
export const TransactionQueueBadge = () => {
  const { pendingCount, failedCount, isOnline } = useTransactionQueue();

  if (pendingCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1">
      {failedCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
          ❌ {failedCount} Failed
        </span>
      )}
      {pendingCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
          ⏳ {pendingCount} Pending
        </span>
      )}
      {pendingCount > 0 && !isOnline && (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
          📵 Offline
        </span>
      )}
    </div>
  );
};

export default TransactionQueueStatus;
