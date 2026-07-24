import React from 'react';
import { useNetworkState } from './useNetworkState';
import RoutePreloader from '../hooks/useRoutePreloader';

/**
 * OfflineDataIndicator Component
 * Shows when app is using cached/stale data for offline support
 * Non-intrusive banner at top of page when offline
 */
export const OfflineDataIndicator = ({ routeName }) => {
  const { isOnline } = useNetworkState();

  if (isOnline) return null;

  const fallback = RoutePreloader.getOfflineRouteFallback(routeName);
  
  if (!fallback.data) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-sm text-yellow-800">
        <span className="text-lg">📱</span>
        <span>Offline Mode - Data tidak tersedia untuk halaman ini</span>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2 text-sm text-blue-800">
      <span className="text-lg">💾</span>
      <span>{fallback.message}</span>
    </div>
  );
};

export default OfflineDataIndicator;
