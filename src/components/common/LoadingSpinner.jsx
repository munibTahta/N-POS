// src/components/common/LoadingSpinner.jsx
import React from 'react';

const LoadingSpinner = ({
  size = 'md',
  message = 'Memuat...',
  overlay = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2`}></div>
      {message && (
        <p className="text-sm text-gray-600 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-xl">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;