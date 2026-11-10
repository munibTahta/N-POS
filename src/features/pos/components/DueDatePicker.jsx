import React from 'react';
import { CalendarClock } from 'lucide-react';
import { addDaysISO, todayISO } from '../../../utils/dateRange';

const QUICK = [7, 14, 30];

/** Jatuh tempo piutang (opsional) untuk "Pembayaran Nanti"/bayar sebagian: chip +7/+14/+30 hari atau tanggal kustom. */
export default function DueDatePicker({ value, onChange }) {
  return (
    <div className="mt-2 rounded border border-gray-300 bg-gray-50 p-2" data-due-date-picker>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-700">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        Jatuh tempo (opsional)
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((n) => {
          const target = addDaysISO(n);
          const on = value === target;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? '' : target)}
              className={`min-h-[32px] rounded-full border px-2.5 text-xs font-medium touch-manipulation ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              +{n} hari
            </button>
          );
        })}
        <input
          type="date"
          aria-label="Tanggal jatuh tempo"
          value={value || ''}
          min={todayISO()}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-xs text-gray-500 underline hover:text-gray-700">
            Hapus
          </button>
        )}
      </div>
    </div>
  );
}
