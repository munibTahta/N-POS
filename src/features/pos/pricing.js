/**
 * Aturan harga eceran/grosir kasir (fungsi murni, satu sumber kebenaran).
 *
 * Mode otomatis: harga grosir dipakai bila `harga_grosir` ada, LEBIH MURAH dari harga eceran, dan jumlah >= `min_qty_grosir`.
 * Harga grosir yang sama/lebih tinggi dari eceran dianggap salah data dan tidak dipakai otomatis (tidak ada manfaat bagi pembeli).
 * Pilihan manual kasir ('eceran' | 'grosir') selalu dihormati.
 *
 * Catatan data: bila `min_qty_grosir` bernilai 1, grosir berlaku sejak pembelian pertama. Itu keputusan harga pemilik toko,
 * bukan galat perhitungan; lihat scripts/report-grosir.js di backend untuk laporan produk seperti itu.
 */
export function computeProductPricing(product, quantity, override) {
  const hargaJual = Number(product?.harga_jual || 0);
  const hargaGrosir = Number(product?.harga_grosir || 0);
  const minQtyGrosir = Number(product?.min_qty_grosir || 0);

  if (override === 'eceran') return { price: hargaJual, priceType: 'eceran', isWholesale: false };
  if (override === 'grosir') return { price: hargaGrosir > 0 ? hargaGrosir : hargaJual, priceType: 'grosir', isWholesale: true };

  const wholesaleBeneficial = hargaGrosir > 0 && hargaGrosir < hargaJual;
  const isWholesale = wholesaleBeneficial && minQtyGrosir > 0 && Number(quantity) >= minQtyGrosir;
  return { price: isWholesale ? hargaGrosir : hargaJual, priceType: isWholesale ? 'grosir' : 'eceran', isWholesale };
}

const toNum = (v) => Number(String(v ?? '').replace(/[^\d.]/g, '')) || 0;

/** Peringatan untuk form produk bila setelan grosir kemungkinan tidak sesuai maksud (null = baik-baik saja). */
export function grosirWarning(product) {
  const jual = toNum(product?.harga_jual), grosir = toNum(product?.harga_grosir), min = toNum(product?.min_qty_grosir);
  if (grosir <= 0) return null;
  if (jual > 0 && grosir >= jual) return 'Harga grosir sebaiknya lebih murah dari harga eceran; bila tidak, kasir tidak memakainya otomatis.';
  if (min <= 1) return 'Min qty 1: harga grosir berlaku sejak pembelian pertama, jadi semua penjualan produk ini memakai harga grosir. Isi lebih besar bila grosir hanya untuk pembelian banyak.';
  return null;
}
