import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Save } from 'lucide-react';

/**
 * Bilah aksi formulir yang seragam: menempel di bawah layar (selalu terjangkau di form panjang),
 * "Batal" di kiri aksi utama, satu tombol utama "Simpan" di kanan dengan status "Menyimpan…".
 * Dipakai di semua halaman form tambah/ubah. Letakkan di dalam <form> sebagai elemen terakhir.
 */
export default function FormActionBar({ cancelTo, onCancel, submitting = false, submitLabel = 'Simpan', savingLabel = 'Menyimpan…', hint, className = '' }) {
  return (
    <div className={`sticky bottom-0 z-10 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 sm:-mx-6 sm:px-6 ${className}`}>
      <span className="hidden text-xs text-gray-500 dark:text-zinc-400 sm:inline">{hint}</span>
      <div className="ml-auto flex items-center gap-2">
        {cancelTo ? <Link to={cancelTo} className="btn-outlined">Batal</Link>
          : onCancel ? <button type="button" className="btn-outlined" onClick={onCancel}>Batal</button> : null}
        <button type="submit" disabled={submitting} aria-busy={submitting || undefined} className="btn-primary">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {submitting ? savingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
