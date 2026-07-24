// src/components/common/ErrorFallback.jsx
import React from 'react';
import { toast } from 'react-toastify';

const ErrorFallback = ({ error, resetError, showDetails = false }) => {
  const handleReset = () => {
    resetError();
    toast.info('Aplikasi direset. Silakan coba lagi.');
  };

  const handleReport = () => {
    // In a real app, this would send error to monitoring service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('Error Report:', errorReport);
    toast.success('Error telah dilaporkan. Terima kasih atas bantuannya.');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Terjadi Kesalahan
          </h1>
          <p className="text-gray-600 mb-4">
            Maaf, terjadi kesalahan yang tidak terduga. Aplikasi akan berusaha memulihkan diri.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleReset}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Reset Aplikasi
          </button>

          <button
            onClick={handleReport}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Laporkan Error
          </button>
        </div>

        {showDetails && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Detail Error (Developer)
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-32">
              <p className="font-semibold text-red-600 mb-1">{error.message}</p>
              <pre className="text-gray-700 whitespace-pre-wrap">
                {error.stack}
              </pre>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

export default ErrorFallback;