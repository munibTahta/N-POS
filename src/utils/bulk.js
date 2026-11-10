/**
 * Aksi massal: fungsi murni untuk pemilihan baris dan eksekusi per-item (dapat dipakai ulang di halaman mana pun).
 */

/** Tambah/hapus satu id dari daftar terpilih (tanpa duplikat, urutan terjaga). */
export function toggleId(selected, id, on) {
  const has = selected.includes(id);
  if (on === undefined) on = !has;
  if (on) return has ? selected : [...selected, id];
  return has ? selected.filter((x) => x !== id) : selected;
}

/** Pilih/lepas semua id pada satu halaman tanpa mengganggu pilihan di halaman lain. */
export function togglePage(selected, pageIds, on) {
  if (on) return [...new Set([...selected, ...pageIds])];
  const drop = new Set(pageIds);
  return selected.filter((id) => !drop.has(id));
}

/** Keadaan kotak centang header: 'all' | 'some' | 'none' untuk halaman yang tampil. */
export function pageSelectionState(selected, pageIds) {
  if (pageIds.length === 0) return 'none';
  const n = pageIds.filter((id) => selected.includes(id)).length;
  return n === 0 ? 'none' : n === pageIds.length ? 'all' : 'some';
}

/** Pilih rentang (shift+klik) antara `anchorId` dan `id` menurut urutan `orderedIds`. Tanpa jangkar: hanya `id`. */
export function rangeIds(orderedIds, anchorId, id) {
  const a = orderedIds.indexOf(anchorId), b = orderedIds.indexOf(id);
  if (b === -1) return [];
  if (a === -1) return [id];
  const [from, to] = a < b ? [a, b] : [b, a];
  return orderedIds.slice(from, to + 1);
}

/** Buang id yang sudah tidak ada pada data (mis. baris terhapus atau data dimuat ulang). */
export function pruneSelection(selected, validIds) {
  const valid = new Set(validIds);
  const next = selected.filter((id) => valid.has(id));
  return next.length === selected.length ? selected : next;
}

/**
 * Jalankan `worker(item)` untuk tiap item dengan konkurensi terbatas. Kegagalan satu item TIDAK menghentikan yang lain.
 * @returns {{ ok: Array<{item, result}>, failed: Array<{item, error}>, cancelled: boolean }}
 *  - onProgress({ done, total }) dipanggil setiap satu item selesai
 *  - signal (AbortSignal) menghentikan pengambilan item baru; yang sedang berjalan diselesaikan
 */
export async function runBulk(items, worker, { concurrency = 4, onProgress, signal } = {}) {
  const ok = [], failed = [];
  let next = 0, done = 0;
  const total = items.length;
  const lane = async () => {
    while (next < total && !(signal && signal.aborted)) {
      const item = items[next++];
      try { ok.push({ item, result: await worker(item) }); }
      catch (error) { failed.push({ item, error }); }
      done += 1;
      onProgress?.({ done, total });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, total || 1)) }, lane));
  return { ok, failed, cancelled: Boolean(signal && signal.aborted && done < total) };
}

/** Kalimat ringkasan hasil untuk notifikasi. */
export function summarizeBulk({ ok, failed, cancelled }, { verb = 'diproses', noun = 'data' } = {}) {
  const n = ok.length, f = failed.length;
  if (cancelled) return `Dibatalkan: ${n} ${noun} sudah ${verb}${f ? `, ${f} gagal` : ''}.`;
  if (f === 0) return `${n} ${noun} berhasil ${verb}.`;
  if (n === 0) return `Semua ${f} ${noun} gagal ${verb}.`;
  return `${n} ${noun} berhasil ${verb}, ${f} gagal.`;
}

/** Pesan galat singkat dari error axios/umum (maks 3 contoh) untuk dialog detail. */
export function failureDetails(failed, labelOf = (i) => String(i), limit = 3) {
  const msg = (e) => e?.response?.data?.message || e?.message || 'Galat tidak diketahui';
  const head = failed.slice(0, limit).map(({ item, error }) => `${labelOf(item)}: ${msg(error)}`);
  return failed.length > limit ? [...head, `... dan ${failed.length - limit} lainnya`] : head;
}
