import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthGrid, shiftMonth, intensityLevel, DAY_SHORT, MONTH_LONG } from '../../utils/heat';
import { todayISO } from '../../utils/dateRange';

const LEVEL = [
  'bg-gray-50 text-gray-500 dark:bg-zinc-800/60 dark:text-zinc-300',
  'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100',
  'bg-blue-200 text-blue-900 dark:bg-blue-500/35 dark:text-blue-50',
  'bg-blue-400 text-white dark:bg-blue-500/60 dark:text-white',
  'bg-blue-700 text-white dark:bg-blue-500/90 dark:text-white',
];

/**
 * Kalender-panas bulanan yang dapat dipakai ulang: setiap hari diwarnai menurut nilainya (penjualan, jatuh tempo, jadwal restok, ...).
 *  month          { year, month(0-11) }            onMonthChange(next)
 *  values         Map<'YYYY-MM-DD', { value, count? }>
 *  formatValue(v) teks ringkas di sel (mis. "541 rb")   describe(date, entry) teks lengkap untuk aria-label/tooltip
 *  onSelectDay(date)   selectedDate   loading
 */
export default function CalendarHeat({ month, onMonthChange, values, formatValue = (v) => String(v), describe, onSelectDay, selectedDate, loading = false, unitLabel = 'Pendapatan' }) {
  const grid = buildMonthGrid(month.year, month.month);
  const today = todayISO();
  const max = Math.max(0, ...[...values.values()].map((e) => e.value || 0));

  return (
    <div aria-busy={loading || undefined}>
      <div className="mb-3 flex items-center gap-2">
        <button type="button" className="btn-icon btn-outlined" aria-label="Bulan sebelumnya" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
        <h3 className="min-w-[9rem] text-center text-base font-semibold text-gray-900 dark:text-zinc-100" aria-live="polite">{MONTH_LONG[month.month]} {month.year}</h3>
        <button type="button" className="btn-icon btn-outlined" aria-label="Bulan berikutnya" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
        <button type="button" className="btn-text btn-sm ml-auto" onClick={() => { const n = new Date(); onMonthChange({ year: n.getFullYear(), month: n.getMonth() }); }}>Bulan ini</button>
      </div>

      <div role="grid" aria-label={`Kalender ${MONTH_LONG[month.month]} ${month.year}`} className={`grid grid-cols-7 gap-1 sm:gap-1.5 ${loading ? 'opacity-60' : ''}`}>
        {DAY_SHORT.map((d) => <div key={d} role="columnheader" className="pb-1 text-center text-xs font-semibold text-gray-600 dark:text-zinc-400">{d}</div>)}
        {grid.flat().map((c) => {
          const entry = values.get(c.date);
          const lv = c.inMonth ? intensityLevel(entry?.value || 0, max) : 0;
          const label = describe ? describe(c.date, entry) : `${c.date}: ${entry ? entry.value : 0}`;
          return (
            <button
              key={c.date}
              type="button"
              role="gridcell"
              disabled={!c.inMonth}
              aria-label={label}
              aria-selected={selectedDate === c.date}
              title={c.inMonth ? label : undefined}
              onClick={() => onSelectDay?.(c.date)}
              className={`flex aspect-square min-h-[44px] flex-col items-center justify-center rounded-lg text-xs transition ${c.inMonth ? LEVEL[lv] : 'opacity-30'} ${c.date === today ? 'ring-2 ring-blue-600 dark:ring-blue-400' : ''} ${selectedDate === c.date ? 'outline outline-2 outline-offset-1 outline-gray-900 dark:outline-zinc-100' : ''} ${c.inMonth ? 'hover:brightness-95' : 'cursor-default'}`}
            >
              <span className="font-semibold leading-none">{c.day}</span>
              {c.inMonth && entry && entry.value > 0 && <span className="mt-0.5 hidden text-[10px] leading-none tabular-nums sm:block">{formatValue(entry.value)}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-xs text-gray-600 dark:text-zinc-400" aria-hidden="true">
        <span>{unitLabel}: sedikit</span>
        {LEVEL.map((c, i) => <span key={i} className={`h-4 w-4 rounded ${c.split(' ').filter((x) => x.startsWith('bg-') || x.startsWith('dark:bg-')).join(' ')}`} />)}
        <span>banyak</span>
      </div>
    </div>
  );
}
