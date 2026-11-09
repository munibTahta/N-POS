import { useCallback, useMemo, useState } from 'react';
import { pruneSelection } from '../utils/bulk';

/**
 * Pemilihan baris untuk tabel (terkendali, kompatibel dengan DataTable.selectedRows/onSelectedRowsChange).
 *   const sel = useRowSelection({ items: rows, getId: (r) => r.id_produk });
 *   <DataTable selectable selectedRows={sel.selectedIds} onSelectedRowsChange={sel.setSelectedIds} />
 *   <BulkActionBar items={sel.selectedItems} onClear={sel.clear} onDone={sel.keepOnly} ... />
 * `selectedItems` hanya memuat baris yang sedang termuat; id di halaman lain tetap terpilih (server-side pagination).
 */
export function useRowSelection({ items = [], getId }) {
  const [selectedIds, setSelectedIdsState] = useState([]);

  const setSelectedIds = useCallback((next) => setSelectedIdsState(next), []);
  const clear = useCallback(() => setSelectedIdsState([]), []);
  const selectedItems = useMemo(() => {
    const set = new Set(selectedIds);
    return items.filter((it) => set.has(getId(it)));
  }, [items, selectedIds, getId]);

  /** Setelah aksi massal: hanya item yang GAGAL yang tetap terpilih (agar bisa dicoba lagi). */
  const keepOnly = useCallback(({ failed = [] } = {}) => setSelectedIdsState(failed.map(getId)), [getId]);
  /** Buang id yang sudah tidak ada pada data (panggil setelah memuat ulang data penuh, bukan data satu halaman). */
  const pruneTo = useCallback((validIds) => setSelectedIdsState((cur) => pruneSelection(cur, validIds)), []);

  return { selectedIds, setSelectedIds, selectedItems, count: selectedIds.length, clear, keepOnly, pruneTo };
}

export default useRowSelection;
