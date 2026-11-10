/**
 * Kebijakan stok saat menjual. Toko yang menjual terus saat barang belum sempat dicatat masuk biasanya mengisi stok 9999,
 * yang menggelembungkan nilai persediaan. Dengan "izinkan stok minus" kasir tetap bisa menjual, stok dicatat minus, dan
 * selisihnya dirapikan lewat restok/opname (lihat peringatan stok tidak wajar).
 */
export function canSell({ stock, wanted, allowNegative }) {
  if (allowNegative === true) return true;
  return Number(wanted) <= Number(stock);
}

/** Stok setelah terjual `wanted`; negatif berarti belum tercatat masuk. */
export function stockAfter(stock, wanted) {
  return Number(stock) - Number(wanted);
}
