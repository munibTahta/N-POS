import React, { useEffect, useState } from 'react';
import { Circle, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import useOfflineMode from '../hooks/useOfflineMode';
import '../styles/OfflineModeIndicator.css';

/**
 * Offline/Online Mode Status Indicator
 * Displays:
 * - Current mode (online/offline)
 * - Cache status & freshness
 * - Sync status
 * - Action buttons (retry, force refresh)
 */
export const OfflineModeIndicator = () => {
  const {
    mode,
    isOnline,
    hasCache,
    cacheSize,
    cacheAge,
    isFresh,
    canWorkOffline,
    lastSyncFailed,
    syncRetrying,
    status,
    retrySync,
    checkCacheFreshness
  } = useOfflineMode();

  const [showDetails, setShowDetails] = useState(false);

  // Auto-hide details after 5 seconds if not interacting
  useEffect(() => {
    if (!showDetails) return;
    const timer = setTimeout(() => setShowDetails(false), 5000);
    return () => clearTimeout(timer);
  }, [showDetails]);

  const getModeColor = () => {
    if (mode === 'offline') {
      return hasCache && isFresh ? 'offline-working' : 'offline-error';
    }
    return 'online';
  };

  const getStatusIcon = () => {
    if (mode === 'online') return <Circle className="w-3 h-3 fill-green-500 text-green-500" />;
    if (hasCache && isFresh) return <Circle className="w-3 h-3 fill-yellow-500 text-yellow-500" />;
    return <Circle className="w-3 h-3 fill-red-500 text-red-500" />;
  };

  return (
    <div className={`offline-mode-indicator ${getModeColor()}`}>
      {/* Quick Status */}
      <div
        className="indicator-status"
        onClick={() => setShowDetails(!showDetails)}
        title={status.message}
        aria-label={`${mode} ${cacheAge !== null ? `${cacheAge.toFixed(0)}h` : ''}`}
      >
        <span className="icon" aria-hidden="true">{getStatusIcon()}</span>
      </div>

      {/* Detailed Info (expandable) */}
      {showDetails && (
        <div className="indicator-details">
          <div className="detail-row">
            <span className="label">Mode:</span>
            <span className={`value ${mode}`}>{mode.toUpperCase()}</span>
          </div>

          <div className="detail-row">
            <span className="label">Network:</span>
            <span className={`value ${isOnline ? 'connected' : 'disconnected'} flex items-center gap-1`}>
              {isOnline ? <><CheckCircle2 className="w-3.5 h-3.5" /> Connected</> : <><XCircle className="w-3.5 h-3.5" /> Disconnected</>}
            </span>
          </div>

          {hasCache && (
            <>
              <div className="detail-row">
                <span className="label">Cache:</span>
                <span className={`value ${isFresh ? 'fresh' : 'stale'}`}>
                  {cacheSize.toLocaleString()} products
                </span>
              </div>

              <div className="detail-row">
                <span className="label">Cache Age:</span>
                <span className={`value ${isFresh ? 'fresh' : 'stale'}`}>
                  {cacheAge.toFixed(1)} hours
                  {!isFresh && <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> (outdated)</span>}
                </span>
              </div>

              <div className="detail-row">
                <span className="label">Offline Ready:</span>
                <span className={`value ${canWorkOffline ? 'ready' : 'not-ready'} flex items-center gap-1`}>
                  {canWorkOffline ? <><CheckCircle2 className="w-3.5 h-3.5" /> Yes</> : <><XCircle className="w-3.5 h-3.5" /> No</>}
                </span>
              </div>
            </>
          )}

          {!hasCache && (
            <div className="detail-row warning">
              <span className="label flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> No Cache:</span>
              <span className="value">App requires network</span>
            </div>
          )}

          {lastSyncFailed && (
            <div className="detail-row error">
              <span className="label flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Sync Failed:</span>
              <span className="value">Last sync failed</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="indicator-actions">
            {isOnline && lastSyncFailed && (
              <button 
                className="action-btn retry"
                onClick={retrySync}
                disabled={syncRetrying}
              >
                {syncRetrying
                  ? <span className="inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Retrying...</span>
                  : <span className="inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" /> Retry Sync</span>}
              </button>
            )}

            {isOnline && (
              <button 
                className="action-btn refresh"
                onClick={() => {
                  checkCacheFreshness();
                  setShowDetails(false);
                }}
              >
                <span className="inline-flex items-center gap-1"><Search className="w-3.5 h-3.5" /> Check Cache</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineModeIndicator;
