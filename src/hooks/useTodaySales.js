import { useCallback, useEffect, useState } from 'react';
import { getSalesSummary } from '../services/api';

/** Rentang "hari ini" LOKAL sebagai instan ISO (server menyaring di database). */
export function todayRangeISO(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

/**
 * Ringkasan penjualan hari ini untuk subjudul (jumlah transaksi, total, belum lunas). Ringan: satu query agregat.
 * Disegarkan tiap 5 menit dan saat tab kembali terlihat. Gagal = data null (subjudul jatuh ke konteks tanpa angka).
 */
export function useTodaySales({ enabled = true, refreshMs = 5 * 60 * 1000 } = {}) {
  const [state, setState] = useState({ data: null, updatedAt: null });

  const load = useCallback(async () => {
    try {
      const res = await getSalesSummary(todayRangeISO());
      const d = res?.data?.data;
      if (d && typeof d.jumlah_transaksi === 'number') setState({ data: d, updatedAt: new Date() });
    } catch (_e) { /* ringkasan bersifat pelengkap */ }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const id = setInterval(load, refreshMs);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [enabled, refreshMs, load]);

  return state;
}

export default useTodaySales;
