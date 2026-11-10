'use strict';
// Normalisasi dan validasi payload penjualan offline sebelum disimpan ke SQLite.

function normalizeOfflineSalePayload({ saleData, items, payments }) {
  if (!saleData || typeof saleData !== 'object') throw new Error('Invalid sale data');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Sale items are required for offline transaction');

  const normalizedItems = items.map((item, index) => {
    const idProduk = item.id_produk || item.idProduk || item.product_id;
    const jumlah = Number(item.jumlah || item.quantity || 0);
    const hargaSatuan = Number(item.harga_satuan || item.harga_jual || 0);

    if (!idProduk) throw new Error(`Item ${index + 1}: id_produk tidak valid`);
    if (!Number.isFinite(jumlah) || jumlah <= 0) throw new Error(`Item ${index + 1}: jumlah harus lebih dari 0`);
    if (!Number.isFinite(hargaSatuan) || hargaSatuan < 0) throw new Error(`Item ${index + 1}: harga_satuan tidak valid`);

    const expectedSubtotal = Number((jumlah * hargaSatuan).toFixed(2));
    if (!Number.isFinite(expectedSubtotal) || expectedSubtotal < 0) {
      throw new Error(`Item ${index + 1}: subtotal tidak valid`);
    }

    return {
      ...item,
      id_produk: idProduk,
      jumlah,
      harga_satuan: hargaSatuan,
      subtotal: expectedSubtotal,
      diskon_item: Number(item.diskon_item || 0),
      pajak_item: Number(item.pajak_item || 0)
    };
  });

  const computedTotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
  if (!Number.isFinite(computedTotal) || computedTotal < 0) {
    throw new Error('Total transaksi tidak valid');
  }

  const normalizedPayments = Array.isArray(payments) ? payments.map((payment, index) => {
    const amount = Number(payment.jumlah_bayar || payment.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Payment ${index + 1}: jumlah_bayar tidak valid`);
    }
    if (!payment.id_metode_pembayaran) {
      throw new Error(`Payment ${index + 1}: id_metode_pembayaran diperlukan`);
    }
    return {
      ...payment,
      jumlah_bayar: amount,
      created_at: payment.created_at || new Date().toISOString()
    };
  }) : [];

  const paidTotal = normalizedPayments.reduce((sum, payment) => sum + payment.jumlah_bayar, 0);
  const statusPembayaran = paidTotal >= computedTotal ? 'lunas' : 'pending';
  const kembalian = paidTotal > computedTotal ? Number((paidTotal - computedTotal).toFixed(2)) : 0;
  const sisaPembayaran = paidTotal < computedTotal ? Number((computedTotal - paidTotal).toFixed(2)) : 0;

  return {
    saleData: {
      ...saleData,
      total: computedTotal,
      bayar: paidTotal,
      kembalian,
      sisa_pembayaran: sisaPembayaran,
      status_pembayaran: saleData.status_pembayaran || statusPembayaran
    },
    items: normalizedItems,
    payments: normalizedPayments
  };
}

module.exports = { normalizeOfflineSalePayload };
