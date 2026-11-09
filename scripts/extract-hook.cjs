// Ekstrak statement top-level dari komponen PosPage menjadi custom hook, berdasarkan analisis scope (eslint-scope).
// Variabel scope-komponen menjadi parameter hook; impor yang dipakai disalin dengan path relatif dihitung ulang.
// Pakai:  node scripts/extract-hook.cjs <file> <mulaiBaris> <akhirBaris> <namaHook> <fileKeluar> <effect|decls>
//   effect : satu useEffect(...)               -> hook tanpa nilai kembali
//   decls  : deretan const x = useCallback(...) -> hook mengembalikan { x, ... }
// Setelahnya WAJIB: npm run lint (impor yatim, deps setter/ref stabil) dan npm run test:e2e.
// Berhenti (exit 2) bila blok memakai konstanta tingkat-modul non-impor; pindahkan manual.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..') + path.sep;
const espree = require(root + 'node_modules/espree');
const eslintScope = require(root + 'node_modules/eslint-scope');

const [file, a, b, hookName, outFile, mode] = process.argv.slice(2);
const startLine = +a, endLine = +b;
const src = fs.readFileSync(file, 'utf8');
const ast = espree.parse(src, { ecmaVersion: 2023, sourceType: 'module', ecmaFeatures: { jsx: true }, range: true, loc: true, comment: true });
const sm = eslintScope.analyze(ast, { ecmaVersion: 2023, sourceType: 'module', fallback: 'iteration' });

// cari komponen PosPage
let compFn = null;
for (const n of ast.body) {
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.name === 'PosPage') compFn = d.init;
}
if (!compFn) throw new Error('PosPage tidak ditemukan');
const compScope = sm.acquire(compFn);
const stmts = compFn.body.body.filter((s) => s.loc.start.line >= startLine && s.loc.end.line <= endLine);
if (!stmts.length) throw new Error('tidak ada statement pada rentang itu');
let rs = stmts[0].range[0], re = stmts[stmts.length - 1].range[1];

// sertakan komentar tepat di atas (tanpa baris kosong)
const lines = src.split('\n');
let firstLine = stmts[0].loc.start.line;
while (firstLine > 1 && /^\s*(\/\/|\/\*|\*)/.test(lines[firstLine - 2])) firstLine--;
const lineStartOffset = (ln) => lines.slice(0, ln - 1).reduce((s, l) => s + l.length + 1, 0);
rs = lineStartOffset(firstLine);

const inRange = (r) => r[0] >= rs && r[1] <= re;
const own = new Set(); // variabel yang dideklarasikan oleh statement yang dipindah
for (const v of compScope.variables) if (v.defs.some((d) => inRange(d.node.range))) own.add(v.name);

const ctx = new Set(), modRefs = new Map(), unresolvedJsx = new Set();
for (const scope of sm.scopes) {
  for (const ref of scope.references) {
    if (!inRange(ref.identifier.range)) continue;
    const v = ref.resolved; if (!v) continue;
    if (v.scope === compScope) { if (!own.has(v.name)) ctx.add(v.name); }
    else if (v.scope.type === 'module') modRefs.set(v.name, v);
  }
}
// JSXIdentifier (komponen) tidak dianggap reference oleh eslint-scope
const walk = (n, f) => { if (!n || typeof n.type !== 'string') return; f(n); for (const k of Object.keys(n)) { if (k === 'parent') continue; const c = n[k]; if (Array.isArray(c)) c.forEach((x) => walk(x, f)); else if (c && typeof c.type === 'string') walk(c, f); } };
for (const s of stmts) walk(s, (n) => { if (n.type === 'JSXIdentifier' && /^[A-Z]/.test(n.name)) unresolvedJsx.add(n.name); });
for (const name of unresolvedJsx) {
  const v = compScope.set.get(name) || sm.globalScope.childScopes[0]?.set.get(name);
  if (compScope.set.get(name)) ctx.add(name);
  else if (sm.scopes.find((s) => s.type === 'module')?.set.get(name)) modRefs.set(name, sm.scopes.find((s) => s.type === 'module').set.get(name));
}

// impor yang dibutuhkan
const importsBySrc = new Map(); const bail = [];
const origDir = path.dirname(file), outDir = path.dirname(outFile);
const fixPath = (p) => { if (!p.startsWith('.')) return p; let r = path.relative(outDir, path.resolve(origDir, p)); if (!r.startsWith('.')) r = './' + r; return r; };
for (const [name, v] of modRefs) {
  const def = v.defs[0];
  if (def.type !== 'ImportBinding') { bail.push(name); continue; }
  const decl = def.parent; const spec = def.node; const from = fixPath(decl.source.value);
  const e = importsBySrc.get(from) || { def: null, ns: null, named: [] };
  if (spec.type === 'ImportDefaultSpecifier') e.def = name;
  else if (spec.type === 'ImportNamespaceSpecifier') e.ns = name;
  else e.named.push(spec.imported.name === name ? name : `${spec.imported.name} as ${name}`);
  importsBySrc.set(from, e);
}
if (bail.length) { console.error('BAIL: referensi tingkat-modul non-impor:', bail.join(', ')); process.exit(2); }
const importLines = [...importsBySrc].map(([from, e]) => {
  const parts = []; if (e.def) parts.push(e.def); if (e.ns) parts.push(`* as ${e.ns}`); if (e.named.length) parts.push(`{ ${e.named.sort().join(', ')} }`);
  return `import ${parts.join(', ')} from '${from}';`;
});

const body = src.slice(rs, re);
const ctxNames = [...ctx].sort();
const declared = [...own].sort();
let hook = `${importLines.join('\n')}\n\n`;
hook += `export function ${hookName}({ ${ctxNames.join(', ')} }) {\n${body}\n`;
if (mode === 'decls') hook += `\n  return { ${declared.join(', ')} };\n`;
hook += `}\n\nexport default ${hookName};\n`;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, hook);

const call = mode === 'decls' ? `  const { ${declared.join(', ')} } = ${hookName}({ ${ctxNames.join(', ')} });` : `  ${hookName}({ ${ctxNames.join(', ')} });`;
let out = src.slice(0, rs) + call + src.slice(re);
// tambah impor hook setelah impor terakhir
const lastImport = ast.body.filter((n) => n.type === 'ImportDeclaration').pop();
const rel = fixPath0(outFile);
function fixPath0(p) { let r = path.relative(origDir, p).replace(/\.js$/, ''); if (!r.startsWith('.')) r = './' + r; return r; }
const insertAt = lastImport.range[1]; // sebelum geser karena out sudah memotong di bawah impor
out = out.slice(0, insertAt) + `\nimport { ${hookName} } from '${rel}';` + out.slice(insertAt);
fs.writeFileSync(file, out);
console.log(JSON.stringify({ hook: outFile.replace(root, ''), dipindah: `${firstLine}-${stmts[stmts.length-1].loc.end.line}`, baris: body.split('\n').length, ctx: ctxNames.length, imports: importLines.length, declared }));
