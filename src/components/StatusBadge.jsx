import React from 'react';

/**
 * Standardized Status Badge Component
 * Provides consistent outline style status badges across all data tables
 * 
 * USAGE:
 * <StatusBadge status="normal" label="Normal" />
 * <StatusBadge status="rendah" label="Rendah" />
 * <StatusBadge status="kritis" label="Kritis" />
 * <StatusBadge status="habis" label="Habis" />
 */

const StatusBadge = ({ status = 'normal', label = '' }) => {
  const styles = {
    normal: {
      container: 'bg-green-50 border border-green-200',
      text: 'text-green-700'
    },
    rendah: {
      container: 'bg-yellow-50 border border-yellow-200',
      text: 'text-yellow-700'
    },
    kritis: {
      container: 'bg-orange-50 border border-orange-200',
      text: 'text-orange-700'
    },
    habis: {
      container: 'bg-red-50 border border-red-200',
      text: 'text-red-700'
    },
    low: {
      container: 'bg-yellow-50 border border-yellow-200',
      text: 'text-yellow-700'
    },
    critical: {
      container: 'bg-orange-50 border border-orange-200',
      text: 'text-orange-700'
    },
    'out-of-stock': {
      container: 'bg-red-50 border border-red-200',
      text: 'text-red-700'
    }
  };

  const selectedStyle = styles[status] || styles.normal;

  return (
    <span
      className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${selectedStyle.container} ${selectedStyle.text}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
