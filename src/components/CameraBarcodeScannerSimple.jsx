import React, { useEffect, useRef, useState } from 'react';

/**
 * Simple Camera Barcode Scanner Component
 * Uses basic WebRTC for camera access
 */
const CameraBarcodeScanner = ({ onScan, onClose }) => {
  const [error, setError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // Use back camera on mobile
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to access camera:', err);
        setError('Tidak dapat mengakses kamera. Pastikan Anda memberikan izin akses kamera.');
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
      handleClose();
    }
  };

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">Scan Barcode dengan Kamera</h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-semibold">Error:</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <div className="mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded border"
                style={{ maxHeight: '300px' }}
              />
              <p className="text-sm text-gray-600 text-center mt-2">
                Arahkan kamera ke barcode produk
              </p>
            </div>
          )}

          {/* Manual Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Atau Masukkan Manual:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="Masukkan kode barcode..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualInput.trim()}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                OK
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="flex-1 bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraBarcodeScanner;