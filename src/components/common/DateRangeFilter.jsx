import React, { useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { DATE_PRESETS, getPresetRange, detectPreset, normalizeRange, rangeDays, formatShortDate } from '../../utils/dateRange';

const DEFAULT_IDS = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth', 'thisYear', 'all'];

/**
 * Filter rentang tanggal dengan chip cepat (Hari ini, Kemarin, 7 hari, Bulan ini, ...) + input tanggal kustom.
 * Terkontrol: `start`/`end` berformat 'YYYY-MM-DD' ('' = tanpa batas). `onChange({ start, end })`.
 * Awal > akhir otomatis ditukar. Chip aktif dideteksi dari nilai saat ini; selain itu dianggap "Kustom".
 */
export default function DateRangeFilter({ start = '', end = '', onChange, presets = DEFAULT_IDS, label = 'Periode', disabled = false, compact = false, className = '' }) {
  const [customOpen, setCustomOpen] = useState(false);
  const items = useMemo(() => DATE_PRESETS.filter((p) => presets.includes(p.id)), [presets]);
  const active = detectPreset(start, end, new Date(), items.map((p) => p.id));
  const days = rangeDays(start, end);

  const apply = (s, e) => onChange?.(normalizeRange(s, e));

  return (
    <div className={`space-y-2 ${className}`} role="group" aria-label={label} data-date-range-filter>
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">
        <CalendarRange className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
        {days != null && start && end && (
          <span className="font-normal text-gray-500 dark:text-zinc-400">
            {start === end ? formatShortDate(start) : `${formatShortDate(start)} - ${formatShortDate(end)}`} ({days} hari)
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x" role="toolbar" aria-label={`${label}: pilihan cepat`}>
        {items.map((p) => {
          const on = active === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => { const r = getPresetRange(p.id); if (r) apply(r.start, r.end); }}
              className={`snap-start shrink-0 min-h-[36px] rounded-full px-3 text-sm font-medium border transition-colors touch-manipulation whitespace-nowrap ${
                on
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
              }`}
            >
              {p.label}
            </button>
          );
        })}
        {compact && (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={active === 'custom' || customOpen}
            aria-expanded={customOpen || active === 'custom'}
            onClick={() => setCustomOpen((v) => !v)}
            className={`snap-start shrink-0 min-h-[36px] rounded-full px-3 text-sm font-medium border transition-colors touch-manipulation whitespace-nowrap ${
              active === 'custom' || customOpen
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
            }`}
          >
            Kustom
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${compact && !(customOpen || active === 'custom') ? 'hidden' : ''}`}>
        <label className="block text-sm text-gray-700 dark:text-zinc-300">
          <span className="mb-1 block font-medium">Dari</span>
          <input
            type="date"
            value={start}
            max={end || undefined}
            disabled={disabled}
            onChange={(e) => apply(e.target.value, end)}
            className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block text-sm text-gray-700 dark:text-zinc-300">
          <span className="mb-1 block font-medium">Sampai</span>
          <input
            type="date"
            value={end}
            min={start || undefined}
            disabled={disabled}
            onChange={(e) => apply(start, e.target.value)}
            className="w-full min-w-0 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
    </div>
  );
}
