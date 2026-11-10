// Ekstrak sekumpulan anak JSX dari return PosPage menjadi komponen terpisah.
// Props = variabel scope-komponen yang dipakai; impor yang dipakai disalin dengan path relatif dihitung ulang.
// Pakai:  node scripts/extract-jsx.cjs <file> <mulaiBaris> <akhirBaris> <NamaKomponen> <fileKeluar>
// Setelahnya WAJIB: npm run lint dan npm run test:e2e.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..') + path.sep;
const espree = require(root + 'node_modules/espree');
const eslintScope = require(root + 'node_modules/eslint-scope');

const [file, a, b, compName, outFile] = process.argv.slice(2);
const startLine = +a, endLine = +b;
const src = fs.readFileSync(file, 'utf8');
const ast = espree.parse(src, { ecmaVersion: 2023, sourceType: 'module', ecmaFeatures: { jsx: true }, range: true, loc: true });
const sm = eslintScope.analyze(ast, { ecmaVersion: 2023, sourceType: 'module', fallback: 'iteration' });

let compFn = null;
for (const n of ast.body) if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.name === 'PosPage') compFn = d.init;
if (!compFn) throw new Error('PosPage tidak ditemukan');
const compScope = sm.acquire(compFn);

const walk = (n, f, parent) => { if (!n || typeof n.type !== 'string') return; f(n, parent); for (const k of Object.keys(n)) { if (k === 'parent') continue; const c = n[k]; if (Array.isArray(c)) c.forEach((x) => walk(x, f, n)); else if (c && typeof c.type === 'string') walk(c, f, n); } };
const nodes = [];
walk(compFn.body, (n, parent) => {
  // hanya anak JSX (bukan nilai atribut)
  if (n.type === 'JSXElement' || n.type === 'JSXFragment' || (n.type === 'JSXExpressionContainer' && parent && parent.type !== 'JSXAttribute' && n.expression.type !== 'JSXEmptyExpression'))
    if (n.loc.start.line >= startLine && n.loc.end.line <= endLine) nodes.push(n);
});
const top = nodes.filter((n) => !nodes.some((m) => m !== n && m.range[0] <= n.range[0] && m.range[1] >= n.range[1])).sort((x, y) => x.range[0] - y.range[0]);
if (!top.length) throw new Error('tidak ada node JSX pada rentang itu');
const rs = top[0].range[0], re = top[top.length - 1].range[1];
const inRange = (r) => r[0] >= rs && r[1] <= re;

const ctx = new Set(), modRefs = new Map(), bad = new Set();
for (const scope of sm.scopes) for (const ref of scope.references) {
  if (!inRange(ref.identifier.range)) continue;
  const v = ref.resolved; if (!v) continue;
  if (v.defs.some((d) => inRange(d.name.range))) continue; // lokal di dalam blok
  if (v.scope === compScope) ctx.add(v.name);
  else if (v.scope.type === 'module') modRefs.set(v.name, v);
  else bad.add(v.name);
}
const modScope = sm.scopes.find((s) => s.type === 'module');
for (const t of top) walk(t, (n) => {
  if (n.type === 'JSXIdentifier' && /^[A-Z]/.test(n.name)) {
    if (compScope.set.get(n.name)) ctx.add(n.name); else if (modScope.set.get(n.name)) modRefs.set(n.name, modScope.set.get(n.name));
  }
});
if (bad.size) { console.error('BAIL: variabel dari scope perantara:', [...bad].join(', ')); process.exit(2); }

const origDir = path.dirname(file), outDir = path.dirname(outFile);
const fixPath = (p) => { if (!p.startsWith('.')) return p; let r = path.relative(outDir, path.resolve(origDir, p)); if (!r.startsWith('.')) r = './' + r; return r; };
const importsBySrc = new Map(), nonImport = [];
for (const [name, v] of modRefs) {
  const def = v.defs[0];
  if (def.type !== 'ImportBinding') { nonImport.push(name); continue; }
  const from = fixPath(def.parent.source.value), spec = def.node;
  const e = importsBySrc.get(from) || { def: null, ns: null, named: [] };
  if (spec.type === 'ImportDefaultSpecifier') e.def = name; else if (spec.type === 'ImportNamespaceSpecifier') e.ns = name;
  else e.named.push(spec.imported.name === name ? name : `${spec.imported.name} as ${name}`);
  importsBySrc.set(from, e);
}
if (nonImport.length) { console.error('BAIL: konstanta tingkat-modul non-impor:', nonImport.join(', ')); process.exit(2); }
const importLines = [...importsBySrc].map(([from, e]) => { const p = []; if (e.def) p.push(e.def); if (e.ns) p.push(`* as ${e.ns}`); if (e.named.length) p.push(`{ ${e.named.sort().join(', ')} }`); return `import ${p.join(', ')} from '${from}';`; });

const props = [...ctx].sort();
let body = src.slice(rs, re);
if (top.length === 1 && top[0].type === 'JSXExpressionContainer') body = src.slice(top[0].expression.range[0], top[0].expression.range[1]);
const multi = top.length > 1; // wadah ekspresi tunggal: {cond && (<X/>)} -> cond && (<X/>) (return tidak butuh kurung kurawal)
let comp = `${importLines.join('\n')}\n\n`;
comp += `export function ${compName}({ ${props.join(', ')} }) {\n  return (\n${multi ? '    <>\n' : ''}${body}\n${multi ? '    </>\n' : ''}  );\n}\n\nexport default ${compName};\n`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, comp);

const use = `<${compName} ${props.map((p) => `${p}={${p}}`).join(' ')} />`;
let out = src.slice(0, rs) + use + src.slice(re);
const lastImport = ast.body.filter((n) => n.type === 'ImportDeclaration').pop();
let rel = path.relative(origDir, outFile).replace(/\.jsx?$/, ''); if (!rel.startsWith('.')) rel = './' + rel;
out = out.slice(0, lastImport.range[1]) + `\nimport ${compName} from '${rel}';` + out.slice(lastImport.range[1]);
fs.writeFileSync(file, out);
console.log(JSON.stringify({ comp: outFile.replace(root, ''), baris: body.split('\n').length, props: props.length, imports: importLines.length }));
