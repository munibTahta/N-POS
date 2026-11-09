import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { useNotifications } from '../../hooks/useNotifications';
import { runBulk, summarizeBulk, failureDetails } from '../../utils/bulk';

/**
 * Bilah aksi massal yang dapat dipakai ulang. Tampil hanya saat ada baris terpilih; memberi:
 *  - hitungan terpilih (aria-live), "Batalkan pilihan" dan Esc untuk membersihkan;
 *  - aksi (tombol sistem desain) dengan konfirmasi untuk aksi merusak;
 *  - eksekusi per-item dengan konkurensi terbatas + progres, kegagalan sebagian TIDAK menghentikan yang lain;
 *  - ringkasan hasil ("10 berhasil, 2 gagal" + contoh galat); item yang gagal tetap terpilih agar bisa dicoba lagi;
 *  - opsional "Pilih semua N data" lintas halaman.
 *
 * Props:
 *  items        objek baris terpilih
 *  noun         kata benda untuk pesan ("pelanggan")
 *  onClear()    kosongkan pilihan
 *  onDone({ ok, failed, action })  setelah aksi selesai: muat ulang data dan/atau pertahankan hanya yang gagal
 *  labelOf(item) nama ringkas item untuk detail galat
 *  selectAll    { total, onSelectAll() } bila data lebih banyak dari yang termuat (opsional)
 *  actions      [{ id, label, icon, variant: 'default'|'danger', verb ('dihapus'),
 *                  confirm: { title, message(n), confirmText }, concurrency, silentSuccess (tanpa toast sukses, mis. cetak),
 *                  run(item) -> Promise   (per item)   ATAU   runAll(items) -> Promise (sekali jalan, mis. endpoint massal) }]
 */
export default function BulkActionBar({ items = [], noun = 'data', onClear, onDone, labelOf, selectAll, actions = [], className = '' }) {
  const { success, warning, error } = useNotifications();
  const [pending, setPending] = useState(null);      // aksi yang menunggu konfirmasi
  const [busy, setBusy] = useState(null);            // { id, done, total }
  const abortRef = useRef(null);
  const count = items.length;

  // Esc membersihkan pilihan (kecuali saat dialog konfirmasi terbuka atau sedang berjalan)
  useEffect(() => {
    if (count === 0) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || pending || busy) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      onClear?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [count, busy, pending, onClear]);

  const execute = useCallback(async (action) => {
    const ctl = new AbortController();
    abortRef.current = ctl;
    setBusy({ id: action.id, done: 0, total: items.length });
    let result;
    try {
      if (action.runAll) {
        const res = await action.runAll(items);
        result = res && Array.isArray(res.ok) ? res : { ok: items.map((item) => ({ item })), failed: [], cancelled: false };
      } else {
        result = await runBulk(items, action.run, {
          concurrency: action.concurrency || 4,
          signal: ctl.signal,
          onProgress: ({ done, total }) => setBusy({ id: action.id, done, total }),
        });
      }
    } catch (err) {
      result = { ok: [], failed: items.map((item) => ({ item, error: err })), cancelled: false };
    }
    const text = summarizeBulk(result, { verb: action.verb || 'diproses', noun });
    if (result.failed.length === 0 && !result.cancelled) { if (!action.silentSuccess) success(text); }
    else {
      const details = failureDetails(result.failed, labelOf || ((i) => i.nama || i.nama_produk || i.nama_pelanggan || i.kode_produk || String(i.id ?? '')));
      (result.ok.length > 0 ? warning : error)([text, ...details].join('\n'), { autoClose: 9000 });
    }
    setBusy(null);
    abortRef.current = null;
    onDone?.({ ok: result.ok.map((r) => r.item), failed: result.failed.map((r) => r.item), action, cancelled: result.cancelled });
  }, [items, noun, success, warning, error, labelOf, onDone]);

  const trigger = (action) => (action.confirm ? setPending(action) : execute(action));

  if (count === 0) return null;
  const running = busy !== null;

  return (
    <>
      <div
        role="region"
        aria-label="Aksi massal"
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 sm:static sm:z-auto sm:mb-3 sm:rounded-2xl sm:border sm:shadow-none ${className}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-1 text-sm font-semibold text-gray-900 dark:text-zinc-100" aria-live="polite">
            {count.toLocaleString('id-ID')} {noun} dipilih
          </p>
          {selectAll && selectAll.total > count && !running && (
            <button type="button" onClick={selectAll.onSelectAll} className="btn-text btn-sm">
              Pilih semua {selectAll.total.toLocaleString('id-ID')}
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {actions.map((a) => {
              const Icon = a.icon;
              const isThis = busy?.id === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={running || a.disabled}
                  aria-busy={isThis || undefined}
                  onClick={() => trigger(a)}
                  className={`${a.variant === 'danger' ? 'btn-danger-outlined' : 'btn-outlined'} btn-sm`}
                >
                  {isThis ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                  {a.label}
                </button>
              );
            })}
            {running ? (
              <button type="button" onClick={() => abortRef.current?.abort()} className="btn-text btn-sm">Hentikan</button>
            ) : (
              <button type="button" onClick={onClear} className="btn-text btn-sm" aria-label="Batalkan pilihan">
                <X className="h-4 w-4" aria-hidden="true" /> Batal
              </button>
            )}
          </div>
        </div>
        {running && (
          <div className="mt-2" role="status" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
              <div className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-400" style={{ width: `${busy.total ? Math.round((busy.done / busy.total) * 100) : 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-zinc-400">{busy.done} dari {busy.total} diproses...</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pending)}
        title={pending?.confirm?.title || 'Konfirmasi'}
        message={typeof pending?.confirm?.message === 'function' ? pending.confirm.message(count) : pending?.confirm?.message}
        confirmText={pending?.confirm?.confirmText || 'Ya, lanjutkan'}
        variant={pending?.variant === 'danger' ? 'danger' : 'info'}
        onCancel={() => setPending(null)}
        onConfirm={() => { const a = pending; setPending(null); execute(a); }}
      />
    </>
  );
}
