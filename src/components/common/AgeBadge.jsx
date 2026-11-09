import React from 'react';
import { ageInDays, dueStatus, formatShortDate } from '../../utils/dateRange';

const TONE = {
  danger: 'bg-red-100 text-red-800',
  warn: 'bg-amber-100 text-amber-800',
  ok: 'bg-gray-100 text-gray-700',
};

/**
 * Penanda piutang belum lunas.
 *  - Bila `dueDate` (tanggal jatuh tempo) ada: "Lewat 3 hari" (merah), "Jatuh tempo hari ini" / "Jatuh tempo 2 hari lagi" (kuning),
 *    atau "Jatuh tempo 12 Okt" (abu).
 *  - Bila tidak ada: usia dari `value` (tanggal transaksi): abu < warnDays, kuning >= warnDays, merah >= dangerDays.
 */
export default function AgeBadge({ value, dueDate, warnDays = 3, dangerDays = 7, label = 'Belum lunas', className = '' }) {
  let tone = 'ok';
  let text;
  let kind;
  const due = dueDate ? dueStatus(dueDate) : null;
  if (due) {
    kind = 'due';
    if (due.state === 'overdue') { tone = 'danger'; text = `Lewat ${due.days} hari`; }
    else if (due.state === 'today') { tone = 'warn'; text = 'Jatuh tempo hari ini'; }
    else if (due.state === 'soon') { tone = 'warn'; text = `Jatuh tempo ${due.days} hari lagi`; }
    else { tone = 'ok'; text = `Jatuh tempo ${formatShortDate(dueDate)}`; }
  } else {
    const days = ageInDays(value);
    if (days === null || days < 0) return null;
    kind = 'age';
    tone = days >= dangerDays ? 'danger' : days >= warnDays ? 'warn' : 'ok';
    text = days === 0 ? `${label} hari ini` : `${label} ${days} hari`;
  }
  return (
    <span data-age-badge={tone} data-badge-kind={kind} title={text} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[tone]} ${className}`}>
      {text}
    </span>
  );
}
