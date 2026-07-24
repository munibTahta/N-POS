import React from 'react';

/**
 * PageLayout - Main page container component
 * Provides full-width responsive container with consistent padding
 */
export const PageLayout = ({ children, className = '', maxWidth = 'none' }) => {
  const maxWidthMap = {
    'xs': 'max-w-xs',
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    'full': 'max-w-full',
    'none': 'max-w-none',
    '1400': 'max-w-[1400px]',
    '1600': 'max-w-[1600px]',
    '1800': 'max-w-[1800px]',
  };
  const maxWClass = maxWidthMap[maxWidth] || 'max-w-none';
  return (
    <div className={`w-full mx-auto ${className}`}>
      <div className={`${maxWClass} mx-auto`}>
        {children}
      </div>
    </div>
  );
};

/**
 * PageContainer - Content section container
 * Provides white background with shadow, rounded corners, and consistent padding
 */
export const PageContainer = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 ${className}`}>
      {children}
    </div>
  );
};

/**
 * PageHeader - Page title and actions component
 * Provides consistent page title styling with optional subtitle and actions
 */
export const PageHeader = ({ title, subtitle, actions, className = '' }) => {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};