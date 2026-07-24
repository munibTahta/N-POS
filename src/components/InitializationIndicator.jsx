import React, { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

/**
 * InitializationIndicator Component (Toast-based)
 * Shows offline initialization progress via toast notifications
 * - Shows starting toast when sync begins
 * - Shows success toast when complete
 * Uses minimal UI impact via toast notifications
 */
const InitializationIndicator = () => {
  const toastIdRef = useRef(null);

  useEffect(() => {
    const handleSyncStart = () => {
      // Show loading toast
      toastIdRef.current = toast.loading('🔄 Menyiapkan data offline...', {
        position: 'bottom-left',
        autoClose: false,
        closeButton: false,
        hideProgressBar: false,
      });
    };

    const handleTableProgress = (event) => {
      const { percent } = event.detail || {};
      // Update toast with progress
      if (toastIdRef.current !== null && percent) {
        toast.update(toastIdRef.current, {
          render: `🔄 Menyiapkan data offline... ${percent}%`,
          type: 'info',
          isLoading: true,
        });
      }
    };

    const handleSyncComplete = () => {
      // Update to success toast
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          render: 'Siap Offline - Data offline siap digunakan',
          type: 'success',
          isLoading: false,
          autoClose: 3000,
          closeButton: true,
        });
      } else {
        // Fallback if no loading toast exists
        toast.success('Siap Offline - Data offline siap digunakan', {
          position: 'bottom-left',
          autoClose: 3000,
        });
      }
      
      toastIdRef.current = null;
    };

    window.addEventListener('initialSyncStart', handleSyncStart);
    window.addEventListener('tableSyncProgress', handleTableProgress);
    window.addEventListener('syncComplete', handleSyncComplete);

    return () => {
      window.removeEventListener('initialSyncStart', handleSyncStart);
      window.removeEventListener('tableSyncProgress', handleTableProgress);
      window.removeEventListener('syncComplete', handleSyncComplete);
    };
  }, []);

  // Component doesn't render anything - only manages toast notifications
  return null;
};

export default InitializationIndicator;
