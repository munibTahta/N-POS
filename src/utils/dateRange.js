/**
 * Utilitas tanggal untuk filter rentang cepat dan tanggal relatif. Semua fungsi murni dan memakai ZONA WAKTU LOKAL.
 *
 * Penting: jangan memakai `new Date().toISOString().slice(0, 10)` untuk "tanggal hari ini". toISOString() memakai UTC,
 * sehingga di WIB (UTC+7) antara pukul 00.00-07.00 hasilnya tanggal KEMARIN. Pakai `todayISO()` / `toISODate()`.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Nilai untuk <input type="date">: 'YYYY-MM-DD' dipertahankan; string/Date lain dikonversi ke hari LOKAL; tidak valid = ''. */
export const toDateInputValue = (v) => {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '' : toISODate(d);
};

/** Date -> 'YYYY-MM-DD' menurut zona waktu lokal. */
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Tanggal lokal hari ini 'YYYY-MM-DD'. */
export const todayISO = (now = new Date()) => toISODate(now);

/** 'YYYY-MM-DD' -> Date pada tengah malam LOKAL (null bila tidak valid). */
export function parseISODate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d;
}

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const DATE_PRESETS = [
  { id: 'today', label: 'Hari ini' },
  { id: 'yesterday', label: 'Kemarin' },
  { id: 'last7', label: '7 hari terakhir' },
  { id: 'last30', label: '30 hari terakhir' },
  { id: 'thisWeek', label: 'Minggu ini' },
  { id: 'thisMonth', label: 'Bulan ini' },
  { id: 'lastMonth', label: 'Bulan lalu' },
  { id: 'thisYear', label: 'Tahun ini' },
  { id: 'all', label: 'Semua' },
];

/** Rentang {start, end} ('YYYY-MM-DD', inklusif) untuk sebuah preset; 'all' = rentang kosong. Minggu dimulai hari Senin. */
export function getPresetRange(id, now = new Date()) {
  const t = startOfDay(now);
  switch (id) {
    case 'today': return { start: toISODate(t), end: toISODate(t) };
    case 'yesterday': { const y = addDays(t, -1); return { start: toISODate(y), end: toISODate(y) }; }
    case 'last7': return { start: toISODate(addDays(t, -6)), end: toISODate(t) };
    case 'last30': return { start: toISODate(addDays(t, -29)), end: toISODate(t) };
    case 'thisWeek': {
      const sinceMonday = (t.getDay() + 6) % 7;
      return { start: toISODate(addDays(t, -sinceMonday)), end: toISODate(addDays(t, 6 - sinceMonday)) };
    }
    case 'thisMonth': return { start: toISODate(new Date(t.getFullYear(), t.getMonth(), 1)), end: toISODate(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
    case 'lastMonth': return { start: toISODate(new Date(t.getFullYear(), t.getMonth() - 1, 1)), end: toISODate(new Date(t.getFullYear(), t.getMonth(), 0)) };
    case 'thisYear': return { start: toISODate(new Date(t.getFullYear(), 0, 1)), end: toISODate(new Date(t.getFullYear(), 11, 31)) };
    case 'all': return { start: '', end: '' };
    default: return null;
  }
}

/** Preset yang cocok dengan rentang saat ini, atau 'custom'. */
export function detectPreset(start, end, now = new Date(), ids = DATE_PRESETS.map((p) => p.id)) {
  for (const id of ids) {
    const r = getPresetRange(id, now);
    if (r && r.start === (start || '') && r.end === (end || '')) return id;
  }
  return 'custom';
}

/** Rapikan pasangan tanggal: bila awal > akhir, tukar. */
export function normalizeRange(start, end) {
  if (start && end && start > end) return { start: end, end: start };
  return { start: start || '', end: end || '' };
}

/** Apakah nilai tanggal (string/Date) berada di dalam rentang inklusif menurut hari LOKAL. Rentang kosong = lolos. */
export function isDateInRange(value, start, end) {
  if (!start && !end) return true;
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const day = toISODate(d);
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

/** Jumlah hari inklusif pada rentang (null bila salah satu kosong). */
export function rangeDays(start, end) {
  const a = parseISODate(start), b = parseISODate(end);
  if (!a || !b) return null;
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000) + 1;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null; // new Date(null) = 1 Jan 1970: jangan
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseISODate(value); // tanggal murni = hari lokal
  return parseFlexibleDate(value) || new Date(NaN);
};
const hhmm = (d) => `${pad(d.getHours())}.${pad(d.getMinutes())}`;

/** Tanggal pendek: '12 Okt 2026' (tahun dihilangkan bila tahun ini). */
export function formatShortDate(value, now = new Date()) {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return '-';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

/** Tanggal lengkap untuk tooltip: 'Senin, 12 Oktober 2026 14.30'. */
export function formatFullDate(value, withTime = true) {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return '';
  const base = `${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
  return withTime && (d.getHours() || d.getMinutes()) ? `${base} ${hhmm(d)}` : base;
}

/**
 * Tanggal relatif ramah kasir:
 *  - hari ini: 'Baru saja', '5 menit lalu', '3 jam lalu' (bila withTime) atau 'Hari ini, 14.30'
 *  - kemarin/besok, '3 hari lalu' (sampai 6 hari), selebihnya tanggal pendek.
 * Perbandingan hari memakai kalender lokal (bukan selisih 24 jam).
 */
export function formatRelativeDate(value, now = new Date(), { withTime = false } = {}) {
  const d = toDate(value);
  if (!d || Number.isNaN(d.getTime())) return '-';
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const hasTime = !(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value));
  if (dayDiff === 0) {
    if (!hasTime) return 'Hari ini';
    const mins = Math.floor((now - d) / 60000);
    if (mins >= 0 && mins < 1) return 'Baru saja';
    if (mins >= 1 && mins < 60) return `${mins} menit lalu`;
    if (mins >= 60 && mins < 360) return `${Math.floor(mins / 60)} jam lalu`;
    return withTime ? `Hari ini, ${hhmm(d)}` : 'Hari ini';
  }
  const t = withTime && hasTime ? `, ${hhmm(d)}` : '';
  if (dayDiff === 1) return `Kemarin${t}`;
  if (dayDiff === -1) return `Besok${t}`;
  if (dayDiff > 1 && dayDiff <= 6) return `${dayDiff} hari lalu${t}`;
  if (dayDiff < -1 && dayDiff >= -6) return `${-dayDiff} hari lagi${t}`;
  return `${formatShortDate(d, now)}${t}`;
}

/**
 * Parser tanggal toleran untuk data campuran: Date, ISO/teks tanggal, atau epoch (detik atau milidetik, angka/string angka).
 * Mengembalikan Date atau null bila tidak valid (tidak pernah 1 Jan 1970 untuk null/kosong).
 */
export function parseFlexibleDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const fromEpoch = (n) => new Date(n > 9999999999 ? n : n * 1000);
  if (typeof value === 'number') return Number.isFinite(value) ? fromEpoch(value) : null;
  if (typeof value === 'string') {
    if (/^\d+$/.test(value.trim())) return fromEpoch(parseInt(value, 10));
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Tanggal + jam lengkap (dd/mm/yyyy, hh.mm.ss) untuk log/audit; 'Tanggal tidak valid' bila gagal. */
export function formatDateTimeID(value) {
  const d = parseFlexibleDate(value);
  if (!d) return 'Tanggal tidak valid';
  return d.toLocaleString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Selisih hari kalender lokal dari `value` ke `now` (>= 0 = sudah lewat); null bila tidak valid. */
export function ageInDays(value, now = new Date()) {
  const d = parseFlexibleDate(value);
  if (!d) return null;
  return Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
}
