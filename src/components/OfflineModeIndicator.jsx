import React, { useEffect, useState } from 'react';
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
    if (mode === 'online') return '🟢';
    if (hasCache && isFresh) return '🟡';
    return '🔴';
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
            <span className={`value ${isOnline ? 'connected' : 'disconnected'}`}>
              {isOnline ? '✓ Connected' : '✗ Disconnected'}
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
                  {!isFresh && ' ⚠️ (outdated)'}
                </span>
              </div>

              <div className="detail-row">
                <span className="label">Offline Ready:</span>
                <span className={`value ${canWorkOffline ? 'ready' : 'not-ready'}`}>
                  {canWorkOffline ? '✓ Yes' : '✗ No'}
                </span>
              </div>
            </>
          )}

          {!hasCache && (
            <div className="detail-row warning">
              <span className="label">⚠️ No Cache:</span>
              <span className="value">App requires network</span>
            </div>
          )}

          {lastSyncFailed && (
            <div className="detail-row error">
              <span className="label">❌ Sync Failed:</span>
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
                {syncRetrying ? '⟳ Retrying...' : '🔄 Retry Sync'}
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
                🔍 Check Cache
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineModeIndicator;
