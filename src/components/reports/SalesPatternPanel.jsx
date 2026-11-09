import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSalesPattern } from '../../services/api';
import CalendarHeat from '../common/CalendarHeat';
import HeatmapGrid from '../common/HeatmapGrid';
import DateRangeFilter from '../common/DateRangeFilter';
import { getPresetRange, parseISODate } from '../../utils/dateRange';
import { monthRangeISO, dailyMap, summarizeHeatmap, DAY_LONG, hourLabel } from '../../utils/heat';
import { formatCurrency } from '../../utils/formatHelper';

const TABS = [{ id: 'kalender', label: 'Kalender' }, { id: 'heatmap', label: 'Jam sibuk' }];
const METRICS = [{ id: 'total', label: 'Pendapatan' }, { id: 'jumlah', label: 'Transaksi' }];
const compact = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} M` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : String(n));
const rupiah = (n) => `Rp ${formatCurrency(n)}`;

/**
 * Pola penjualan: kalender bulanan (hari terbaik/terburuk sekilas) dan heatmap hari x jam (jadwal jaga, promo, restok).
 * Data dari GET /laporan/pola-penjualan (agregat, cakupan cabang oleh server, waktu LOKAL lewat tz_offset).
 */
export default function SalesPatternPanel({ className = '' }) {
  const now = new Date();
  const [tab, setTab] = useState('kalender');
  const [metric, setMetric] = useState('total');
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [range, setRange] = useState(() => getPresetRange('last30'));
  const [data, setData] = useState({ harian: [], heatmap: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const params = useMemo(() => {
    const tz_offset = -new Date().getTimezoneOffset();
    if (tab === 'kalender') return { ...monthRangeISO(month.year, month.month), tz_offset };
    const a = range.start ? parseISODate(range.start) : null, b = range.end ? parseISODate(range.end) : null;
    return { ...(a ? { start_date: a.toISOString() } : {}), ...(b ? { end_date: new Date(b.getFullYear(), b.getMonth(), b.getDate(), 23, 59, 59, 999).toISOString() } : {}), tz_offset };
  }, [tab, month, range]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getSalesPattern(params);
      const d = res?.data?.data;
      setData({ harian: Array.isArray(d?.harian) ? d.harian : [], heatmap: Array.isArray(d?.heatmap) ? d.heatmap : null });
    } catch (_e) {
      setError('Pola penjualan belum dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [params]);
  useEffect(() => { load(); }, [load]);

  const values = useMemo(() => dailyMap(data.harian, metric), [data.harian, metric]);
  const fmt = metric === 'total' ? rupiah : (v) => `${v} transaksi`;
  const heat = useMemo(() => (data.heatmap ? summarizeHeatmap(data.heatmap, metric) : null), [data.heatmap, metric]);
  const sel = selected ? data.harian.find((r) => r.tanggal === selected) : null;

  return (
    <section aria-label="Pola penjualan" className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">Pola Penjualan</h2>
        <div role="tablist" aria-label="Tampilan pola" className="ml-auto inline-flex rounded-full bg-gray-100 p-1 dark:bg-zinc-800">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className={`min-h-[36px] rounded-full px-4 text-sm font-medium transition ${tab === t.id ? 'bg-white text-blue-800 shadow-sm dark:bg-zinc-900 dark:text-blue-200' : 'text-gray-700 dark:text-zinc-300'}`}>{t.label}</button>
          ))}
        </div>
        <div role="group" aria-label="Metrik" className="inline-flex rounded-full bg-gray-100 p-1 dark:bg-zinc-800">
          {METRICS.map((m) => (
            <button key={m.id} type="button" aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}
              className={`min-h-[36px] rounded-full px-3 text-sm font-medium transition ${metric === m.id ? 'bg-white text-blue-800 shadow-sm dark:bg-zinc-900 dark:text-blue-200' : 'text-gray-700 dark:text-zinc-300'}`}>{m.label}</button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>{error}</span><button type="button" onClick={load} className="btn-outlined btn-sm">Coba lagi</button>
        </div>
      )}

      {tab === 'kalender' ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <CalendarHeat
            month={month}
            onMonthChange={(m) => { setMonth(m); setSelected(null); }}
            values={values}
            loading={loading}
            unitLabel={metric === 'total' ? 'Pendapatan' : 'Transaksi'}
            formatValue={metric === 'total' ? compact : String}
            describe={(date, e) => `${date}: ${e ? `${e.count} transaksi, ${rupiah(e.total)}` : 'tidak ada penjualan'}`}
            onSelectDay={setSelected}
            selectedDate={selected}
          />
          <aside className="rounded-2xl bg-gray-50 p-4 text-sm dark:bg-zinc-800/50" aria-live="polite">
            {sel ? (
              <>
                <p className="font-semibold text-gray-900 dark:text-zinc-100">{sel.tanggal}</p>
                <p className="mt-1 text-gray-700 dark:text-zinc-300">{sel.jumlah.toLocaleString('id-ID')} transaksi</p>
                <p className="text-gray-700 dark:text-zinc-300">{rupiah(sel.total)}</p>
              </>
            ) : (
              <p className="text-gray-600 dark:text-zinc-400">Pilih sebuah tanggal untuk melihat rinciannya.</p>
            )}
            <p className="mt-4 text-xs text-gray-600 dark:text-zinc-400">Bulan ini: {data.harian.reduce((s, r) => s + r.jumlah, 0).toLocaleString('id-ID')} transaksi, {rupiah(data.harian.reduce((s, r) => s + r.total, 0))}</p>
          </aside>
        </div>
      ) : (
        <div>
          <DateRangeFilter compact className="mb-3" label="Rentang analisis" presets={['last7', 'last30', 'thisMonth', 'lastMonth', 'thisYear', 'all']} start={range.start} end={range.end} onChange={setRange} />
          {data.heatmap ? (
            <div aria-busy={loading || undefined} className={loading ? 'opacity-60' : ''}>
              {heat && heat.peak && (
                <p className="mb-3 text-sm text-gray-700 dark:text-zinc-300">
                  Tersibuk: <strong>{DAY_LONG[heat.peak.day]} {hourLabel(heat.peak.hour)}</strong> ({fmt(heat.peak.value)}). Hari terbaik: <strong>{DAY_LONG[heat.bestDay]}</strong>. Jam terbaik: <strong>{hourLabel(heat.bestHour)}</strong>.
                </p>
              )}
              {heat && !heat.peak && <p className="mb-3 text-sm text-gray-600 dark:text-zinc-400">Belum ada penjualan pada rentang ini.</p>}
              <HeatmapGrid grid={data.heatmap} metric={metric} format={fmt} />
            </div>
          ) : (!loading && <p className="text-sm text-gray-600 dark:text-zinc-400">Belum ada data.</p>)}
        </div>
      )}
    </section>
  );
}
