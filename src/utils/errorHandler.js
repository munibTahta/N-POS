// Centralized error handling utility
import { toast } from 'react-toastify';
import { logger } from './logger';

/**
 * Unified error handler with logging and user notification
 * @param {Error} error - The error object
 * @param {string} context - Where the error occurred (e.g., 'SalesListPage:void')
 * @param {string} fallbackMessage - Default message if error message not found
 * @returns {object} Structured error object
 */
export const handleError = (error, context = 'unknown', fallbackMessage = 'Terjadi kesalahan') => {
  // Extract message from various error formats
  let errorMessage = fallbackMessage;
  
  if (error?.response?.data?.message) {
    errorMessage = error?.response?.data?.message;
  } else if (error?.message) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // Log error with context
  logger.error(context, 'Error occurred', {
    message: errorMessage,
    status: error?.response?.status,
    data: error?.response?.data,
    originalError: error
  });

  // Notify user
  toast.error(errorMessage);

  // Return structured error
  return {
    message: errorMessage,
    status: error?.response?.status,
    context,
    original: error
  };
};

/**
 * Wrapper for async operations with automatic error handling
 * @param {Function} fn - Async function to execute
 * @param {string} context - Error context
 * @param {string} fallbackMessage - Fallback error message
 * @returns {Promise} Result or error
 */
export const handleAsync = async (fn, context = 'unknown', fallbackMessage = 'Terjadi kesalahan') => {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context, fallbackMessage);
    throw error; // Re-throw for caller to handle if needed
  }
};

/**
 * Format API error message for display
 * @param {Error} error - API error
 * @returns {string} User-friendly message
 */
export const getErrorMessage = (error) => {
  if (error?.response?.status === 401) {
    return 'Sesi Anda telah berakhir. Silakan login kembali.';
  }
  if (error?.response?.status === 403) {
    return 'Anda tidak memiliki akses ke fitur ini.';
  }
  if (error?.response?.status === 404) {
    return 'Data tidak ditemukan.';
  }
  if (error?.response?.status === 422) {
    // Validation error
    const messages = error?.response?.data?.errors;
    if (messages && typeof messages === 'object') {
      return Object.values(messages).flat().join(', ');
    }
    return 'Data tidak valid. Periksa kembali input Anda.';
  }
  if (error?.response?.status >= 500) {
    return 'Terjadi kesalahan server. Coba lagi nanti.';
  }
  if (error?.response?.data?.message) {
    return error?.response?.data?.message;
  }
  if (error?.message) {
    return error.message;
  }
  return 'Terjadi kesalahan yang tidak terduga.';
};

/**
 * Success notification
 * @param {string} message - Success message
 */
export const handleSuccess = (message = 'Berhasil') => {
  toast.success(message);
};

/**
 * Warning notification
 * @param {string} message - Warning message
 */
export const handleWarning = (message = 'Perhatian') => {
  toast.warning(message);
};

/**
 * Info notification
 * @param {string} message - Info message
 */
export const handleInfo = (message = 'Informasi') => {
  toast.info(message);
};
