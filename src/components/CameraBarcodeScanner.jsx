import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import SearchableSelect from './SearchableSelect';

/**
 * Robust Camera Barcode Scanner Component
 * Enhanced for reliability and better error handling
 */
const CameraBarcodeScanner = ({ onScan, onClose }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState('');
  const [scanned, setScanned] = useState(false);
  const [cameraOptions, setCameraOptions] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const qrScannerRef = useRef(null);
  const initTimeoutRef = useRef(null);

  // Get available cameras with better error handling and permissions
  const getCameras = useCallback(async () => {
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Browser tidak mendukung akses kamera. Silakan gunakan browser modern.');
        return;
      }

      // Request camera permission first with specific constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }, // Prefer back camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        // Stop the stream immediately after getting permission
        stream.getTracks().forEach(track => track.stop());
      } catch (permErr) {
        console.error('Camera permission error:', permErr);
        if (permErr.name === 'NotAllowedError') {
          setError('Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser dan coba lagi.');
        } else if (permErr.name === 'NotFoundError') {
          setError('Tidak ada kamera yang ditemukan di perangkat ini.');
        } else if (permErr.name === 'NotReadableError') {
          setError('Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain dan coba lagi.');
        } else {
          setError('Gagal mengakses kamera. Pastikan kamera tidak digunakan aplikasi lain.');
        }
        return;
      }

      // Now enumerate devices after permission is granted
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      if (videoDevices.length === 0) {
        setError('Tidak ada kamera yang tersedia di perangkat ini.');
        return;
      }

      const options = videoDevices.map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Camera ${index + 1} (${device.deviceId.slice(0, 8)}...)`
      }));

      setCameraOptions(options);

      // Prefer back camera for better scanning
      const backCamera = options.find(camera =>
        camera.label.toLowerCase().includes('back') ||
        camera.label.toLowerCase().includes('rear') ||
        camera.label.toLowerCase().includes('environment') ||
        camera.label.toLowerCase().includes('world')
      );

      const defaultCamera = backCamera || options[0];
      setSelectedCamera(defaultCamera.id);
    } catch (err) {
      console.error('Failed to get cameras:', err);
      setError('Gagal mengakses kamera. Pastikan browser mendukung akses kamera dan perangkat memiliki kamera.');
    }
  }, []);

  // Initialize scanner with selected camera
  const initScanner = useCallback(async () => {
    if (isInitialized || isScanning) return; // Prevent multiple initialization

    try {
      setError('');
      setIsScanning(true);
      // Wait for DOM element to be ready with better checking
      let containerElement = document.getElementById('barcode-scanner-container');
      let retryCount = 0;
      const maxRetries = 10;

      while (!containerElement && retryCount < maxRetries) {
        console.warn('Scanner container not ready, retrying...', retryCount + 1);
        await new Promise(resolve => setTimeout(resolve, 200));
        containerElement = document.getElementById('barcode-scanner-container');
        retryCount++;
      }

      if (!containerElement) {
        throw new Error('Scanner container element not found after retries');
      }

      // Clear existing scanner safely - make sure it's completely stopped first
      if (qrScannerRef.current) {
        try {
          await qrScannerRef.current.stop();
          await qrScannerRef.current.clear();
          qrScannerRef.current = null; // Set to null after clearing
        } catch (clearErr) {
          console.warn('Error clearing previous scanner:', clearErr);
          // Force cleanup even if stop fails
          qrScannerRef.current = null;
        }
      }

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create new scanner instance with Html5Qrcode (more reliable than Html5QrcodeScanner)
      qrScannerRef.current = new Html5Qrcode('barcode-scanner-container');

      const onScanSuccess = (decodedText, _decodedResult) => {
        setScanned(true);
        setIsScanning(false);

        // Call the callback
        onScan(decodedText);

        // Stop scanner after successful scan
        setTimeout(async () => {
          if (qrScannerRef.current) {
            try {
              await qrScannerRef.current.stop();
              await qrScannerRef.current.clear();
              setIsInitialized(false);
            } catch (err) {
              console.warn('Error stopping scanner:', err);
            }
          }
        }, 500);
      };

      const onScanError = (errorMessage) => {
        // Only log errors in development; scanning continues
        if (import.meta.env.DEV) void 0 && ('Scanner error:', errorMessage);
      };

      // Start scanning with the selected camera
      try {
        // Use selected camera or let the library choose the best one
        const cameraId = selectedCamera || { facingMode: 'environment' };
        await qrScannerRef.current.start(
          cameraId,
          {
            fps: 15,
            qrbox: { width: 300, height: 200 },
            formatsToSupport: [
              'CODE_128',
              'CODE_39',
              'EAN_13',
              'EAN_8',
              'UPC_A',
              'UPC_E',
              'ITF',
              'CODABAR',
              'QR_CODE',
              'DATA_MATRIX',
              'PDF_417'
            ],
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            },
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true
          },
          onScanSuccess,
          onScanError
        );
        setIsInitialized(true);
      } catch (startErr) {
        console.error('Failed to start scanner:', startErr);
        qrScannerRef.current = null; // Clean up on failure
        throw new Error(`Failed to start camera: ${startErr.message}`);
      }

    } catch (err) {
      console.error('Failed to initialize scanner:', err);
      setError(`Gagal menginisialisasi pemindai: ${err.message}`);
      setIsScanning(false);
      qrScannerRef.current = null; // Clean up on error
    }
  }, [selectedCamera, isInitialized, isScanning, onScan]);

  // Initialize cameras on mount
  useEffect(() => {
    getCameras();
  }, [getCameras]);

  // Initialize scanner when camera is selected and not already initialized
  useEffect(() => {
    if (selectedCamera && !isInitialized && !isScanning && !error && cameraOptions.length > 0) {
      // Auto-start scanner when camera is selected
      initTimeoutRef.current = setTimeout(() => {
        initScanner();
      }, 300); // Slightly longer delay to ensure camera change is complete
    }

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [selectedCamera, isInitialized, isScanning, error, cameraOptions.length, initScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().then(() => {
          qrScannerRef.current.clear();
          qrScannerRef.current = null;
        }).catch((err) => {
          console.warn('Error during unmount cleanup:', err);
          qrScannerRef.current = null;
        });
      }
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, []);

  // Handle camera permission changes (for when user grants permission in browser)
  useEffect(() => {
    const handleDeviceChange = () => {
      getCameras();
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [getCameras]);

  const handleClose = useCallback(async () => {
    // Stop scanning and cleanup
    setIsScanning(false);

    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
        await qrScannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner during close:', err);
      } finally {
        qrScannerRef.current = null;
        setIsInitialized(false);
        setScanned(false);
        setError('');
      }
    }

    // Call the close callback
    onClose();
  }, [onClose]);

  const handleCameraChange = useCallback(async (cameraId) => {
    if (cameraId === selectedCamera) return; // No change needed
    // Stop current scanner if running
    if (qrScannerRef.current && isInitialized) {
      try {
        await qrScannerRef.current.stop();
        await qrScannerRef.current.clear();
        qrScannerRef.current = null;
      } catch (err) {
        console.warn('Error stopping scanner during camera change:', err);
      }
    }

    // Reset state and set new camera
    setSelectedCamera(cameraId);
    setIsInitialized(false);
    setScanned(false);
    setError('');
    setIsScanning(false);
  }, [selectedCamera, isInitialized]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={handleBackdropClick}>
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
          {/* Camera Selection */}
          {cameraOptions.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Kamera:
              </label>
              <select
                value={selectedCamera}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isScanning}
              >
                {cameraOptions.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-semibold">Error:</p>
              <p className="text-sm">{error}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setError('');
                    getCameras();
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Refresh Kamera
                </button>
                <button
                  onClick={() => setError('')}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {/* Scanner Container */}
          {!error && (
            <>
              <div
                id="barcode-scanner-container"
                className="mb-4 border rounded bg-gray-50"
                style={{ minHeight: '350px', maxHeight: '400px' }}
              />

              {/* Status */}
              <div className="mb-4 text-center">
                {isScanning && !scanned && !isInitialized && (
                  <p className="text-blue-600 font-semibold">
                    ⚙️ Memulai scanner...
                  </p>
                )}
                {isScanning && !scanned && isInitialized && (
                  <p className="text-blue-600 font-semibold">
                    &nbsp;
                  </p>
                )}
                {scanned && (
                  <p className="text-green-600 font-semibold">
                    ✓ Barcode berhasil dipindai!
                  </p>
                )}
                {!isScanning && !scanned && isInitialized && (
                  <p className="text-gray-600">
                    📷 Kamera aktif - siap memindai
                  </p>
                )}
                {!isInitialized && !error && !isScanning && selectedCamera && (
                  <p className="text-orange-600">
                    🔄 Memulai scanner dengan kamera {cameraOptions.find(c => c.id === selectedCamera)?.label || selectedCamera}...
                  </p>
                )}
                {!isInitialized && !error && !isScanning && !selectedCamera && (
                  <p className="text-orange-600">
                    🔄 Pilih kamera dan klik "Mulai Scan"
                  </p>
                )}
              </div>
            </>
          )}



          {/* Controls */}
          <div className="flex gap-2 mt-4">
            {isInitialized && !isScanning && (
              <button
                onClick={async () => {
                  if (qrScannerRef.current) {
                    try {
                      await qrScannerRef.current.stop();
                      await qrScannerRef.current.clear();
                      setIsInitialized(false);
                      setIsScanning(false);
                    } catch (err) {
                      console.warn('Error stopping scanner:', err);
                    }
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Stop Scan
              </button>
            )}
            {!isInitialized && !error && !isScanning && (
              <button
                onClick={initScanner}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Mulai Scan
              </button>
            )}
            {isScanning && !isInitialized && (
              <div className="flex-1 px-4 py-2 bg-blue-500 text-white rounded opacity-50 cursor-not-allowed flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Memulai...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraBarcodeScanner;
