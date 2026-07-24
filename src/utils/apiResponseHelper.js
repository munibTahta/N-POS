/**
 * Helper untuk menangani berbagai bentuk response dari API
 * Backend inconsistency: kadang return { data: {...} }, kadang { data: { data: {...} } }, kadang langsung array
 */

/**
 * Extract data dari response API dengan berbagai bentuk
 * Priority: response.data.data → response.data → response
 */
export const extractData = (response) => {
  if (!response) return null;
  return response?.data?.data || response?.data || response;
};

/**
 * Extract array dari response (default empty array jika tidak ada)
 * Handle berbagai struktur response API
 */
export const extractArray = (response, defaultValue = []) => {
  const data = extractData(response);

  // Jika sudah array, return langsung
  if (Array.isArray(data)) return data;

  // Jika ada data.detail (seperti di payment history), return detail
  if (data?.detail && Array.isArray(data.detail)) return data.detail;

  // Jika ada data.data dan array, return data.data
  if (Array.isArray(data?.data)) return data.data;

  // Fallback ke default
  return defaultValue;
};

/**
 * Safe normalize pembayaran/payment object untuk display
 * Handle multiple response shapes from backend
 */
export const normalizePaymentMethod = (paymentObj) => {
  if (!paymentObj) return 'Tunai';
  
  // Jika string, return as-is
  if (typeof paymentObj === 'string') return paymentObj;
  
  // Jika object, cari field yang cocok
  return (
    paymentObj.nama_metode ||
    paymentObj.nama ||
    paymentObj.method_name ||
    paymentObj.payment_method ||
    'Tunai'
  );
};

/**
 * Normalize item/line item dari response
 */
export const normalizeLineItem = (item) => {
  if (!item) return null;
  
  return {
    id_produk: item.id_produk || item.product_id,
    qty: Number(item.qty || item.jumlah || item.quantity || 0),
    harga_satuan: Number(item.harga_satuan || item.harga || item.harga_jual || item.price || 0),
    nama_produk: item.nama_produk || item.product_name || item.name || '',
    kode_produk: item.kode_produk || item.sku || item.code || '',
    subtotal: Number(item.subtotal || (Number(item.qty || item.jumlah || 0) * Number(item.harga_satuan || item.harga || item.harga_jual || 0)))
  };
};

/**
 * Normalize sale/penjualan object dari response
 */
export const normalizeSale = (sale) => {
  if (!sale) return null;
  
  return {
    id_penjualan: sale.id_penjualan || sale.id || sale.sale_id,
    kode_transaksi: sale.kode_transaksi || sale.code || sale.transaction_code,
    no_struk: sale.no_struk || sale.receipt_number,
    tanggal: sale.tanggal || sale.date || sale.created_at,
    total: Number(sale.total || sale.total_akhir || 0),
    bayar: Number(sale.bayar || sale.paid || sale.amount_paid || 0),
    diskon: Number(sale.diskon || sale.discount || 0),
    pajak: Number(sale.pajak || sale.tax || 0),
    subtotal: Number(sale.subtotal || 0),
    id_pelanggan: sale.id_pelanggan || sale.customer_id,
    id_user: sale.id_user || sale.user_id,
    id_cabang: sale.id_cabang || sale.branch_id,
    status_pembayaran: sale.status_pembayaran || sale.payment_status || 'menunggu',
    items: Array.isArray(sale.items) ? sale.items.map(normalizeLineItem) : [],
    // Handle metode_pembayaran yang bisa array atau object
    metode_pembayaran: Array.isArray(sale.metode_pembayaran) 
      ? sale.metode_pembayaran.map(normalizePaymentMethod) 
      : normalizePaymentMethod(sale.metode_pembayaran)
  };
};

export default {
  extractData,
  extractArray,
  normalizePaymentMethod,
  normalizeLineItem,
  normalizeSale
};
