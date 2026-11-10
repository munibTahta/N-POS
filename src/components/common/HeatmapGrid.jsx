import React from 'react';
import { DAY_SHORT, DAY_LONG, intensityLevel, hourLabel } from '../../utils/heat';

const LEVEL = [
  'bg-gray-100 dark:bg-zinc-800',
  'bg-blue-100 dark:bg-blue-500/20',
  'bg-blue-300 dark:bg-blue-500/40',
  'bg-blue-500 dark:bg-blue-500/70',
  'bg-blue-800 dark:bg-blue-400',
];

/**
 * Heatmap hari (baris, Senin pertama) x jam (kolom 0-23). Dapat dipakai ulang untuk pola apa pun per hari/jam.
 *  grid       matriks 7x24 [{ ...metrik }]      metric   kunci nilai (mis. 'total' | 'jumlah')
 *  format(v)  teks nilai untuk tooltip/aria     max      nilai skala (bawaan: maksimum data)
 */
export default function HeatmapGrid({ grid, metric = 'total', format = (v) => String(v), max: maxProp, hours = [...Array(24).keys()] }) {
  const max = maxProp ?? Math.max(0, ...grid.flat().map((c) => Number(c[metric]) || 0));
  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label="Heatmap penjualan per hari dan jam" className="inline-block min-w-full align-top">
        <div role="row" className="flex pl-10">
          {hours.map((h) => (
            <div key={h} role="columnheader" className="w-6 shrink-0 text-center text-[10px] tabular-nums text-gray-600 dark:text-zinc-400 sm:w-7">{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</div>
          ))}
        </div>
        {grid.map((row, d) => (
          <div key={d} role="row" className="flex items-center">
            <div role="rowheader" className="w-10 shrink-0 pr-2 text-right text-xs font-medium text-gray-700 dark:text-zinc-300" title={DAY_LONG[d]}>{DAY_SHORT[d]}</div>
            {hours.map((h) => {
              const v = Number(row[h][metric]) || 0;
              const lv = intensityLevel(v, max);
              const label = `${DAY_LONG[d]} ${hourLabel(h)}: ${format(v)}`;
              return <div key={h} role="cell" aria-label={label} title={label} className={`m-px h-6 w-5 shrink-0 rounded-sm sm:h-7 sm:w-6 ${LEVEL[lv]}`} />;
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-xs text-gray-600 dark:text-zinc-400" aria-hidden="true">
        <span>sedikit</span>{LEVEL.map((c, i) => <span key={i} className={`h-4 w-4 rounded ${c}`} />)}<span>banyak</span>
      </div>
    </div>
  );
}
