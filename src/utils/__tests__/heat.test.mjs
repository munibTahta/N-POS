import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthGrid, monthRangeISO, shiftMonth, intensityLevel, summarizeHeatmap, dailyMap, hourLabel } from '../heat.js';

test('buildMonthGrid: 6x7, Senin pertama, tanda bulan berjalan (Nov 2026 mulai Minggu)', () => {
  const g = buildMonthGrid(2026, 10);
  assert.equal(g.length, 6); assert.ok(g.every((w) => w.length === 7));
  assert.equal(g[0][0].date, '2026-10-26');           // Senin pertama grid
  assert.equal(g[0][0].inMonth, false);
  assert.equal(g[0][6].date, '2026-11-01');           // 1 Nov 2026 = Minggu
  assert.equal(g[0][6].inMonth, true);
  assert.equal(g.flat().filter((c) => c.inMonth).length, 30);
});

test('buildMonthGrid: bulan berawal Senin dan kabisat', () => {
  assert.equal(buildMonthGrid(2026, 5)[0][0].date, '2026-06-01'); // 1 Jun 2026 = Senin
  assert.equal(buildMonthGrid(2024, 1).flat().filter((c) => c.inMonth).length, 29);
});

test('monthRangeISO awal/akhir hari lokal; shiftMonth lintas tahun', () => {
  const r = monthRangeISO(2026, 10);
  assert.equal(new Date(r.start_date).getDate(), 1); assert.equal(new Date(r.start_date).getHours(), 0);
  assert.equal(new Date(r.end_date).getDate(), 30); assert.equal(new Date(r.end_date).getHours(), 23);
  assert.deepEqual(shiftMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
});

test('intensityLevel: 0 untuk kosong, 1..4 proporsional, aman untuk max 0', () => {
  assert.equal(intensityLevel(0, 100), 0);
  assert.equal(intensityLevel(1, 100), 1);
  assert.equal(intensityLevel(25, 100), 1);
  assert.equal(intensityLevel(26, 100), 2);
  assert.equal(intensityLevel(100, 100), 4);
  assert.equal(intensityLevel(5, 0), 0);
});

test('summarizeHeatmap: puncak, hari terbaik, jam terbaik; kosong aman', () => {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ jumlah: 0, total: 0 })));
  grid[5][12] = { jumlah: 9, total: 90000 };
  grid[5][13] = { jumlah: 1, total: 10000 };
  grid[1][12] = { jumlah: 3, total: 30000 };
  const s = summarizeHeatmap(grid, 'total');
  assert.deepEqual(s.peak, { day: 5, hour: 12, value: 90000 });
  assert.equal(s.bestDay, 5); assert.equal(s.bestHour, 12);
  assert.equal(summarizeHeatmap(grid, 'jumlah').max, 9);
  const empty = summarizeHeatmap(Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ jumlah: 0, total: 0 }))));
  assert.equal(empty.peak, null); assert.equal(empty.bestDay, -1);
});

test('dailyMap dan hourLabel', () => {
  const m = dailyMap([{ tanggal: '2026-11-09', jumlah: 19, total: 541000 }], 'jumlah');
  assert.deepEqual(m.get('2026-11-09'), { value: 19, count: 19, total: 541000 });
  assert.equal(dailyMap([{ tanggal: 'x', jumlah: 1, total: 5 }]).get('x').value, 5);
  assert.equal(hourLabel(7), '07.00');
});
