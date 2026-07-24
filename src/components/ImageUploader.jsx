import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle, Image as ImageIcon, Loader } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

/**
 * Reusable HTML5 Canvas-based image compressor
 */
export const compressImage = (file, options = {}) => {
  const { maxWidth = 1024, maxHeight = 1024, quality = 0.75 } = options;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Calculate optimal dimensions keeping aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Gagal melakukan kompresi gambar'));
              return;
            }
            // Create a compressed File object
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg', // Output as JPEG for maximum compression efficiency
              lastModified: Date.now()
            });
            resolve({
              file: compressedFile,
              originalWidth: img.width,
              originalHeight: img.height,
              compressedWidth: width,
              compressedHeight: height
            });
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const ImageUploader = ({
  onChange,
  onRemove,
  value = null, // Initial or current File or string URL
  maxSizeMB = 5,
  compressQuality = 0.75,
  maxWidth = 1024,
  maxHeight = 1024,
  label = 'Upload Gambar',
  description = 'Format: JPG, PNG, GIF. Otomatis dikompres agar optimal.',
  className = ''
}) => {
  const { error: showError } = useNotifications();
  const fileInputRef = useRef(null);
  
  const [preview, setPreview] = useState(typeof value === 'string' ? value : null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [compressStats, setCompressStats] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Parse initial value (if it's a File object)
  React.useEffect(() => {
    if (value && value instanceof File) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(value);
    } else if (typeof value === 'string') {
      setPreview(value);
    } else if (!value) {
      setPreview(null);
      setCompressStats(null);
    }
  }, [value]);

  const processFile = async (file) => {
    if (!file) return;

    // Validate size limit (before compression)
    if (file.size > maxSizeMB * 1024 * 1024) {
      showError(`Ukuran file melebihi batas maksimal ${maxSizeMB}MB.`);
      return;
    }

    // Validate image format
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showError('Hanya format JPEG, PNG, GIF, dan WEBP yang didukung.');
      return;
    }

    try {
      setIsCompressing(true);
      const originalSize = file.size;

      // Compress
      const result = await compressImage(file, { maxWidth, maxHeight, quality: compressQuality });
      
      const compressedSize = result.file.size;
      const ratio = Math.round(((originalSize - compressedSize) / originalSize) * 100);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(result.file);

      // Save statistics
      setCompressStats({
        originalSize: (originalSize / 1024).toFixed(1) + ' KB',
        compressedSize: (compressedSize / 1024).toFixed(1) + ' KB',
        ratio: ratio > 0 ? `${ratio}% lebih hemat` : '0%',
        originalDim: `${result.originalWidth}x${result.originalHeight}`,
        compressedDim: `${result.compressedWidth}x${result.compressedHeight}`
      });

      // Call callback with compressed File
      if (onChange) {
        onChange(result.file);
      }
    } catch (err) {
      console.error('Compression failed:', err);
      showError('Gagal mengompresi gambar, menggunakan file asli.');
      
      // Fallback to original file
      setPreview(URL.createObjectURL(file));
      if (onChange) onChange(file);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setPreview(null);
    setCompressStats(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onRemove) onRemove();
    if (onChange) onChange(null);
  };

  return (
    <div className={`w-full ${className}`}>
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      
      {!preview && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl py-8 px-4 text-center cursor-pointer transition duration-300 bg-white hover:bg-slate-50 ${
            isDragActive 
              ? 'border-blue-500 bg-blue-50/50 scale-[0.99]' 
              : 'border-slate-300 hover:border-blue-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {isCompressing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-700">Mengompresi & mengoptimalkan gambar...</p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-blue-50 rounded-full text-blue-600 mb-3 group-hover:scale-110 transition duration-300">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-1">
                Tarik gambar kemari atau <span className="text-blue-600 hover:underline">Pilih File</span>
              </p>
              <p className="text-xs text-slate-500 max-w-xs">{description}</p>
            </>
          )}
        </div>
      )}

      {preview && (
        <div className="relative border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-4 transition duration-300 hover:shadow-md">
          {/* Preview Image */}
          <div className="relative w-32 h-32 flex-shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
            <img
              src={preview}
              alt="Uploaded preview"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Metadata & Stats */}
          <div className="flex-grow text-center sm:text-left space-y-1.5 min-w-0">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center justify-center sm:justify-start gap-1.5">
              <ImageIcon className="w-4 h-4 text-blue-500" />
              Gambar Terpilih
            </h4>
            
            {compressStats ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                <div>Dimensi Asli: <strong className="text-slate-800">{compressStats.originalDim}</strong></div>
                <div>Dimensi Baru: <strong className="text-slate-800">{compressStats.compressedDim}</strong></div>
                <div>Ukuran Asli: <strong className="text-slate-800">{compressStats.originalSize}</strong></div>
                <div>Ukuran Baru: <strong className="text-slate-800 text-emerald-600">{compressStats.compressedSize}</strong></div>
                
                <div className="col-span-2 pt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Optimal: {compressStats.ratio}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Membuka pratinjau gambar...</p>
            )}
          </div>

          {/* Remove Button */}
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 sm:static p-2 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 rounded-full shadow-sm hover:border-red-100 transition duration-300"
            title="Hapus gambar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
