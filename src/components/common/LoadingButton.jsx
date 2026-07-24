// src/components/common/LoadingButton.jsx
import React from 'react';

const LoadingButton = ({
  loading = false,
  loadingText = 'Memproses...',
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`relative ${className}`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <span className={loading ? 'invisible' : ''}>
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center text-sm">
          {loadingText}
        </span>
      )}
    </button>
  );
};

export default LoadingButton;