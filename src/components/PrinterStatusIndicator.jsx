import React, { useState, useEffect, useCallback } from 'react';
import usePrinter from '../hooks/usePrinter';

/**
 * Professional printer status indicator with queue monitoring
 * Shows printer status, queue info, and allows quick actions
 * Placed next to online status indicator in POS header
 */
const PrinterStatusIndicator = () => {
  const { defaultPrinter, queueStatus, isPrinting } = usePrinter();
  const [printerStatus, setPrinterStatus] = useState('checking');
  const [showDetails, setShowDetails] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!defaultPrinter) {
      setPrinterStatus('no_printer');
      return;
    }

    if (!window.electronAPI?.getPrinters) {
      setPrinterStatus('healthy');
      return;
    }

    try {
      const printers = await window.electronAPI.getPrinters();
      const found = Array.isArray(printers) && printers.some(
        p => String(p.name || p.deviceName || '').trim() === defaultPrinter
      );
      setPrinterStatus(found ? 'healthy' : 'unhealthy');
    } catch (_err) {
      setPrinterStatus('unhealthy');
    }
  }, [defaultPrinter]);

  useEffect(() => {
    // Delay initial check to avoid synchronous setState
    setTimeout(() => refreshStatus(), 0);
    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, [defaultPrinter, refreshStatus]);

  const getStatusInfo = () => {
    switch (printerStatus) {
      case 'healthy':
        return { color: '#22c55e', text: 'Siap', icon: '🟢' };
      case 'unhealthy':
        return { color: '#eab308', text: 'Offline', icon: '🟡' };
      case 'no_printer':
        return { color: '#9ca3af', text: 'Tidak dipilih', icon: '⚪' };
      case 'error':
        return { color: '#ef4444', text: 'Error', icon: '🔴' };
      default:
        return { color: '#6b7280', text: 'Memeriksa...', icon: '⚪' };
    }
  };

  const statusInfo = getStatusInfo();
  const printerName = defaultPrinter || 'Tidak dipilih';
  const hasQueue = queueStatus && (queueStatus.pending > 0 || queueStatus.size > 0);

  return (
    <div className="relative">
      <div
        className="flex items-center space-x-1 cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
        onClick={() => setShowDetails(!showDetails)}
        title="Klik untuk detail printer"
      >
        {/* Printer Status Icon */}
        <div className="relative">
          <svg
            className="w-4 h-4"
            fill={statusInfo.color}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M6 2h12a2 2 0 0 1 2 2v5h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2H2a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h2V4a2 2 0 0 1 2-2zm0 2v5h12V4H6zm-4 7v5h20v-5H2zm6 7h8v-2H8v2z"/>
          </svg>

          {/* Queue Indicator */}
          {hasQueue && (
            <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {queueStatus.size}
            </div>
          )}

          {/* Printing Indicator */}
          {isPrinting && (
            <div className="absolute -top-1 -right-1 animate-spin">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
          )}
        </div>

        {/* Printer Name */}
        <span className="text-xs sm:text-sm font-medium truncate max-w-[120px]">
          {printerName}
        </span>

        {/* Status Text */}
        <span className="text-xs text-gray-500 hidden sm:inline">
          {statusInfo.text}
        </span>
      </div>

      {/* Detailed Status Popup */}
      {showDetails && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 min-w-[250px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Status Printer</h4>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm">{statusInfo.icon}</span>
                <span className="text-sm">{statusInfo.text}</span>
              </div>

              <div className="text-xs text-gray-600">
                <div>Printer: {printerName}</div>
                {hasQueue && (
                  <div className="mt-1">
                    <div>Antrian: {queueStatus.pending} diproses, {queueStatus.size} menunggu</div>
                    {queueStatus.isPaused && <div className="text-yellow-600">Status: Dijeda</div>}
                  </div>
                )}
                {isPrinting && (
                  <div className="text-blue-600">Status: Sedang mencetak...</div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t pt-2 space-y-1">
              <button
                className="w-full text-left text-xs text-blue-600 hover:text-blue-700"
                onClick={refreshStatus}
              >
                🔄 Refresh Status
              </button>

              {hasQueue && (
                <button
                  className="w-full text-left text-xs text-red-600 hover:text-red-700"
                  onClick={() => {
                    // Emergency stop would be implemented here
                    alert('Emergency stop functionality would clear all print queues');
                  }}
                >
                  🛑 Stop All Prints
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrinterStatusIndicator;
