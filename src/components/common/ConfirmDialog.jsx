import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = 'Konfirmasi',
  cancelText = 'Batal',
  onConfirm,
  onCancel,
  variant = 'danger',
  isLoading = false
}) => {
  const confirmButtonRef = useRef(null);

  // Close on ESC and focus confirm on open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Auto-focus confirm button for rapid keyboard interaction
    if (confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  // Icon and theme selection based on variant
  let icon = <Info className="w-6 h-6 text-blue-600" />;
  let colorClass = 'bg-blue-100 text-blue-600';
  let buttonColorClass = 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';

  if (variant === 'danger') {
    icon = <Trash2 className="w-6 h-6 text-red-600" />;
    colorClass = 'bg-red-100 text-red-600';
    buttonColorClass = 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
  } else if (variant === 'warning') {
    icon = <AlertTriangle className="w-6 h-6 text-yellow-600" />;
    colorClass = 'bg-yellow-100 text-yellow-600';
    buttonColorClass = 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden transform transition-all p-6 scale-100">
        
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          title={cancelText}
          aria-label={cancelText}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content Body */}
        <div className="flex gap-4 items-start mt-2">
          <div className={`p-3 rounded-xl flex-shrink-0 ${colorClass}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 break-words">{title}</h3>
            <p className="text-sm text-slate-500 mt-2 whitespace-normal leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 text-white text-sm font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${buttonColorClass}`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Memproses...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
export { ConfirmDialog };
