import React from 'react';
import { AlertCircle } from 'lucide-react';
import { PageLayout, PageHeader } from './layouts';

/** Galat muat halaman: judul tetap tampil, pesan jelas, dan tombol "Coba lagi" (bawaan: muat ulang halaman). */
export default function PageError({ title, message = 'Data belum dapat dimuat.', onRetry }) {
  return (
    <PageLayout>
      <PageHeader title={title} />
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p>{message}</p>
          <button type="button" className="btn-outlined mt-3" onClick={onRetry || (() => window.location.reload())}>Coba lagi</button>
        </div>
      </div>
    </PageLayout>
  );
}
