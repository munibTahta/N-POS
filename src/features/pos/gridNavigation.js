/**
 * Navigasi panah pada grid produk (murni, tanpa DOM): kartu dikelompokkan menjadi baris menurut posisi vertikalnya,
 * lalu panah bergerak antar kolom/baris. Dipisahkan dari PosPage agar dapat diuji.
 */
export const ROW_TOLERANCE_PX = 14;

/** cards: [{ index, left, top }] -> [{ top, items: [{ index, left }] }] terurut atas-ke-bawah dan kiri-ke-kanan. */
export function groupIntoRows(cards, tolerance = ROW_TOLERANCE_PX) {
  const rows = [];
  for (const c of cards) {
    let row = rows.find((r) => Math.abs(r.top - c.top) <= tolerance);
    if (!row) { row = { top: c.top, items: [] }; rows.push(row); }
    row.items.push(c);
  }
  rows.forEach((r) => r.items.sort((a, b) => a.left - b.left));
  rows.sort((a, b) => a.top - b.top);
  return rows;
}

/** Indeks berikutnya untuk 'left' | 'right' | 'up' | 'down'. -1 = keluar dari grid (naik dari baris pertama). */
export function nextProductIndex(rows, direction, currentIndex, total) {
  if (total === 0) return -1;
  if (rows.length === 0) return Math.max(0, currentIndex);
  if (currentIndex < 0) return direction === 'up' ? -1 : rows[0].items[0].index;

  const found = rows.findIndex((r) => r.items.some((i) => i.index === currentIndex));
  const rowIndex = found >= 0 ? found : 0;
  const row = rows[rowIndex];
  const at = row.items.findIndex((i) => i.index === currentIndex);
  const col = at >= 0 ? at : 0;

  if (direction === 'left') return row.items[Math.max(0, col - 1)].index;
  if (direction === 'right') return row.items[Math.min(row.items.length - 1, col + 1)].index;
  if (direction === 'up') {
    if (rowIndex === 0) return -1;
    const prev = rows[rowIndex - 1].items;
    return prev[Math.min(col, prev.length - 1)].index;
  }
  if (direction === 'down') {
    if (rowIndex === rows.length - 1) return currentIndex;
    const next = rows[rowIndex + 1].items;
    return next[Math.min(col, next.length - 1)].index;
  }
  return currentIndex;
}
