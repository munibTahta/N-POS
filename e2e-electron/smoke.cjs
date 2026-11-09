// Uji asap Electron (tanpa GPU/headless via xvfb): meluncurkan aplikasi sungguhan dan merekam
// channel IPC yang terdaftar + status jendela + berkas database. Dipakai sebagai pembanding
// sebelum/sesudah memecah electron/main.cjs.
// Jalankan: xvfb-run -a node e2e-electron/smoke.cjs [fileKeluar.json]
const { _electron: electron } = require('@playwright/test');
const path = require('path'), fs = require('fs'), os = require('os');

(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'npos-smoke-'));
  const env = { ...process.env, NODE_ENV: 'production' };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: [path.resolve(__dirname, '..'), '--no-sandbox', '--disable-gpu', `--user-data-dir=${userData}`],
    env, timeout: 60000,
  });
  const logs = [];
  app.process().stderr?.on('data', (d) => logs.push(String(d)));
  const win = await app.firstWindow({ timeout: 60000 });
  await win.waitForLoadState('domcontentloaded');
  await new Promise((r) => setTimeout(r, 6000)); // beri waktu init DB & handler
  const channels = await app.evaluate(({ ipcMain }) => Array.from((ipcMain._invokeHandlers || new Map()).keys()).sort());
  const info = await app.evaluate(({ BrowserWindow, app: a }) => ({
    windows: BrowserWindow.getAllWindows().length, version: a.getVersion(), name: a.getName(),
  }));
  const api = await win.evaluate(() => Object.keys(window.electronAPI || {}).sort());
  const dbFiles = [];
  (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(db|sqlite)$/.test(f.name)) dbFiles.push(path.relative(userData, p)); } })(userData);
  const result = { channels, api, info, dbFiles: dbFiles.sort(), title: await win.title(), errorsInStderr: logs.join('').split('\n').filter((l) => /TypeError|ReferenceError|Cannot find module|Uncaught/.test(l)) };
  await app.close();
  const out = process.argv[2];
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ channels: channels.length, api: api.length, ...info, dbFiles: result.dbFiles, errors: result.errorsInStderr.length }));
  process.exit(0);
})().catch((e) => { console.error('SMOKE FAIL', e.message); process.exit(1); });
