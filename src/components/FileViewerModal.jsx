import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw, Download, Copy, Check } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

const FileViewerModal = ({
  isOpen,
  onClose,
  fileUrl,
  fileName = 'Pratinjau File'
}) => {
  const { success: showSuccess, error: showError } = useNotifications();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);

  // Reset controls when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setCopied(false);
    }
  }, [isOpen, fileUrl]);

  // Handle keyboard events (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !fileUrl) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(3, prev + 0.2));
  const handleZoomOut = () => setZoom(prev => Math.max(0.5, prev - 0.2));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fileUrl);
      setCopied(true);
      showSuccess('Tautan gambar berhasil disalin ke papan klip!');
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {
      showError('Gagal menyalin tautan.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in p-4">
      {/* Top Glassmorphic Navigation Bar */}
      <div className="absolute top-0 inset-x-0 h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 z-10">
        <h3 className="text-white font-medium truncate max-w-[50%] sm:max-w-[70%]">
          {fileName}
        </h3>
        
        {/* Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition duration-200"
            title="Perkecil"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleZoomIn}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition duration-200"
            title="Perbesar"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleRotate}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition duration-200"
            title="Putar 90°"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleReset}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition duration-200"
            title="Reset Posisi"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <span className="w-px h-6 bg-slate-800 mx-1" />

          <button
            onClick={handleCopyLink}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition duration-200"
            title="Salin Tautan"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          </button>

          <a
            href={fileUrl}
            download={fileName}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition duration-200"
            title="Unduh File"
          >
            <Download className="w-5 h-5" />
          </a>

          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition duration-200 ml-2"
            title="Tutup (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div 
        className="w-full h-full flex items-center justify-center pt-16 select-none overflow-hidden"
        onClick={onClose}
      >
        <div 
          className="relative max-w-full max-h-[85vh] transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white/5 border border-slate-800"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

export default FileViewerModal;
