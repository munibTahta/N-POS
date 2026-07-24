import { useState, useEffect } from 'react';
import networkStateService from '../services/NetworkStateService';

/**
 * Hook untuk track network state dengan real-time updates
 * Production-level network monitoring
 */
export const useNetworkState = () => {
  const [networkStatus, setNetworkStatus] = useState({
    isOnline: networkStateService.isOnline,
    connectionType: networkStateService.connectionType,
    offlineSince: networkStateService.offlineSinceTime,
    offlineTime: networkStateService.getOfflineTime(),
    failedRequests: networkStateService.failedRequests
  });

  useEffect(() => {
    // Listen for network changes
    const unsubscribe = networkStateService.subscribe(({ _status, isOnline }) => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline,
        connectionType: networkStateService.connectionType,
        offlineSince: networkStateService.offlineSinceTime,
        offlineTime: networkStateService.getOfflineTime(),
        failedRequests: networkStateService.failedRequests
      }));
    });

    // Update offline time every second
    const interval = setInterval(() => {
      if (!networkStatus.isOnline) {
        setNetworkStatus(prev => ({
          ...prev,
          offlineTime: networkStateService.getOfflineTime()
        }));
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [networkStatus.isOnline]);

  return {
    isOnline: networkStatus.isOnline,
    isOffline: !networkStatus.isOnline,
    connectionType: networkStatus.connectionType,
    offlineSince: networkStatus.offlineSince,
    offlineTime: networkStatus.offlineTime,
    offlineTimeFormatted: networkStateService.getOfflineTimeFormatted(),
    failedRequests: networkStatus.failedRequests,
    status: networkStatus
  };
};

export default useNetworkState;
