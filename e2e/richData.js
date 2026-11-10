// Data contoh yang cukup kaya agar halaman daftar/laporan tidak jatuh ke keadaan kosong (dipakai audit kontras tema).
const day = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 5, 0, 0); return d.toISOString(); };
const METHODS = ['Tunai', 'QRIS', 'Kartu Debit', 'Transfer'];
export const richSales = Array.from({ length: 16 }, (_, i) => {
  const total = 15000 + i * 7300, m = METHODS[i % METHODS.length];
  return {
    id_penjualan: i + 1, id: i + 1, kode_transaksi: `TRX-2026-${String(i + 1).padStart(4, '0')}`, tanggal: day(i % 12, 8 + (i % 9)), total, bayar: i % 5 === 0 ? total - 5000 : total,
    sisa_pembayaran: i % 5 === 0 ? 5000 : 0, status_pembayaran: i % 5 === 0 ? 'sebagian' : 'lunas', id_cabang: 1, id_user: 1, is_void: false,
    Cabang: { nama_cabang: 'Cabang Pusat' }, cabang: { nama_cabang: 'Cabang Pusat' }, user: { nama_lengkap: 'Kasir Satu', username: 'kasir1' }, User: { nama_lengkap: 'Kasir Satu' },
    detail_pembayaran: [{ jumlah_bayar: i % 5 === 0 ? total - 5000 : total, metodePembayaran: { nama_metode: m } }],
    items: [{ id_produk: (i % 8) + 1, nama_produk: `Produk contoh ${(i % 8) + 1}`, jumlah: 1 + (i % 3), harga_jual: 5000 + i * 100, subtotal: total, tipe_harga: i % 4 === 0 ? 'grosir' : 'eceran' }],
  };
});
const people = (n, prefix) => Array.from({ length: n }, (_, i) => ({ [`id_${prefix}`]: i + 1, id: i + 1, [`nama_${prefix}`]: `${prefix === 'pelanggan' ? 'Pelanggan' : 'Supplier'} ${i + 1}`, nomor_hp: `0812000000${i}`, email: `p${i + 1}@contoh.id`, alamat: `Jl. Contoh No. ${i + 1}`, tipe_pelanggan: ['regular', 'member', 'vip'][i % 3], poin_loyalty: i * 10, kontak: `0812000000${i}` }));
export function richApi(route, req) {
  if (req.method() !== 'GET') return false;
  const path = req.url().split('?')[0];
  const send = (data, extra = {}) => { route.fulfill({ json: { success: true, data, pagination: { total: data.length, page: 1, limit: 50 }, ...extra } }); return true; };
  if (/\/penjualan$/.test(path)) return send(richSales);
  if (/\/pelanggan$/.test(path)) return send(people(9, 'pelanggan'));
  if (/\/supplier$/.test(path)) return send(people(6, 'supplier'));
  if (/\/pembelian$/.test(path)) return send(Array.from({ length: 7 }, (_, i) => ({ id_pembelian: i + 1, kode_pembelian: `PB-${i + 1}`, tanggal: day(i), total: 250000 + i * 15000, status: 'selesai', masuk_gudang: true, supplier: { nama_supplier: `Supplier ${(i % 5) + 1}` }, nama_supplier: `Supplier ${(i % 5) + 1}` })));
  if (/\/users$/.test(path)) return send(Array.from({ length: 5 }, (_, i) => ({ id_user: i + 1, username: `user${i + 1}`, nama_lengkap: `Pengguna ${i + 1}`, email: `u${i + 1}@contoh.id`, role: ['admin', 'kasir', 'owner'][i % 3], id_cabang: 1 })));
  if (/\/cabang$/.test(path)) return send(Array.from({ length: 3 }, (_, i) => ({ id_cabang: i + 1, kode_cabang: `C0${i + 1}`, nama_cabang: `Cabang ${i + 1}`, alamat: 'Jl. Raya 1', kota: 'Kota', no_telp: '021000', status: 'aktif', tipe_katalog: i > 1 ? 'terpisah' : 'global' })));
  if (/\/retur-penjualan$/.test(path)) return send([]);
  return false;
}
