/**
 * Helper utilities for formatting Indonesian Rupiah numbers inside input fields
 */

/**
 * Format raw number or digit string into thousands separated string (e.g. 150000 -> 150.000)
 * @param {number|string} val 
 * @returns {string}
 */
export const formatRupiahNumber = (val) => {
  if (val === undefined || val === null || val === '') return '';
  // Remove all characters except digits
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  return new Intl.NumberFormat('id-ID').format(parseInt(clean, 10));
};

/**
 * Parse thousands-separated string back to raw integer (e.g. 150.000 -> 150000)
 * @param {string} val 
 * @returns {number}
 */
export const parseRupiahNumber = (val) => {
  if (!val) return 0;
  const clean = String(val).replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
};
