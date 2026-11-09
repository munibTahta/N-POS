import { useEffect, useMemo, useState } from 'react';
import { getCatalogCategories, getCategories } from '../../../services/api';

const cacheKey = (idCabang, tipe) => `pos_catalog_categories:${idCabang}:${tipe || 'global'}`;
const readCache = (key) => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(v?.list) ? v.list : null; } catch (_e) { return null; } };
const writeCache = (key, list) => { try { localStorage.setItem(key, JSON.stringify({ list, savedAt: Date.now() })); } catch (_e) { /* abaikan */ } };

/**
 * Kategori untuk chip filter kasir, sesuai KATALOG cabang: cabang berkatalog terpisah hanya melihat kategori yang dipakai
 * produknya sendiri (bukan semua kategori master). Tiap kategori membawa `jumlah_produk`.
 * Alur: cache terakhir (tanpa kedip, juga untuk offline) -> data segar dari server -> bila server gagal dan tidak ada cache,
 * jatuh ke seluruh kategori master (perilaku lama) agar chip tidak hilang.
 */
export function useBranchCategories({ idCabangPengguna, tipeKatalog, tipeKatalogKnown, isOnline }) {
  const ready = Boolean(idCabangPengguna && tipeKatalogKnown);
  const key = ready ? cacheKey(idCabangPengguna, tipeKatalog) : null;
  // Hasil segar disimpan beserta kuncinya; bila kunci berubah (ganti cabang/katalog) data lama otomatis tidak dipakai.
  const [fresh, setFresh] = useState({ key: null, list: [], total: null });
  const cached = useMemo(() => (key ? readCache(key) : null), [key]);

  useEffect(() => {
    if (!key || isOnline === false) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await getCatalogCategories({ katalog_filter: tipeKatalog, id_cabang: tipeKatalog === 'terpisah' ? idCabangPengguna : undefined });
        const list = res?.data?.data;
        if (cancelled || !Array.isArray(list)) return;
        setFresh({ key, list, total: res?.data?.meta?.total_produk ?? null });
        writeCache(key, list);
      } catch (_e) {
        if (cancelled || cached) return; // cache sudah tampil
        try {
          const all = await getCategories();
          const list = all?.data?.data || all?.data || [];
          if (!cancelled && Array.isArray(list)) setFresh({ key, list, total: null });
        } catch (_e2) { /* chips opsional */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isOnline]);

  const categories = fresh.key === key ? fresh.list : (cached || []);
  const totalProduk = fresh.key === key ? fresh.total : null;
  return { categories, totalProduk };
}

export default useBranchCategories;
