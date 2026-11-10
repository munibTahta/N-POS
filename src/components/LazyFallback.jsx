import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Fallback Component untuk Lazy Routes
 * Digunakan ketika lazy loading gagal (offline atau error)
 */

export const LazyFallback = ({ error, retry, isOffline, stale = false, updating = false }) => {
  if (updating) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-700">Memperbarui aplikasi ke versi terbaru...</p>
      </div>
    );
  }
  if (stale && !isOffline) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <div role="alert" className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
          <div className="mb-4 flex justify-center"><RefreshCw className="h-12 w-12 text-blue-600" aria-hidden="true" /></div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Versi baru aplikasi tersedia</h2>
          <p className="mb-6 text-sm text-gray-600">Halaman ini berubah sejak Anda membuka aplikasi. Muat ulang untuk melanjutkan; data di keranjang yang belum disimpan tidak terpengaruh.</p>
          <button type="button" onClick={() => window.location.reload()} className="btn-primary btn-lg btn-block">Muat ulang</button>
        </div>
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <div className="flex justify-center mb-4"><WifiOff className="w-12 h-12 text-yellow-600" /></div>
          <h2 className="text-2xl font-bold text-yellow-600 mb-4">Mode Offline</h2>
          <p className="text-gray-700 mb-4">
            Halaman ini memerlukan koneksi internet untuk dimuat.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => window.history.back()}
              className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
            >
              Kembali
            </button>
            {retry && (
              <button
                onClick={retry}
                className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Coba Lagi
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
        <div className="flex justify-center mb-4"><AlertTriangle className="w-12 h-12 text-orange-600" /></div>
        <h2 className="text-2xl font-bold text-orange-600 mb-4">Gagal Load Halaman</h2>
        <p className="text-gray-700 mb-2">
          {error?.message || 'Terjadi kesalahan saat memuat halaman'}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Silakan coba lagi atau hubungi administrator
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => window.history.back()}
            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
          >
            Kembali
          </button>
          {retry && (
            <button
              onClick={retry}
              className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Coba Lagi
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LazyFallback;
