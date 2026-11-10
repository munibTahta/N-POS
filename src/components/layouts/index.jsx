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
export const PageHeader = ({ title, subtitle, description, actions, className = '' }) => {
  const sub = subtitle ?? description; // beberapa halaman memakai `description`
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {sub && (
            <div className="mt-1 text-sm text-gray-600">{sub}</div>
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
/**
 * Subjudul informatif: bagian-bagian dipisah titik tengah, boleh membungkus di layar sempit.
 * Aturan isi: KONTEKS + KESEGARAN data (periode, cabang, diperbarui pukul), bukan mengulang angka yang sudah ada di kartu ringkasan.
 * `parts`: string | node | { text, tone: 'warn' }. Bagian kosong dilewati.
 */
export const MetaLine = ({ parts = [], className = '' }) => {
  const items = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== '');
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      {items.map((p, i) => {
        const obj = typeof p === 'object' && p && 'text' in p ? p : { text: p };
        return (
          <React.Fragment key={i}>
            {i > 0 && <span aria-hidden="true" className="text-gray-500">&bull;</span>}
            <span className={obj.tone === 'warn' ? 'font-medium text-amber-700 dark:text-amber-300' : undefined}>{obj.text}</span>
          </React.Fragment>
        );
      })}
    </p>
  );
};
