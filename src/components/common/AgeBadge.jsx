import React from 'react';
import { ageInDays } from '../../utils/dateRange';

/**
 * Penanda usia tagihan/piutang yang belum lunas. Tidak ada kolom jatuh tempo di data, jadi usia dihitung dari tanggal transaksi:
 * hijau/abu < `warnDays`, kuning >= `warnDays`, merah >= `dangerDays`.
 */
export default function AgeBadge({ value, warnDays = 3, dangerDays = 7, label = 'Belum lunas', className = '' }) {
  const days = ageInDays(value);
  if (days === null || days < 0) return null;
  const tone = days >= dangerDays ? 'bg-red-100 text-red-800' : days >= warnDays ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700';
  const text = days === 0 ? `${label} hari ini` : `${label} ${days} hari`;
  return (
    <span data-age-badge={days >= dangerDays ? 'danger' : days >= warnDays ? 'warn' : 'ok'} title={text} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone} ${className}`}>
      {text}
    </span>
  );
}
