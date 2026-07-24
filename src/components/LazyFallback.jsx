/**
 * Fallback Component untuk Lazy Routes
 * Digunakan ketika lazy loading gagal (offline atau error)
 */

export const LazyFallback = ({ error, retry, isOffline }) => {
  if (isOffline) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <div className="text-5xl mb-4">📴</div>
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
        <div className="text-5xl mb-4">⚠️</div>
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
