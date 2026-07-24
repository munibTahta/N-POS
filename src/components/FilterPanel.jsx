import React from 'react';

export const FilterPanel = ({ visible, children, className = '' }) => {
  if (!visible) return null;

  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 ${className}`}>
      {children}
    </div>
  );
};

export const FilterPanelGrid = ({ cols = 2, children, className = '' }) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <div className={`grid gap-4 ${gridCols[cols] || gridCols[2]} ${className}`}>
      {children}
    </div>
  );
};

export const FilterField = ({ label, children, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-xs font-semibold text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
};