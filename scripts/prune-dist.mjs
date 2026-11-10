// Membersihkan dist/assets: berkas yang BUKAN bagian build sekarang (menurut dist/.vite/manifest.json) dan lebih tua dari N hari dihapus.
// Berkas build sebelumnya sengaja dipertahankan sementara (emptyOutDir: false) agar tab yang masih terbuka tetap bisa memuat chunk lamanya.
//   node scripts/prune-dist.mjs                 simpan 14 hari
//   node scripts/prune-dist.mjs --keep-days=0   hanya build sekarang (untuk installer Electron)
//   node scripts/prune-dist.mjs --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const arg = (name, def) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : def; };
const keepDays = Number(arg('keep-days', 14));
const dry = process.argv.includes('--dry-run');

export function currentFiles(manifest) {
  const keep = new Set();
  for (const entry of Object.values(manifest)) {
    if (entry.file) keep.add(entry.file);
    (entry.css || []).forEach((f) => keep.add(f));
    (entry.assets || []).forEach((f) => keep.add(f));
  }
  return keep;
}

export function pruneList(files, keep, now, keepDays, mtimeOf) {
  return files.filter((f) => !keep.has(`assets/${f}`) && (now - mtimeOf(f)) / 86400000 >= keepDays);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifestPath = path.join(dist, '.vite', 'manifest.json');
  if (!fs.existsSync(manifestPath)) { console.error('dist/.vite/manifest.json tidak ada; jalankan vite build dulu.'); process.exit(1); }
  const keep = currentFiles(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  const assetsDir = path.join(dist, 'assets');
  const files = fs.readdirSync(assetsDir).filter((f) => fs.statSync(path.join(assetsDir, f)).isFile());
  const victims = pruneList(files, keep, Date.now(), keepDays, (f) => fs.statSync(path.join(assetsDir, f)).mtimeMs);
  let bytes = 0;
  for (const f of victims) { bytes += fs.statSync(path.join(assetsDir, f)).size; if (!dry) fs.unlinkSync(path.join(assetsDir, f)); }
  console.log(`${dry ? '[dry-run] ' : ''}assets: ${files.length} berkas, dipertahankan ${files.length - victims.length}, dihapus ${victims.length} (${(bytes / 1048576).toFixed(1)} MB), umur minimal ${keepDays} hari`);
}
