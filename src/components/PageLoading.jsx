import React from 'react';
import { PageLayout, PageHeader } from './layouts';

/**
 * Kerangka muat untuk halaman daftar: judul tetap tampil (tidak ada lompatan tata letak) dan baris abu berkedip
 * menggantikan tabel. Dipakai sebagai pengganti `if (loading) return <div>Loading...</div>`.
 */
export default function PageLoading({ title, subtitle, rows = 6 }) {
  return (
    <PageLayout>
      <PageHeader title={title} subtitle={subtitle} />
      <div role="status" aria-live="polite" aria-busy="true" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <span className="sr-only">Memuat data…</span>
        {Array.from({ length: rows }, (_, i) => <div key={i} className="mb-3 h-8 animate-pulse rounded bg-gray-100 last:mb-0 dark:bg-zinc-800" />)}
      </div>
    </PageLayout>
  );
}
