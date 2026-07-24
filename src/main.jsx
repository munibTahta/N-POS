import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import pendingPayments from './utils/pendingPayments';
import { setupMemoryManagement } from './utils/memoryManager';

// Mute debug console methods in production builds
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

// Setup memory management to prevent "insufficient memory" errors
const stopMemoryManagement = setupMemoryManagement();

// Enhanced error boundary for root level
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Root Error Boundary caught an error:', error, errorInfo);
    // Report to Sentry if available
    // if (Sentry) {
    //   Sentry.captureException(error, { contexts: { errorInfo } });
    // }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Aplikasi Error</h2>
            <p className="text-gray-600 mb-4">Terjadi kesalahan kritis. Silakan refresh halaman.</p>
            <button
              onClick={async () => {
                const { safeReload } = await import('./utils/appRefresh');
                safeReload('user-triggered');
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Refresh Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Optimized background sync with better error handling
function startBackgroundPendingSync(intervalMs = 120000) {
  let isRunning = false;

  const syncOnce = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const results = await pendingPayments.syncPendingPayments();
      if (results && results.length > 0) {
        if (import.meta.env.DEV) void 0 && ('Pending payments synced:', results.length);
      }
    } catch (e) {
      console.warn('Pending payments sync failed:', e.message);
    } finally {
      isRunning = false;
    }
  };

  // Initial sync
  syncOnce();

  // Periodic sync
  const id = setInterval(syncOnce, intervalMs);

  // Return stop function
  return () => {
    clearInterval(id);
    isRunning = false;
  };
}

const root = createRoot(document.getElementById('root'));

root.render(
  <RootErrorBoundary>
    <StrictMode>
      <App />
    </StrictMode>
  </RootErrorBoundary>
);

// Start background sync when app loads
const stopPendingSync = startBackgroundPendingSync();

// Expose utilities for debugging (only in development)
if (import.meta.env.DEV) {
  window.__stopPendingSync = stopPendingSync;
  window.__stopMemoryManagement = stopMemoryManagement;
  window.__forceSync = () => pendingPayments.syncPendingPayments();
  window.__getCacheStats = async () => {
    const { memoryManager, apiCache, imageCache } = await import('./utils/memoryManager');
    return {
      memoryCache: {
        size: memoryManager.cache.size,
        stats: 'Max 100 entries with 5min expiry'
      },
      apiCache: {
        size: apiCache.cache.size,
        stats: 'Max 50 entries, 10MB limit'
      },
      imageCache: {
        size: imageCache.cache.size,
        stats: `Max 30 images, ${imageCache.cache.size}/${imageCache.maxImages} used`
      }
    };
  };
}
