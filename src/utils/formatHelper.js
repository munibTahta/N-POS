/**
 * Format number to Indonesian rupiah format (with thousands separator)
 * Example: 1000000 -> "1.000.000"
 * @param {number|string} num - Number to format
 * @returns {string} - Formatted number string
 */
export const formatCurrency = (num) => {
  if (!num || isNaN(num)) return '0';
  return Number(num).toLocaleString('id-ID');
};

/**
 * Remove formatting from input string and convert to number
 * Example: "1.000.000" -> 1000000
 * @param {string} str - Formatted number string
 * @returns {number} - Numeric value
 */
export const parseFormattedNumber = (str) => {
  if (!str) return 0;
  // Remove all dots (thousands separator)
  return Number(str.replace(/\./g, ''));
};
