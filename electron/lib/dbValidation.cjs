'use strict';
// Daftar putih tabel/kolom dan validasi klausa WHERE untuk IPC database (mencegah SQL injection). Diekstrak dari main.cjs agar dapat diuji.

// ✅ FIX #3: Define allowed columns for each table (prevent SQL injection)
const ALLOWED_COLUMNS = {
  products: ['id_produk', 'kode_produk', 'nama_produk', 'id_kategori', 'id_satuan', 'harga_beli', 'harga_jual', 'harga_grosir', 'min_qty_grosir', 'stok_minimum', 'status', 'gambar', 'barcode', 'merek', 'lokasi_rak', 'deskripsi', 'foto_produk', 'created_at', 'updated_at', 'synced', 'sync_version', 'id_cabang_pemilik', 'urutan'],
  branches: ['id_cabang', 'kode_cabang', 'nama_cabang', 'alamat', 'kota', 'no_telp', 'status', 'tipe_katalog', 'created_at'],
  sales: ['id_penjualan', 'kode_transaksi', 'id_cabang', 'id_pelanggan', 'id_user', 'tanggal', 'total', 'total_diskon', 'pajak', 'metode_pembayaran', 'status', 'status_pembayaran', 'catatan', 'tanggal_transaksi', 'created_at', 'updated_at', 'synced', 'sync_version', 'bayar', 'diskon'],
  sale_items: ['id', 'id_penjualan', 'id_produk', 'jumlah', 'harga_satuan', 'subtotal', 'diskon_item', 'created_at', 'tipe_harga', 'harga_produk'],
  payment_details: ['id', 'id_penjualan', 'metode_pembayaran', 'shadow_pay', 'jumlah_bayar', 'created_at'],
  sync_queue: ['id', 'table_name', 'operation', 'record_id', 'data', 'status', 'error_message', 'created_at', 'updated_at', 'server_id', 'retry_count'],
  sync_metadata: ['key', 'value', 'created_at', 'updated_at'],
  categories: ['id_kategori', 'nama_kategori', 'created_at', 'updated_at', 'synced', 'sync_version'],
  units: ['id_satuan', 'nama_satuan', 'created_at', 'updated_at', 'synced', 'sync_version'],
  customers: ['id_pelanggan', 'nama_pelanggan', 'nomor_hp', 'email', 'alamat', 'created_at', 'updated_at', 'synced', 'sync_version'],
  supplier: ['id_supplier', 'nama_supplier', 'alamat', 'telepon', 'email', 'created_at', 'updated_at', 'synced', 'sync_version'],
  suppliers: ['id_supplier', 'nama_supplier', 'alamat', 'telepon', 'email', 'created_at', 'updated_at', 'synced', 'sync_version'],
  purchases: ['id_pembelian', 'kode_pembelian', 'id_supplier', 'id_cabang', 'tanggal', 'total', 'status', 'masuk_gudang', 'catatan', 'id_user', 'created_at', 'updated_at', 'synced', 'sync_version'],
  purchase_items: ['id', 'id_pembelian', 'id_produk', 'jumlah', 'harga_beli', 'subtotal', 'created_at'],
  metode_pembayaran: ['id_metode', 'kode_metode', 'nama_metode', 'tipe_metode', 'aktif', 'konfigurasi', 'is_default', 'urutan_tampil', 'biaya_tambahan_persen', 'biaya_tambahan_nominal', 'minimum_transaksi', 'maksimum_transaksi', 'created_at', 'updated_at', 'synced', 'sync_version'],
  warehouse_stock: ['id', 'id_produk', 'id_cabang', 'stok', 'lokasi_rak', 'updated_at']
};

// Validate column names (prevent SQL injection via column names)
function validateColumns(table, columns) {
  const allowedCols = ALLOWED_COLUMNS[table] || [];
  for (const col of columns) {
    if (!allowedCols.includes(col)) {
      throw new Error(`⚠️ SQL Injection Attempt: Column "${col}" not allowed in table "${table}"`);
    }
  }
}

const ALLOWED_TABLES = Object.keys(ALLOWED_COLUMNS);

function validateWhereClause(whereClause) {
  if (!whereClause || typeof whereClause !== 'string') {
    throw new Error('WHERE clause must be a non-empty string');
  }
  const forbidden = /;|--|\/\*|\*\//;
  if (forbidden.test(whereClause)) {
    throw new Error('Invalid WHERE clause');
  }
  const safePattern = /^[\w\s=<>!\.%'"(),\-?]+$/;
  if (!safePattern.test(whereClause)) {
    throw new Error('WHERE clause contains unsupported characters');
  }
}

module.exports = { ALLOWED_COLUMNS, ALLOWED_TABLES, validateColumns, validateWhereClause };
