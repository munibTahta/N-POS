import { useEffect } from 'react';
import { getProducts } from '../../../services/api';
import { isWebMode, productScope, isSnapshotFresh, saveProducts } from '../../../services/webProductCache';

const PAGE = 500;
const MAX_PAGES = 40; // batas aman: 20.000 produk

/**
 * Mode web: saat online, simpan snapshot katalog aktif cabang ke IndexedDB (diperbarui bila lebih tua dari 30 menit)
 * agar pencarian/penelusuran tetap berjalan ketika API tidak terjangkau. Tidak aktif di Electron.
 */
export function useWebCatalogSnapshot({ idCabangPengguna, tipeKatalog, tipeKatalogKnown, isOnline }) {
  useEffect(() => {
    if (!isWebMode() || !isOnline || !idCabangPengguna || !tipeKatalogKnown) return undefined;
    let cancelled = false;
    const scope = productScope(idCabangPengguna, tipeKatalog);
    (async () => {
      if (await isSnapshotFresh(scope)) return;
      const all = [];
      for (let page = 1; page <= MAX_PAGES && !cancelled; page++) {
        const res = await getProducts({
          limit: PAGE, page, status: 'aktif', sortBy: 'nama_produk', sortOrder: 'asc',
          katalog_filter: tipeKatalog,
          id_cabang: tipeKatalog === 'terpisah' ? idCabangPengguna : undefined,
        });
        const rows = res.data?.data || [];
        all.push(...rows);
        if (rows.length < PAGE) break;
      }
      if (cancelled || all.length === 0) return;
      const normalized = all.map((p) => ({
        ...p,
        harga_jual: Number(p.harga_jual || 0),
        harga_beli: Number(p.harga_beli || 0),
        harga_grosir: Number(p.harga_grosir || 0),
        min_qty_grosir: Number(p.min_qty_grosir || 0),
        barcode: p.barcode || p.kode_produk,
      }));
      await saveProducts(scope, normalized);
    })().catch(() => { /* cadangan bersifat best-effort; jangan ganggu kasir */ });
    return () => { cancelled = true; };
  }, [idCabangPengguna, tipeKatalog, tipeKatalogKnown, isOnline]);
}

export default useWebCatalogSnapshot;
