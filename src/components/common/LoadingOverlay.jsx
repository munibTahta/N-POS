// src/components/common/LoadingOverlay.jsx
import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const LoadingOverlay = ({
  loading = false,
  message = 'Memproses...',
  children
}) => {
  return (
    <div className="relative">
      {children}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
          <LoadingSpinner message={message} />
        </div>
      )}
    </div>
  );
};

export default LoadingOverlay;