/**
 * Pencarian untuk palet perintah (fungsi murni). Mengabaikan huruf besar/kecil dan tanda aksen; semua kata kueri harus cocok.
 * Skor: persis 100 > diawali 80 > awal kata 60 > mengandung 40 > kata kunci tambahan 25 > urutan huruf (fuzzy) 10; 0 = tidak cocok.
 */
export const normalize = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function scoreToken(token, label, keywords) {
  if (label === token) return 100;
  if (label.startsWith(token)) return 80;
  if (label.split(/[\s/\-_.]+/).some((w) => w.startsWith(token))) return 60;
  if (label.includes(token)) return 40;
  if (keywords.some((k) => k.includes(token))) return 25;
  // fuzzy: huruf kueri muncul berurutan di label ("lpr" -> "laporan")
  let i = 0;
  for (const ch of label) if (ch === token[i]) i += 1;
  return token.length >= 3 && i === token.length ? 10 : 0;
}

export function scoreCommand(query, item) {
  const q = normalize(query);
  if (!q) return 1;
  const label = normalize(item.label);
  const keywords = (item.keywords || []).map(normalize);
  const tokens = q.split(' ');
  let total = 0;
  for (const t of tokens) {
    const s = scoreToken(t, label, keywords);
    if (s === 0) return 0;
    total += s;
  }
  return total / tokens.length;
}

/** Saring + urutkan. Tanpa kueri: item yang baru dipakai (`recentIds`) dulu, sisanya urutan asli. */
export function filterCommands(items, query, recentIds = []) {
  const q = normalize(query);
  if (!q) {
    const rank = (id) => { const i = recentIds.indexOf(id); return i === -1 ? Infinity : i; };
    return items.map((it, idx) => ({ it, idx, r: rank(it.id) })).sort((a, b) => (a.r - b.r) || (a.idx - b.idx)).map((x) => x.it);
  }
  return items
    .map((it, idx) => ({ it, idx, s: scoreCommand(q, it) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => (b.s - a.s) || (a.idx - b.idx))
    .map((x) => x.it);
}
