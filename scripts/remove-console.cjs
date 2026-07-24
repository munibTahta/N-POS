#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDE_DIRS = new Set(['node_modules', 'public', 'release', 'resources', '.git']);
const EXTENSIONS = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx']);

function walk(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      walk(full, cb);
    } else if (e.isFile()) {
      if (EXTENSIONS.has(path.extname(e.name))) cb(full);
    }
  }
}

const modified = [];

walk(ROOT, (file) => {
  try {
    let src = fs.readFileSync(file, 'utf8');
    const original = src;

    // Remove single-line console statements
    src = src.replace(/^\s*console\.(?:log|debug|info)\s*\([^\n]*\);?\s*$/gm, '');

    // Neutralize inline console calls to avoid breaking expressions
    src = src.replace(/console\.(?:log|debug|info)\s*\(/g, 'void 0 && (');

    if (src !== original) {
      fs.writeFileSync(file, src, 'utf8');
      modified.push(file.replace(ROOT + path.sep, ''));
    }
  } catch (err) {
    console.error('Error processing', file, err.message);
  }
});
if (modified.length > 0) void 0 && (modified.join('\n'));

process.exit(0);
