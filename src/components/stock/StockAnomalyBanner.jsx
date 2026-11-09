import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { getStockAnomalies } from '../../services/api';
import { formatCurrency } from '../../utils/formatHelper';

const KEY = 'stock_anomaly_dismissed';

/**
 * Peringatan stok tidak wajar: stok sangat besar (kebiasaan mengisi 9999 agar tidak cepat habis) atau minus.
 * Stok placeholder menggelembungkan nilai persediaan (stok x harga beli) di neraca/HPP. Muncul hanya bila ada temuan di
 * cakupan pengguna (kasir: cabangnya; admin: semua cabang). Dapat ditutup untuk sesi ini. Gagal memuat = tidak tampil.
 */
export default function StockAnomalyBanner({ ambang = 5000, className = '' }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem(KEY) === '1'; } catch (_e) { return false; } });

  useEffect(() => {
    if (dismissed) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await getStockAnomalies({ ambang, limit: 10 });
        if (!cancelled) setData(res?.data?.data || null);
      } catch (_e) { /* pelengkap */ }
    })();
    return () => { cancelled = true; };
  }, [ambang, dismissed]);

  if (dismissed || !data) return null;
  const sum = (k) => (data.ringkasan || []).reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const besar = sum('stok_besar'), minus = sum('stok_minus');
  if (besar === 0 && minus === 0) return null;
  const nilai = sum('nilai_tercatat_stok_besar'), total = sum('nilai_persediaan_total');
  const pct = total > 0 ? Math.round((nilai / total) * 100) : 0;

  return (
    <div role="region" aria-label="Peringatan stok tidak wajar" className={`mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">
            {besar > 0 && <>{besar.toLocaleString('id-ID')} produk berstok ≥ {ambang.toLocaleString('id-ID')}</>}
            {besar > 0 && minus > 0 && ' dan '}
            {minus > 0 && <>{minus.toLocaleString('id-ID')} berstok minus</>}
          </p>
          <p className="mt-1">
            {besar > 0 && <>Nilai persediaan tercatat dari stok sebesar ini <strong>Rp {formatCurrency(nilai)}</strong>{total > 0 && <> ({pct}% dari persediaan Rp {formatCurrency(total)})</>}. </>}
            Angka seperti 9999 biasanya isian agar barang tidak cepat habis, bukan hasil hitung; itu menggelembungkan nilai persediaan di laporan keuangan. Rapikan dengan menghitung fisik lalu menyesuaikan stok, dan catat pembelian saat barang masuk.
          </p>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-2">
            {open ? 'Sembunyikan daftar' : 'Lihat produk terbesar'} <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {open && (
            <div className="mt-3 overflow-x-auto rounded-xl bg-white/70 dark:bg-zinc-900/60">
              <table className="min-w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-amber-900 dark:text-amber-200">
                  <th className="px-3 py-2">Produk</th><th className="px-3 py-2 text-right">Stok</th><th className="px-3 py-2 text-right">Harga beli</th><th className="px-3 py-2 text-right">Nilai tercatat</th>
                </tr></thead>
                <tbody>
                  {(data.daftar || []).map((r) => (
                    <tr key={`${r.id_cabang}-${r.id_produk}`} className="border-t border-amber-200/70 dark:border-amber-500/20">
                      <td className="px-3 py-2">{r.nama_produk}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.stok.toLocaleString('id-ID')}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.harga_beli)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.nilai_tercatat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <button type="button" aria-label="Tutup peringatan" className="btn-icon btn-text shrink-0" onClick={() => { try { sessionStorage.setItem(KEY, '1'); } catch (_e) { /* abaikan */ } setDismissed(true); }}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
