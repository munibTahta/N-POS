import test from 'node:test';
import assert from 'node:assert/strict';
import { toDateInputValue, toISODate, todayISO, parseISODate, getPresetRange, detectPreset, normalizeRange, isDateInRange, rangeDays, formatRelativeDate, formatShortDate, formatFullDate } from '../dateRange.js';

// Rabu, 14 Okt 2026 15:30 waktu lokal
const NOW = new Date(2026, 9, 14, 15, 30);

test('toISODate memakai hari lokal, bukan UTC (dini hari WIB tidak mundur sehari)', () => {
  const earlyMorning = new Date(2026, 9, 14, 0, 30); // 00.30 lokal
  assert.equal(toISODate(earlyMorning), '2026-10-14');
  assert.equal(todayISO(earlyMorning), '2026-10-14');
});

test('parseISODate: valid, tidak valid, dan tanggal yang tidak ada', () => {
  assert.equal(toISODate(parseISODate('2026-02-28')), '2026-02-28');
  assert.equal(parseISODate('2026-02-30'), null);
  assert.equal(parseISODate('abc'), null);
  assert.equal(parseISODate(null), null);
});

test('preset rentang', () => {
  assert.deepEqual(getPresetRange('today', NOW), { start: '2026-10-14', end: '2026-10-14' });
  assert.deepEqual(getPresetRange('yesterday', NOW), { start: '2026-10-13', end: '2026-10-13' });
  assert.deepEqual(getPresetRange('last7', NOW), { start: '2026-10-08', end: '2026-10-14' });
  assert.deepEqual(getPresetRange('last30', NOW), { start: '2026-09-15', end: '2026-10-14' });
  assert.deepEqual(getPresetRange('thisWeek', NOW), { start: '2026-10-12', end: '2026-10-18' }); // Senin-Minggu
  assert.deepEqual(getPresetRange('thisMonth', NOW), { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(getPresetRange('lastMonth', NOW), { start: '2026-09-01', end: '2026-09-30' });
  assert.deepEqual(getPresetRange('thisYear', NOW), { start: '2026-01-01', end: '2026-12-31' });
  assert.deepEqual(getPresetRange('all', NOW), { start: '', end: '' });
  assert.equal(getPresetRange('nope', NOW), null);
});

test('minggu ini saat hari Minggu tetap Senin sebelumnya; bulan lalu lintas tahun & kabisat', () => {
  assert.deepEqual(getPresetRange('thisWeek', new Date(2026, 9, 18, 9, 0)), { start: '2026-10-12', end: '2026-10-18' });
  assert.deepEqual(getPresetRange('lastMonth', new Date(2026, 0, 15)), { start: '2025-12-01', end: '2025-12-31' });
  assert.deepEqual(getPresetRange('lastMonth', new Date(2024, 2, 10)), { start: '2024-02-01', end: '2024-02-29' });
});

test('detectPreset & normalizeRange & rangeDays', () => {
  assert.equal(detectPreset('2026-10-14', '2026-10-14', NOW), 'today');
  assert.equal(detectPreset('', '', NOW), 'all');
  assert.equal(detectPreset('2026-10-01', '2026-10-20', NOW), 'custom');
  assert.deepEqual(normalizeRange('2026-10-20', '2026-10-01'), { start: '2026-10-01', end: '2026-10-20' });
  assert.equal(rangeDays('2026-10-08', '2026-10-14'), 7);
  assert.equal(rangeDays('', '2026-10-14'), null);
});

test('isDateInRange memakai hari lokal dan inklusif', () => {
  assert.equal(isDateInRange(new Date(2026, 9, 14, 23, 59), '2026-10-14', '2026-10-14'), true);
  assert.equal(isDateInRange(new Date(2026, 9, 15, 0, 0), '2026-10-14', '2026-10-14'), false);
  assert.equal(isDateInRange('x', '2026-10-14', ''), false);
  assert.equal(isDateInRange(null, '', ''), true);
  assert.equal(isDateInRange(new Date(2026, 9, 1), '', '2026-10-31'), true);
});

test('tanggal relatif', () => {
  assert.equal(formatRelativeDate(new Date(2026, 9, 14, 15, 29, 40), NOW), 'Baru saja');
  assert.equal(formatRelativeDate(new Date(2026, 9, 14, 15, 10), NOW), '20 menit lalu');
  assert.equal(formatRelativeDate(new Date(2026, 9, 14, 12, 0), NOW), '3 jam lalu');
  assert.equal(formatRelativeDate(new Date(2026, 9, 14, 7, 5), NOW, { withTime: true }), 'Hari ini, 07.05');
  assert.equal(formatRelativeDate(new Date(2026, 9, 14, 7, 5), NOW), 'Hari ini');
  assert.equal(formatRelativeDate(new Date(2026, 9, 13, 23, 50), NOW), 'Kemarin'); // kalender, bukan 24 jam
  assert.equal(formatRelativeDate(new Date(2026, 9, 13, 9, 0), NOW, { withTime: true }), 'Kemarin, 09.00');
  assert.equal(formatRelativeDate(new Date(2026, 9, 11, 9, 0), NOW), '3 hari lalu');
  assert.equal(formatRelativeDate(new Date(2026, 9, 15, 9, 0), NOW), 'Besok');
  assert.equal(formatRelativeDate(new Date(2026, 9, 1, 9, 0), NOW), '1 Okt');
  assert.equal(formatRelativeDate(new Date(2025, 11, 31, 9, 0), NOW), '31 Des 2025');
  assert.equal(formatRelativeDate('2026-10-14', NOW), 'Hari ini'); // tanggal tanpa jam
  assert.equal(formatRelativeDate('2026-10-13', NOW), 'Kemarin');
  assert.equal(formatRelativeDate('bukan tanggal', NOW), '-');
  assert.equal(formatRelativeDate(null, NOW), '-');
});

test('format tanggal pendek dan lengkap', () => {
  assert.equal(formatShortDate(new Date(2026, 4, 3), NOW), '3 Mei');
  assert.equal(formatFullDate(new Date(2026, 9, 12, 14, 30)), 'Senin, 12 Oktober 2026 14.30');
  assert.equal(formatFullDate('2026-10-12'), 'Senin, 12 Oktober 2026');
  assert.equal(formatFullDate('x'), '');
});

test('toDateInputValue: pertahankan YYYY-MM-DD, ubah datetime ke hari lokal, tolak yang tidak valid', () => {
  assert.equal(toDateInputValue('2026-10-14'), '2026-10-14');
  assert.equal(toDateInputValue(new Date(2026, 9, 14, 0, 30)), '2026-10-14');
  assert.equal(toDateInputValue('bukan'), '');
  assert.equal(toDateInputValue(''), '');
  assert.equal(toDateInputValue(null), '');
});
