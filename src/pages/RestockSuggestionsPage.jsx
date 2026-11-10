import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { getBranches, getRestockSuggestions, createPurchase } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { withErrorBoundary } from '../components/withErrorBoundary';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { formatCurrency } from '../utils/formatHelper';
import { groupBySupplier } from '../utils/opname';

const ALASAN = {
  stok_minus: { t: 'Stok minus', c: 'text-red-700 bg-red-50' },
  habis: { t: 'Habis', c: 'text-red-700 bg-red-50' },
  cepat_habis: { t: 'Cepat habis', c: 'text-amber-700 bg-amber-50' },
  di_bawah_minimum: { t: 'Di bawah minimum', c: 'text-amber-700 bg-amber-50' },
  stok_tidak_wajar: { t: 'Stok tidak wajar — opname dulu', c: 'text-gray-700 bg-gray-100' },
};

function RestockSuggestionsPage() {
  const { user } = useAuth();
  const { success, error: showError } = useNotifications();
  const isGlobal = user?.role === 'admin' || user?.role === 'owner';
  const [branches, setBranches] = useState([]);
  const [cabang, setCabang] = useState(user?.id_cabang || null);
  const [hari, setHari] = useState(30);
  const [cover, setCover] = useState(14);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [qty, setQty] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isGlobal) return;
    getBranches().then((r) => { const l = r?.data?.data || r?.data || []; setBranches(l); setCabang((c) => c || l[0]?.id_cabang || null); }).catch(() => {});
  }, [isGlobal]);

  const load = useCallback(async () => {
    if (!cabang) return;
    setLoading(true); setErr('');
    try {
      const res = await getRestockSuggestions({ id_cabang: cabang, hari, cover });
      const list = res?.data?.data?.daftar || [];
      setData(list); setQty({});
      setPicked(new Set(list.filter((s) => s.saran > 0 && s.alasan !== 'stok_tidak_wajar').map((s) => s.id_produk)));
    } catch (_e) { setErr('Saran restok belum dapat dimuat.'); } finally { setLoading(false); }
  }, [cabang, hari, cover]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const groups = useMemo(() => groupBySupplier(data, [...picked], qty), [data, picked, qty]);
  const grandTotal = groups.reduce((s, g) => s + g.total, 0);

  const buatPembelian = async () => {
    setSaving(true);
    const gagal = [];
    let ok = 0;
    for (const g of groups) {
      try {
        await createPurchase({
          kode_pembelian: `PO-${Date.now()}-${g.id_supplier || 0}`, id_supplier: g.id_supplier, tanggal: new Date().toISOString(),
          masuk_gudang: false, id_cabang: cabang, items: g.items.map(({ id_produk, jumlah, harga_beli }) => ({ id_produk, jumlah, harga_beli })),
        });
        ok += 1;
        setPicked((p) => { const n = new Set(p); g.items.forEach((i) => n.delete(i.id_produk)); return n; });
      } catch (e) { gagal.push(`${g.nama_supplier}: ${e?.response?.data?.message || 'gagal'}`); }
    }
    setSaving(false); setConfirm(false);
    if (ok) success(`${ok} pembelian dibuat, stok cabang bertambah.`);
    if (gagal.length) showError(`Gagal: ${gagal.join('; ')}`);
    if (ok) load();
  };

  return (
    <PageLayout>
      <PageHeader title="Saran Restok" description="Dihitung dari kecepatan jual. Centang, ubah jumlah bila perlu, lalu buat pembelian per pemasok; stok cabang langsung bertambah." />
      <PageContainer>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {isGlobal && <select aria-label="Cabang" className="field-select" value={cabang || ''} onChange={(e) => setCabang(Number(e.target.value))}>{branches.map((b) => <option key={b.id_cabang} value={b.id_cabang}>{b.nama_cabang}</option>)}</select>}
          <label className="text-sm">Hitung dari <select aria-label="Periode penjualan" className="field-select ml-1" value={hari} onChange={(e) => setHari(Number(e.target.value))}>{[14, 30, 60, 90].map((n) => <option key={n} value={n}>{n} hari terakhir</option>)}</select></label>
          <label className="text-sm">Cukup untuk <select aria-label="Stok cukup untuk" className="field-select ml-1" value={cover} onChange={(e) => setCover(Number(e.target.value))}>{[7, 14, 21, 30].map((n) => <option key={n} value={n}>{n} hari</option>)}</select></label>
        </div>
        {err && <p role="alert" className="mb-3 text-sm text-red-600">{err} <button type="button" className="underline" onClick={load}>Coba lagi</button></p>}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr>
              <th className="px-3 py-2 w-10"><span className="sr-only">Pilih</span></th><th className="px-3 py-2 text-left">Produk</th><th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Stok</th><th className="px-3 py-2 text-right">Terjual</th><th className="px-3 py-2 text-right">Sisa hari</th><th className="px-3 py-2 text-right">Beli</th><th className="px-3 py-2 text-right">Harga beli</th>
            </tr></thead>
            <tbody>
              {data.map((s) => {
                const a = ALASAN[s.alasan] || ALASAN.habis;
                const blocked = s.alasan === 'stok_tidak_wajar';
                return (
                  <tr key={s.id_produk} className="border-t border-gray-100 dark:border-zinc-800">
                    <td className="px-3 py-2"><input type="checkbox" aria-label={`Pilih ${s.nama_produk}`} disabled={blocked} checked={picked.has(s.id_produk)} onChange={() => toggle(s.id_produk)} /></td>
                    <td className="px-3 py-2"><div className="font-medium">{s.nama_produk}</div><div className="text-xs text-gray-500">{s.nama_supplier || 'Tanpa pemasok'}</div></td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.c}`}>{a.t}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.stok.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.terjual.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.sisa_hari === null ? '–' : s.sisa_hari}</td>
                    <td className="px-3 py-2 text-right">{blocked ? '–' : <input aria-label={`Jumlah beli ${s.nama_produk}`} inputMode="numeric" className="field-control w-20 text-right tabular-nums" value={qty[s.id_produk] ?? s.saran} onChange={(e) => setQty((q) => ({ ...q, [s.id_produk]: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(s.harga_beli)}</td>
                  </tr>
                );
              })}
              {!loading && data.length === 0 && !err && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">Belum ada yang perlu direstok.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-zinc-700" role="status" aria-live="polite">
          <p className="text-sm"><strong>{groups.reduce((s, g) => s + g.items.length, 0)}</strong> produk · <strong>{groups.length}</strong> pemasok · total <strong>Rp {formatCurrency(grandTotal)}</strong></p>
          <button type="button" className="btn-primary" disabled={groups.length === 0 || saving} onClick={() => setConfirm(true)}><ShoppingCart className="h-4 w-4" aria-hidden="true" /> Buat pembelian</button>
        </div>
      </PageContainer>
      <ConfirmDialog
        isOpen={confirm} variant="info" title="Buat pembelian?"
        message={`${groups.length} pembelian (satu per pemasok) senilai Rp ${formatCurrency(grandTotal)}. Stok cabang langsung bertambah. ${groups.some((g) => !g.id_supplier) ? 'Produk tanpa pemasok dicatat tanpa pemasok.' : ''}`}
        confirmText="Buat pembelian" isLoading={saving} onConfirm={buatPembelian} onCancel={() => setConfirm(false)}
      />
    </PageLayout>
  );
}

export default withErrorBoundary(RestockSuggestionsPage, 'RestockSuggestionsPage');
