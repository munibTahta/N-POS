import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, Search, Loader2 } from 'lucide-react';
import { getBranches, getOpnameList, applyOpname } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { withErrorBoundary } from '../components/withErrorBoundary';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { formatCurrency } from '../utils/formatHelper';
import { parseCount, summarizeCounts } from '../utils/opname';

const FILTERS = [
  { id: 'tidak_wajar', label: 'Tidak wajar (≥ 5.000)' },
  { id: 'minus', label: 'Minus' },
  { id: 'nol', label: 'Habis' },
  { id: 'semua', label: 'Semua' },
];
const PAGE = 100;
const draftKey = (cab) => `opname_draft_${cab}`;

function StockOpnamePage() {
  const { user } = useAuth();
  const { success, error: showError } = useNotifications();
  const [params, setParams] = useSearchParams();
  const isGlobal = user?.role === 'admin' || user?.role === 'owner';
  const [branches, setBranches] = useState([]);
  const [cabang, setCabang] = useState(user?.id_cabang || null);
  const filter = FILTERS.some((f) => f.id === params.get('filter')) ? params.get('filter') : 'semua';
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [counts, setCounts] = useState({});         // { id_produk: '12' } lintas filter/halaman
  const [known, setKnown] = useState({});           // baris yang pernah tampil (untuk ringkasan lintas filter)
  const [catatan, setCatatan] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef({});
  const reqId = useRef(0);

  useEffect(() => {
    if (!isGlobal) return;
    getBranches().then((r) => { const list = r?.data?.data || r?.data || []; setBranches(list); setCabang((c) => c || list[0]?.id_cabang || null); }).catch(() => {});
  }, [isGlobal]);

  useEffect(() => { const t = setTimeout(() => setQDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  // Draf hitungan tersimpan per cabang agar tidak hilang saat tab tertutup/koneksi putus.
  useEffect(() => {
    if (!cabang) return;
    try { const d = JSON.parse(sessionStorage.getItem(draftKey(cabang)) || 'null'); if (d) { setCounts(d.counts || {}); setKnown(d.known || {}); } else { setCounts({}); setKnown({}); } } catch (_e) { setCounts({}); setKnown({}); }
  }, [cabang]);
  useEffect(() => {
    if (!cabang) return;
    try { sessionStorage.setItem(draftKey(cabang), JSON.stringify({ counts, known })); } catch (_e) { /* abaikan */ }
  }, [cabang, counts, known]);

  const load = useCallback(async (offset) => {
    if (!cabang) return;
    const id = ++reqId.current;
    setLoading(true); setLoadErr('');
    try {
      const res = await getOpnameList({ id_cabang: cabang, filter, q: qDebounced || undefined, limit: PAGE, offset });
      if (id !== reqId.current) return;                       // abaikan balasan usang
      const raw = res?.data?.data;
      const daftar = Array.isArray(raw?.daftar) ? raw.daftar : [];          // bentuk tak terduga = daftar kosong, bukan layar rusak
      setTotal(Number(raw?.total) || daftar.length);
      setRows((prev) => (offset === 0 ? daftar : [...prev, ...daftar]));
      setKnown((prev) => { const n = { ...prev }; daftar.forEach((r) => { n[r.id_produk] = r; }); return n; });
    } catch (_e) {
      if (id === reqId.current) setLoadErr('Daftar produk belum dapat dimuat.');
    } finally { if (id === reqId.current) setLoading(false); }
  }, [cabang, filter, qDebounced]);

  useEffect(() => { load(0); }, [load]);

  const summary = useMemo(() => summarizeCounts(Object.values(known), counts), [known, counts]);
  const setCount = (id, v) => setCounts((c) => ({ ...c, [id]: v.replace(/[^\d-]/g, '').slice(0, 9) }));
  const focusNext = (i) => { const next = rows[i + 1]; if (next && inputRefs.current[next.id_produk]) inputRefs.current[next.id_produk].focus(); };

  const submit = async () => {
    setSaving(true);
    try {
      const res = await applyOpname({ id_cabang: cabang, items: summary.items, catatan: catatan.trim() || undefined });
      success(res?.data?.message || 'Opname diterapkan');
      try { sessionStorage.removeItem(draftKey(cabang)); } catch (_e) { /* abaikan */ }
      setCounts({}); setKnown({}); setConfirm(false); setCatatan('');
      load(0);
    } catch (e) {
      showError(e?.response?.data?.message || 'Opname gagal diterapkan. Tidak ada stok yang berubah.');
    } finally { setSaving(false); }
  };

  const canApply = summary.dihitung > 0 && summary.tidakValid === 0 && !saving;

  return (
    <PageLayout>
      <PageHeader
        title="Stok Opname"
        description="Hitung fisik, isi kolom Stok Fisik, lalu terapkan. Hanya produk yang diisi yang diubah; semua perubahan tercatat di riwayat stok."
      />
      <PageContainer>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {isGlobal && (
            <select aria-label="Cabang" className="field-select" value={cabang || ''} onChange={(e) => setCabang(Number(e.target.value))}>
              {branches.map((b) => <option key={b.id_cabang} value={b.id_cabang}>{b.nama_cabang}</option>)}
            </select>
          )}
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input aria-label="Cari produk" className="field-control w-full pl-9" placeholder="Cari nama atau kode / scan barcode" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} className={filter === f.id ? 'btn-tonal' : 'btn-outlined'} onClick={() => setParams(f.id === 'semua' ? {} : { filter: f.id })}>{f.label}</button>
          ))}
        </div>

        {loadErr && <p role="alert" className="mb-3 text-sm text-red-600">{loadErr} <button type="button" className="underline" onClick={() => load(0)}>Coba lagi</button></p>}

        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-3 py-2 text-left">Produk</th><th className="px-3 py-2 text-right">Stok sistem</th><th className="px-3 py-2 text-right">Stok fisik</th><th className="px-3 py-2 text-right">Selisih</th><th className="px-3 py-2 text-right">Nilai selisih</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = parseCount(counts[r.id_produk]);
                const bad = Number.isNaN(c);
                const diff = c === null || bad ? null : c - r.stok;
                return (
                  <tr key={r.id_produk} className="border-t border-gray-100 dark:border-zinc-800">
                    <td className="px-3 py-2"><div className="font-medium">{r.nama_produk}</div><div className="text-xs text-gray-500">{r.kode_produk}{r.lokasi_rak ? ` · ${r.lokasi_rak}` : ''}</div></td>
                    <td className={`px-3 py-2 text-right tabular-nums ${r.stok >= 5000 || r.stok < 0 ? 'font-semibold text-amber-700' : ''}`}>{r.stok.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        ref={(el) => { inputRefs.current[r.id_produk] = el; }}
                        aria-label={`Stok fisik ${r.nama_produk}`} aria-invalid={bad || undefined} inputMode="numeric"
                        className={`field-control w-24 text-right tabular-nums ${bad ? 'border-red-500' : ''}`}
                        value={counts[r.id_produk] ?? ''} onChange={(e) => setCount(r.id_produk, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); focusNext(i); } }}
                      />
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-600' : ''}`}>{diff === null ? '' : (diff > 0 ? '+' : '') + diff.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{diff === null || diff === 0 ? '' : formatCurrency(diff * r.harga_beli)}</td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && !loadErr && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">Tidak ada produk untuk filter ini.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>{rows.length.toLocaleString('id-ID')} dari {total.toLocaleString('id-ID')} produk</span>
          {rows.length < total && <button type="button" className="btn-outlined" disabled={loading} onClick={() => load(rows.length)}>{loading ? 'Memuat…' : 'Muat lebih banyak'}</button>}
          {loading && rows.length === 0 && <Loader2 className="h-4 w-4 animate-spin" aria-label="Memuat" />}
        </div>

        <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-zinc-700" role="status" aria-live="polite">
          <p className="text-sm">
            <strong>{summary.dihitung}</strong> dihitung · <strong>{summary.berubah}</strong> berubah · selisih nilai <strong className={summary.nilai < 0 ? 'text-red-600' : ''}>Rp {formatCurrency(summary.nilai)}</strong>
            {summary.tidakValid > 0 && <span className="ml-2 text-red-600">{summary.tidakValid} isian tidak valid</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Catatan opname" className="field-control w-64" placeholder="Catatan (opsional), mis. opname akhir bulan" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={150} />
            {summary.dihitung > 0 && <button type="button" className="btn-text" onClick={() => { setCounts({}); setKnown({}); }}>Kosongkan</button>}
            <button type="button" className="btn-primary" disabled={!canApply} onClick={() => setConfirm(true)}><ClipboardCheck className="h-4 w-4" aria-hidden="true" /> Tinjau & terapkan</button>
          </div>
        </div>
      </PageContainer>

      <ConfirmDialog
        isOpen={confirm} variant="warning" title="Terapkan stok opname?"
        message={`${summary.berubah} produk akan disesuaikan dari ${summary.dihitung} yang dihitung. Selisih nilai persediaan Rp ${formatCurrency(summary.nilai)}. Perubahan tercatat di riwayat stok dan tidak dapat dibatalkan otomatis.`}
        confirmText="Terapkan" isLoading={saving} onConfirm={submit} onCancel={() => setConfirm(false)}
      />
    </PageLayout>
  );
}

export default withErrorBoundary(StockOpnamePage, 'StockOpnamePage');
