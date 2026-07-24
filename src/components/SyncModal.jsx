import React, { useState, useEffect } from 'react';
import { useSync } from '../context/SyncContext';
import syncEngine from '../services/syncEngine';

const SyncModal = ({ isOpen, onClose }) => {
  const { performSync, getConnectionStatus, getSyncInfo, isManualSyncing } = useSync();
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [syncDetails, setSyncDetails] = useState(null);

  const connectionStatus = getConnectionStatus();
  const syncInfo = getSyncInfo();

  const fetchSyncDetails = async () => {
    try {
      if (window.electronAPI?.dbGetSyncQueue && window.electronAPI?.dbSelect) {
        const queue = await window.electronAPI.dbGetSyncQueue();
        const failed = await window.electronAPI.dbSelect({
          table: 'sync_queue',
          whereClause: "status = 'failed'"
        });

        setSyncDetails({
          pendingItems: queue,
          failedItems: failed,
          totalPending: queue.length,
          totalFailed: failed.length
        });
      }
    } catch (error) {
      console.error('Failed to fetch sync details:', error);
    }
  };

  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]); // onClose is now stable with useCallback

  useEffect(() => {
    if (isOpen) {
      const loadSyncDetails = async () => {
        try {
          if (window.electronAPI && window.electronAPI.dbGetSyncQueue) {
            const queue = await window.electronAPI.dbGetSyncQueue();
            const failed = await window.electronAPI.dbSelect({
              table: 'sync_queue',
              whereClause: "status = 'failed'"
            });

            setSyncDetails({
              pendingItems: queue,
              failedItems: failed,
              totalPending: queue.length,
              totalFailed: failed.length
            });
          }
        } catch (error) {
          console.error('Failed to fetch sync details:', error);
        }
      };
      loadSyncDetails();
    }
  }, [isOpen]);

  const handleSync = async () => {
    setSyncError('');
    setSyncMessage('');

    try {
      const result = await performSync();
      if (result.success) {
        setSyncMessage(result.message);
        // Refresh details after sync - wait 2 seconds to ensure database is updated
        setTimeout(async () => {
          await fetchSyncDetails();
        }, 2000);
      } else {
        setSyncError(result.message);
      }
    } catch (error) {
      setSyncError(`Sync gagal: ${error.message}`);
    }
  };

  const handleRefreshData = async () => {
    setSyncError('');
    setSyncMessage('');

    try {
      // Use syncEngine's updateDataFromServer method
      const result = await syncEngine.updateDataFromServer();
      if (result.success) {
        setSyncMessage(result.message);
        // Refresh details after refresh
        setTimeout(() => {
          fetchSyncDetails();
        }, 1000);
      } else {
        setSyncError('Refresh gagal');
      }
    } catch (error) {
      setSyncError(`Refresh gagal: ${error.message}`);
    }
  };

  const handleBackdropClick = (e) => {
    // Only close if clicking directly on the backdrop, not on the modal content
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      onClose();
    }
  };

  // Don't render anything if modal is not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Sinkronisasi Data</h2>
                <p className="text-blue-100 text-sm">Kelola sinkronisasi data antara aplikasi dan server</p>
                <p className="text-blue-200 text-xs mt-1">Sync: Kirim & ambil data • Refresh: Hanya ambil data</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Connection Status Card */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${connectionStatus.isOnline ? 'bg-green-100' : 'bg-red-100'}`}>
                  <svg className={`w-6 h-6 ${connectionStatus.isOnline ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {connectionStatus.isOnline ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    )}
                  </svg>
                </div>
                <div>
                  <p className={`text-lg font-semibold ${connectionStatus.isOnline ? 'text-green-700' : 'text-red-700'}`}>
                    {connectionStatus.isOnline ? 'Terhubung ke Server' : 'Tidak Terhubung'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Status koneksi internet dan server
                  </p>
                  {syncInfo.lastSyncTime ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Sinkron terakhir: {new Date(syncInfo.lastSyncTime).toLocaleString('id-ID')}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      Sinkron terakhir: Belum pernah
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right space-y-1">
                {syncInfo.pendingCount > 0 && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">
                      {syncInfo.pendingCount} data menunggu
                    </span>
                  </div>
                )}
                {syncInfo.failedCount > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">
                      {syncInfo.failedCount} gagal sinkron
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sync Messages */}
          {syncMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-green-800 font-medium">Berhasil!</p>
                <p className="text-green-700 text-sm">{syncMessage}</p>
              </div>
            </div>
          )}
          {syncError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-red-800 font-medium">Terjadi Kesalahan</p>
                <p className="text-red-700 text-sm">{syncError}</p>
              </div>
            </div>
          )}

          {/* Sync Controls */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <button
                onClick={handleSync}
                disabled={isManualSyncing || !connectionStatus.isOnline}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:shadow-md disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                {isManualSyncing ? 'Menyinkronkan...' : 'Sinkron Data'}
              </button>
              <p className="text-xs text-gray-600 mt-1 text-center">
                Kirim perubahan lokal & ambil data terbaru dari server
              </p>
            </div>

            <div>
              <button
                onClick={handleRefreshData}
                disabled={!connectionStatus.isOnline}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:shadow-md disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Perbarui Data
              </button>
              <p className="text-xs text-gray-600 mt-1 text-center">
                Hanya ambil data terbaru dari server
              </p>
            </div>
          </div>

          {/* Sync Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Detail Sinkronisasi
            </h3>

            {/* Pending Items */}
            {syncDetails && syncDetails.totalPending > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Data Menunggu Sinkronisasi ({syncDetails.totalPending})
                </h4>
                <div className="max-h-32 overflow-y-auto">
                  {syncDetails.pendingItems.slice(0, 5).map((item, index) => (
                    <div key={index} className="text-sm text-yellow-700 py-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0 1 1 0 012 0zm0 4a1 1 0 10-2 0 1 1 0 012 0zm0 4a1 1 0 10-2 0 1 1 0 012 0z" clipRule="evenodd" />
                      </svg>
                      {item.table_name}: {item.operation} - {new Date(item.created_at).toLocaleString('id-ID')}
                    </div>
                  ))}
                  {syncDetails.totalPending > 5 && (
                    <div className="text-sm text-yellow-600 mt-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0 1 1 0 012 0zm0 4a1 1 0 10-2 0 1 1 0 012 0zm0 4a1 1 0 10-2 0 1 1 0 012 0z" clipRule="evenodd" />
                      </svg>
                      ... dan {syncDetails.totalPending - 5} item lainnya
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Failed Items */}
            {syncDetails && syncDetails.totalFailed > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Data Gagal Sinkronisasi ({syncDetails.totalFailed})
                </h4>
                <div className="max-h-32 overflow-y-auto">
                  {syncDetails.failedItems.slice(0, 5).map((item, index) => (
                    <div key={index} className="text-sm text-red-700 py-1 flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {item.table_name}: {item.operation} - {new Date(item.created_at).toLocaleString('id-ID')}
                    </div>
                  ))}
                  {syncDetails.totalFailed > 5 && (
                    <div className="text-sm text-red-600 mt-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      ... dan {syncDetails.totalFailed - 5} item lainnya
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No pending items */}
            {syncDetails && syncDetails.totalPending === 0 && syncDetails.totalFailed === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Semua Data Tersinkronisasi
                </h4>
                <p className="text-sm text-green-700">
                  Tidak ada data yang menunggu sinkronisasi. Semua perubahan telah berhasil disinkronkan dengan server.
                </p>
              </div>
            )}
          </div>

          {/* Information */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Informasi Sistem
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p><strong>Mode Offline:</strong> Aplikasi dapat berjalan tanpa koneksi internet. Data disimpan di database lokal (SQLite).</p>
              <p><strong>Mode Online:</strong> Data otomatis tersinkronisasi dengan server pusat (MySQL).</p>
              <p><strong>Transaksi:</strong> Penjualan yang dibuat saat offline akan ditandai dan disinkronkan saat online.</p>
              <p><strong>Keamanan:</strong> Semua operasi database dilakukan melalui IPC untuk keamanan maksimal.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncModal;