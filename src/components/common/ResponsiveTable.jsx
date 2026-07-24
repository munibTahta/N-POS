import React from 'react';

// Wrapper to make tables horizontally scrollable on small screens
// and provide consistent padding and optional sticky header support.
export default function ResponsiveTable({ children, className = '', innerProps = {} }) {
  return (
    <div className="-mx-2 sm:-mx-4 lg:-mx-6 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="inline-block min-w-full py-2 align-middle px-2 sm:px-4 lg:px-6">
        <div className={`shadow-sm ring-1 ring-black ring-opacity-5 overflow-hidden rounded-lg ${className}`}>
          <div className="overflow-x-auto">
            {React.isValidElement(children) ? React.cloneElement(children, { ...innerProps }) : children}
          </div>
        </div>
      </div>
    </div>
  );
}
