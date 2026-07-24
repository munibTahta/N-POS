/**
 * Error Message Mapper - Converts technical errors to user-friendly messages
 * Provides recovery suggestions and categorization
 */

const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  AUTH: 'auth',
  SERVER: 'server',
  OFFLINE: 'offline',
  PAYMENT: 'payment',
  INVENTORY: 'inventory',
  UNKNOWN: 'unknown'
};

const ERROR_MAPPINGS = {
  // Validation errors
  'Keranjang masih kosong': {
    category: ERROR_CATEGORIES.VALIDATION,
    severity: 'warning',
    userMessage: 'Keranjang belum ada produk. Tambahkan minimal 1 produk sebelum melanjutkan.',
    recovery: 'Cari dan tambahkan produk ke keranjang'
  },
  'tidak lengkap': {
    category: ERROR_CATEGORIES.VALIDATION,
    severity: 'warning',
    userMessage: 'Data tidak lengkap. Periksa kembali semua field yang wajib diisi.',
    recovery: 'Lengkapi semua field yang diperlukan'
  },
  'Pilih metode pembayaran': {
    category: ERROR_CATEGORIES.PAYMENT,
    severity: 'warning',
    userMessage: 'Metode pembayaran belum dipilih.',
    recovery: 'Pilih salah satu metode pembayaran yang tersedia'
  },
  'Stok tidak mencukupi': {
    category: ERROR_CATEGORIES.INVENTORY,
    severity: 'error',
    userMessage: 'Stok produk tidak mencukupi untuk jumlah yang diminta.',
    recovery: 'Kurangi jumlah atau pilih produk lain'
  },
  'Masukkan jumlah pembayaran': {
    category: ERROR_CATEGORIES.VALIDATION,
    severity: 'warning',
    userMessage: 'Jumlah pembayaran belum diisi.',
    recovery: 'Masukkan nominal pembayaran atau tandai sebagai pending'
  },
  'kurang dari total': {
    category: ERROR_CATEGORIES.PAYMENT,
    severity: 'warning',
    userMessage: 'Jumlah pembayaran kurang dari total. Centang "Pending" untuk pembayaran nanti atau tambahkan pembayaran.',
    recovery: 'Tambahkan pembayaran atau centang opsi pembayaran pending'
  },
  'negatif': {
    category: ERROR_CATEGORIES.VALIDATION,
    severity: 'error',
    userMessage: 'Jumlah tidak boleh negatif.',
    recovery: 'Masukkan angka positif'
  },

  // Network errors
  'Network request failed': {
    category: ERROR_CATEGORIES.NETWORK,
    severity: 'error',
    userMessage: 'Koneksi internet hilang atau tidak stabil.',
    recovery: 'Periksa koneksi internet dan coba lagi'
  },
  'timeout': {
    category: ERROR_CATEGORIES.NETWORK,
    severity: 'error',
    userMessage: 'Permintaan ke server timeout. Coba beberapa saat lagi.',
    recovery: 'Tunggu beberapa saat dan coba lagi'
  },
  'ECONNREFUSED': {
    category: ERROR_CATEGORIES.NETWORK,
    severity: 'error',
    userMessage: 'Server tidak dapat dijangkau. Periksa koneksi atau server.',
    recovery: 'Periksa koneksi internet dan hubungi administrator'
  },

  // Server errors
  'Gagal membuat transaksi': {
    category: ERROR_CATEGORIES.SERVER,
    severity: 'error',
    userMessage: 'Transaksi gagal dibuat di server. Silakan coba lagi.',
    recovery: 'Coba lagi dalam beberapa saat. Jika tetap gagal, hubungi support'
  },
  'tidak ditemukan': {
    category: ERROR_CATEGORIES.SERVER,
    severity: 'error',
    userMessage: 'Data tidak ditemukan. Produk mungkin telah dihapus.',
    recovery: 'Sinkronkan data dan coba lagi. Hubungi administrator jika berlanjut'
  },
  '500': {
    category: ERROR_CATEGORIES.SERVER,
    severity: 'error',
    userMessage: 'Server mengalami error. Silakan coba beberapa saat lagi.',
    recovery: 'Hubungi administrator atau coba lagi nanti'
  },
  '503': {
    category: ERROR_CATEGORIES.SERVER,
    severity: 'error',
    userMessage: 'Server sedang maintenance. Coba beberapa saat lagi.',
    recovery: 'Tunggu server siap atau hubungi administrator'
  },

  // Auth errors
  'Unauthorized': {
    category: ERROR_CATEGORIES.AUTH,
    severity: 'error',
    userMessage: 'Sesi Anda telah berakhir. Silakan login ulang.',
    recovery: 'Login kembali dengan username dan password Anda'
  },
  'Forbidden': {
    category: ERROR_CATEGORIES.AUTH,
    severity: 'error',
    userMessage: 'Anda tidak memiliki izin untuk melakukan tindakan ini.',
    recovery: 'Hubungi administrator untuk mendapatkan akses'
  },

  // Offline errors
  'offline': {
    category: ERROR_CATEGORIES.OFFLINE,
    severity: 'info',
    userMessage: 'Mode offline aktif. Transaksi akan disimpan secara lokal dan disinkronkan saat online.',
    recovery: 'Transaksi sudah disimpan. Akan disinkronkan otomatis'
  },
  'database not available': {
    category: ERROR_CATEGORIES.OFFLINE,
    severity: 'error',
    userMessage: 'Database offline tidak tersedia.',
    recovery: 'Restart aplikasi atau hubungi support'
  }
};

/**
 * Extract user-friendly message from error
 */
export const mapErrorToUserMessage = (error) => {
  if (!error) {
    return {
      category: ERROR_CATEGORIES.UNKNOWN,
      severity: 'error',
      userMessage: 'Terjadi kesalahan yang tidak diketahui',
      recovery: 'Coba lagi atau hubungi support'
    };
  }

  const errorText = error.response?.data?.message || error.message || String(error);

  // Try to find exact or partial match in mappings
  for (const [key, mapping] of Object.entries(ERROR_MAPPINGS)) {
    if (errorText.toLowerCase().includes(key.toLowerCase())) {
      return mapping;
    }
  }

  // Default fallback
  return {
    category: ERROR_CATEGORIES.UNKNOWN,
    severity: 'error',
    userMessage: `Terjadi kesalahan: ${errorText.substring(0, 100)}`,
    recovery: 'Coba lagi atau hubungi support'
  };
};

/**
 * Get recovery suggestion based on error
 */
export const getRecoverySuggestion = (error) => {
  const mapped = mapErrorToUserMessage(error);
  return mapped.recovery;
};

/**
 * Check if error is recoverable (user can retry)
 */
export const isRecoverableError = (error) => {
  const mapped = mapErrorToUserMessage(error);
  return [ERROR_CATEGORIES.NETWORK, ERROR_CATEGORIES.PAYMENT].includes(mapped.category);
};

/**
 * Check if should show retry button
 */
export const shouldShowRetry = (error) => {
  const mapped = mapErrorToUserMessage(error);
  return isRecoverableError(error) || mapped.severity === 'warning';
};

export default {
  ERROR_CATEGORIES,
  mapErrorToUserMessage,
  getRecoverySuggestion,
  isRecoverableError,
  shouldShowRetry
};
