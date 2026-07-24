import React from 'react';
import { toast } from 'react-toastify';
import { logger } from '../utils/logger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isOffline: !navigator.onLine,
      isChunkError: false
    };
  }

  static getDerivedStateFromError(error) {
    // Check if this is a chunk loading error (common with lazy loading)
    const isChunkError = error?.message?.includes('Failed to fetch dynamically imported module') ||
                          error?.message?.includes('ChunkLoadError') ||
                          error?.message?.includes('Loading chunk');
    return { 
      hasError: true,
      isChunkError
    };
  }

  componentDidMount() {
    // Store bound handlers to ensure cleanup works correctly
    this.handleOnline = () => {
      this.setState({ isOffline: false });
      // Clear error state when back online
      if (this.state.isChunkError) {
        this.setState({ hasError: false, isChunkError: false });
      }
    };

    this.handleOffline = () => {
      this.setState({ isOffline: true });
    };

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  componentWillUnmount() {
    // Remove listeners using stored bound handlers
    if (this.handleOnline) {
      window.removeEventListener('online', this.handleOnline);
    }
    if (this.handleOffline) {
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
      isOffline: !navigator.onLine
    });
    
    // Log error
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Show appropriate toast based on error type
    if (this.state.isChunkError && this.state.isOffline) {
      toast.warning('⚠️ Offline - tidak bisa load halaman. Menunggu koneksi internet...');
    } else if (this.state.isChunkError) {
      toast.error('⚠️ Gagal load halaman. Silakan refresh atau coba lagi.');
    } else {
      toast.error('❌ Terjadi kesalahan aplikasi. Silakan refresh halaman.');
    }
  }

  handleRetry = () => {
    // If chunk loading error, prefer reload when online; otherwise reset state
    if (this.state.isChunkError) {
      // If online now, perform a safe reload
      if (navigator.onLine) {
        (async () => {
          try {
            const { safeReload } = await import('../utils/appRefresh');
            safeReload('errorBoundary:retry');
          } catch (_e) {
            // Force a network-bypassing reload with cache-buster
            try {
              window.location.replace(window.location.pathname + window.location.search + '#reload-' + Date.now());
            } catch (_) {
              window.location.reload();
            }
          }
        })();
      } else {
        // Wait for online event then reload once
        const onOnline = async () => {
          try {
            const { safeReload } = await import('../utils/appRefresh');
            safeReload('errorBoundary:online-retry');
          } catch (_e) {
            try {
              window.location.replace(window.location.pathname + window.location.search + '#reload-' + Date.now());
            } catch (_) {
              window.location.reload();
            }
          }
        };

        window.addEventListener('online', onOnline, { once: true });
        toast.info('Terhubung kembali nanti — halaman akan dimuat ulang otomatis saat koneksi pulih.');
      }
      return;
    }

    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isChunkError: false
    });
  }

  render() {
    if (this.state.hasError) {
      const { isChunkError, isOffline, error } = this.state;

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
            {/* Offline Chunk Error */}
            {isChunkError && isOffline && (
              <>
                <div className="text-6xl mb-4 text-center">🔴</div>
                <h2 className="text-2xl font-bold text-yellow-600 mb-4">Offline Mode</h2>
                <div className="text-gray-700 mb-4">
                  Koneksi internet terputus. Halaman ini belum bisa diakses offline.
                </div>
                <div className="text-sm text-gray-600 mb-4">
                  <p className="mb-2">Silakan:</p>
                  <ul className="list-disc ml-5">
                    <li>Hubungkan ke internet</li>
                    <li>Kembali ke halaman sebelumnya</li>
                    <li>Tunggu koneksi terpulih</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.history.back()}
                    className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={this.handleRetry}
                    className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Coba Lagi
                  </button>
                </div>
              </>
            )}

            {/* Other Chunk Load Errors */}
            {isChunkError && !isOffline && (
              <>
                <div className="text-6xl mb-4 text-center">⚠️</div>
                <h2 className="text-2xl font-bold text-orange-600 mb-4">Gagal Load Halaman</h2>
                <p className="text-gray-700 mb-4">
                  Terjadi kesalahan saat memuat halaman. Ini mungkin karena versi aplikasi baru atau masalah jaringan.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={this.handleRetry}
                    className="flex-1 bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Coba Lagi
                  </button>
                    <button
                onClick={async () => {
                  try {
                    const { safeReload } = await import('../utils/appRefresh');
                    safeReload('errorBoundary:tryAgain');
                  } catch (_e) {
                    window.location.reload();
                  }
                }}
                    className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Refresh
                  </button>
                </div>
              </>
            )}

            {/* Generic Errors */}
            {!isChunkError && (
              <>
                <h2 className="text-2xl font-bold text-red-600 mb-4">Terjadi Kesalahan</h2>
                <p className="text-gray-700 mb-4">
                  Aplikasi mengalami masalah teknis. Silakan refresh halaman atau hubungi support.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.history.back()}
                    className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Refresh
                  </button>
                </div>
                {error && (
                  <details className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
                    <summary>Error Details</summary>
                    <pre className="overflow-auto mt-2 p-2">{error.toString()}</pre>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;