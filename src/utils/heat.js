/**
 * Fungsi murni untuk kalender-panas (calendar heat) dan heatmap hari x jam: dapat dipakai ulang untuk penjualan,
 * jatuh tempo piutang/hutang, jadwal restok, dsb. Semua tanggal memakai hari LOKAL.
 */
import { toISODate } from './dateRange.js';

export const DAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']; // Senin pertama
export const DAY_LONG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const MONTH_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Grid bulan 6 minggu x 7 hari (Senin pertama): [{ date:'YYYY-MM-DD', day, inMonth }]. month: 0-11. */
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Senin = 0
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
    return { date: toISODate(dt), day: dt.getDate(), inMonth: dt.getMonth() === month };
  }));
}

/** Rentang bulan sebagai instan ISO awal/akhir hari lokal, untuk parameter API. */
export function monthRangeISO(year, month) {
  return {
    start_date: new Date(year, month, 1, 0, 0, 0, 0).toISOString(),
    end_date: new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString(),
  };
}

/** Geser bulan: { year, month } + delta bulan. */
export function shiftMonth({ year, month }, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Tingkat warna 0..levels (0 = kosong). Skala linier terhadap nilai maksimum. */
export function intensityLevel(value, max, levels = 4) {
  if (!(value > 0) || !(max > 0)) return 0;
  return Math.min(levels, Math.max(1, Math.ceil((value / max) * levels)));
}

/** Matriks 7x24 [{ jumlah, total }] -> { max, peak, byDay[7], byHour[24] } menurut metrik ('jumlah' | 'total'). */
export function summarizeHeatmap(grid, metric = 'total') {
  const byDay = Array(7).fill(0), byHour = Array(24).fill(0);
  let max = 0, peak = null;
  grid.forEach((row, d) => row.forEach((cell, h) => {
    const v = Number(cell[metric]) || 0;
    byDay[d] += v; byHour[h] += v;
    if (v > max) { max = v; peak = { day: d, hour: h, value: v }; }
  }));
  const bestDay = byDay.some((v) => v > 0) ? byDay.indexOf(Math.max(...byDay)) : -1;
  const bestHour = byHour.some((v) => v > 0) ? byHour.indexOf(Math.max(...byHour)) : -1;
  return { max, peak, byDay, byHour, bestDay, bestHour };
}

/** Peta tanggal -> { value, count } dari daftar harian server [{ tanggal, jumlah, total }] menurut metrik. */
export function dailyMap(harian = [], metric = 'total') {
  const m = new Map();
  for (const r of harian) m.set(r.tanggal, { value: metric === 'jumlah' ? r.jumlah : r.total, count: r.jumlah, total: r.total });
  return m;
}

export const hourLabel = (h) => `${String(h).padStart(2, '0')}.00`;
