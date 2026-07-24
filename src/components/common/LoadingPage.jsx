// src/components/common/LoadingPage.jsx
import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const LoadingPage = ({
  message = 'Memuat...',
  subtitle,
  className = ''
}) => {
  return (
    <div className={`min-h-screen bg-gray-50 flex items-center justify-center p-4 ${className}`}>
      <div className="text-center">
        <LoadingSpinner size="lg" message={message} />
        {subtitle && (
          <p className="text-gray-500 mt-2 text-sm">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingPage;