const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { execSync } = require('child_process');

// Helper to query WMIC for a printer's port given its friendly name. This
// duplicates the logic used in the renderer's `get-printers` handler but is
// executed on-demand when we actually print.  If anything goes wrong we
// quietly return null so printing can still proceed using the friendly name.
function lookupPortForPrinter(name) {
  if (os.platform() !== 'win32' || !name) return null;
  // if we already ran the printer enumeration, we might have a port map
  if (global.lastPrinterPortMap && global.lastPrinterPortMap[name]) {
    return global.lastPrinterPortMap[name];
  }
  try {
    // escaping quotes inside name to avoid WMIC syntax errors
    const escaped = name.replace(/"/g, '\\"');
    const raw = execSync(
      `wmic printer where name="${escaped}" get PortName /format:csv`,
      { encoding: 'utf8', timeout: 2000 }
    );
    // output like: Node,PortName\r\nHOST,USB008\r\n
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const port = parts[1].trim();
        if (port && port.toUpperCase() !== 'PORTNAME') {
          return port;
        }
      }
    }
  } catch (err) {
    console.warn('WMIC port lookup failed during print', err && err.message ? err.message : err);
  }
  return null;
}

// helper for broadcasting print-related debug messages to renderer windows
function broadcastDebug(msg, extra = '') {
  try {
    const msgStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
    const extraStr = extra ? (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '';
    const fullMsg = extraStr ? `${msgStr} ${extraStr}` : msgStr;

    BrowserWindow.getAllWindows().forEach(w => {
      try { w.webContents.send('print-debug', fullMsg); } catch (_) {}
    });
  } catch (e) {
  }
}

function qzTrayDebug(msg, extra = '') {
  broadcastDebug(`[QZ Tray] ${msg}`, extra);
}

function qzTrayWarn(msg, extra = '') {
  broadcastDebug(`[QZ Tray WARN] ${msg}`, extra);
}

const path = require('node:path');
const fs = require('node:fs');
const os = require('os');

function getWritableCertDir() {
  const userDataPath = app.getPath('userData');
  const certDir = path.join(userDataPath, 'certs');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }
  return certDir;
}

function isValidQzTrayCertificate(certificate) {
  return typeof certificate === 'string'
    && certificate.includes('-----BEGIN CERTIFICATE-----')
    && certificate.includes('-----END CERTIFICATE-----');
}

function isValidQzTrayPrivateKey(privateKey) {
  return typeof privateKey === 'string'
    && (privateKey.includes('-----BEGIN RSA PRIVATE KEY-----') || privateKey.includes('-----BEGIN PRIVATE KEY-----'));
}

// try to load the modern forked POS printer library; if it's not installed
// we fall back to our own routines.
// NOTE: printing now uses Windows built-in methods only:
// 1. BrowserWindow.webContents.print() - renders HTML and prints
// 2. Windows print command - fallback for text
// 3. PowerShell Out-Printer - final fallback

// Allow a manual override to open DevTools even in production. This is useful when
// debugging a packaged build; set FORCE_DEVTOOLS=true in the environment or
// .env file before launching. Remember to remove the flag when done so that the
// user experience returns to normal.
const forceDevTools = String(process.env.FORCE_DEVTOOLS).toLowerCase() === 'true';

// Determine if we are in development mode.
// Treat as development only when NODE_ENV != 'production' AND the app is not packaged.
// Using app.isPackaged ensures the packaged EXE is treated as production even if NODE_ENV
// is not set at runtime.
const isDev = (process.env.NODE_ENV !== 'production') && !app.isPackaged;

// final decision used throughout the code
const allowDevTools = isDev || forceDevTools;

function createWindow() {
  // Buat jendela browser.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    maxWidth: 1920,
    maxHeight: 1080,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../resources/icon.ico'), // Set application icon
    webPreferences: {
      // preload.js akan menjadi jembatan antara React dan Electron
      preload: path.join(__dirname, 'preload.cjs'), // Correctly path to preload script
      contextIsolation: true,
      nodeIntegration: false,
        // Enable DevTools in development or when explicitly forced via environment
        devTools: allowDevTools,
    },
  });
  mainWindow.on('focus', () => {});
  mainWindow.on('blur', () => {});

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Allow remote origin from env in production
    const remoteUrl = process.env.ELECTRON_REMOTE_URL || 'https://pos.nusasoft.my.id';
    let remoteOrigin = '';
    try {
      if (remoteUrl) remoteOrigin = new URL(remoteUrl).origin;
    } catch (e) {
      console.error('Invalid ELECTRON_REMOTE_URL:', remoteUrl);
      remoteOrigin = 'https://pos.nusasoft.my.id';
    }

    const csp = isDev
      ? "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:5173; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' ws: wss: http: https: localhost:5173; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';"
      : "default-src 'self' " + remoteOrigin + "; " +
        "script-src 'self' " + remoteOrigin + "; " +
        "style-src 'self' " + remoteOrigin + " 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: " + remoteOrigin + " https:; " +
        "connect-src 'self' " + remoteOrigin + " https: http:; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    });
  });

  // Muat aplikasi React.
  // Development: Vite dev server.
  // Production: gunakan ELECTRON_REMOTE_URL dari .env (hosted web app).
  const startUrl = isDev
    ? 'http://localhost:5173/'
    : (process.env.ELECTRON_REMOTE_URL || 'https://pos.nusasoft.my.id');



  // Disable HMR for Electron to prevent WebSocket issues
  if (isDev) {
    process.env.VITE_DISABLE_HMR = 'true';
  }

  mainWindow.loadURL(startUrl).catch(err => {
    console.error('❌ Failed to load URL:', err);
  });

  // Ensure webContents gets focus when DOM is ready
  mainWindow.webContents.on('dom-ready', () => {

    mainWindow.webContents.focus();
  });

  // Monitor keyboard input issues
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {

    }
  });

  // Open DevTools when allowed (development or forced). When forced in a
  // production build the window will still be packaged normally, but DevTools
  // will pop open so you can inspect/console.log. Disable later by unsetting
  // FORCE_DEVTOOLS.
  if (allowDevTools) {
    mainWindow.webContents.openDevTools();
  }
}

// --- Print job queue (serialize thermal/raw print jobs) ---
const printQueue = [];
let processingPrintQueue = false;

function enqueuePrintJob(job) {
  return new Promise((resolve, reject) => {
    const wrapped = Object.assign({}, job, {
      attempts: 0,
      maxAttempts: job.maxAttempts || 3,
      resolve,
      reject
    });
    printQueue.push(wrapped);
    processPrintQueue();
  });
}

async function processPrintQueue() {
  if (processingPrintQueue) return;
  processingPrintQueue = true;

  while (printQueue.length > 0) {
    const job = printQueue.shift();
    job.attempts++;

    try {
      // job.handler should be an async function that performs the print
      const result = await Promise.race([
        job.handler(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Print timeout')), job.timeout || 15000))
      ]);
      job.resolve(result);
      // small delay between jobs to avoid overwhelming spooler
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      let errorMsg = 'Unknown error';
      try {
        if (err && typeof err === 'object') {
          errorMsg = err.message || err.toString() || 'Object error';
        } else if (typeof err === 'string') {
          errorMsg = err;
        } else {
          errorMsg = String(err || 'Undefined error');
        }
      } catch (msgErr) {
        errorMsg = 'Error formatting error message';
      }
      console.warn(`Print job attempt ${job.attempts} failed:`, errorMsg);
      if (job.attempts < job.maxAttempts) {
        // Check queue size limit to prevent unbounded growth (memory leak prevention)
        const MAX_QUEUE_SIZE = 100;
        if (printQueue.length >= MAX_QUEUE_SIZE) {
          const queueErr = new Error(`Print queue overflowed (${printQueue.length} items). Job rejected after ${job.attempts} attempts.`);
          console.error('❌ Print queue size exceeded limit:', queueErr.message);
          job.reject(queueErr);
        } else {
          // exponential backoff before retry
          const backoff = 500 * job.attempts;
          await new Promise(r => setTimeout(r, backoff));
          printQueue.unshift(job); // requeue at front
        }
      } else {
        const finalError = err || new Error('Print job failed after max attempts');
        job.reject(finalError);
      }
    }
  }

  processingPrintQueue = false;
}

// ========================================
// PRINTER HELPER FUNCTIONS (Before app.whenReady)
// ========================================

// *** SIMPLIFIED THERMAL PRINT METHOD - LIKE SUCCESSFUL TEST SCRIPT ***
async function printThermalSimple(printerName, content, paperWidth = '58mm') {
  broadcastDebug('🖨️ Starting simplified thermal print', { printerName, contentLength: content?.length, paperWidth });

  const tmp = os.tmpdir();
  const textFile = path.join(tmp, `thermal_receipt_${Date.now()}.txt`);

  try {
    // Save content as plain text (same as successful test script)
    fs.writeFileSync(textFile, content, 'utf8');
    broadcastDebug('✅ Saved thermal receipt to text file', textFile);

    // Escape printer name for PowerShell (handle quotes and special characters)
    const escapedPrinterName = printerName.replace(/'/g, "''").replace(/"/g, '`"');
    const escapedFilePath = textFile.replace(/'/g, "''");

    // Use the exact same PowerShell command as successful test script
    const printCmd = `powershell -Command "Start-Process -FilePath '${escapedFilePath}' -Verb PrintTo -ArgumentList '${escapedPrinterName}' -WindowStyle Hidden"`;
    broadcastDebug('🖨️ Using PowerShell PrintTo command', printCmd);

    execSync(printCmd, { stdio: 'pipe', timeout: 15000 });

    // Add delay to ensure printing has started before cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    broadcastDebug('✅ Simplified thermal print successful');
    return { success: true, method: 'powershell-printto-simple' };

  } catch (error) {
    broadcastDebug('❌ Simplified thermal print failed', error.message);
    throw error;
  } finally {
    // Clean up text file with additional delay
    setTimeout(() => {
      try {
        if (fs.existsSync(textFile)) {
          fs.unlinkSync(textFile);
        }
      } catch (cleanupErr) {
        console.warn('Failed to cleanup text file:', cleanupErr.message);
      }
    }, 3000); // Delay cleanup by 3 seconds
  }
}

function getPrinterCharWidth(printerName) {
  const name = String(printerName || '').toLowerCase();

  if (name.includes('100mm')) return 60;
  if (name.includes('80mm') || name.includes('80x80') || name.includes('star') || name.includes('seagull')) return 48;
  if (name.includes('58mm') || name.includes('pos-58') || name.includes('yw58') || name.includes('blueprint') || /\b58\b/.test(name)) return 32;

  const printerType = printUtils.detectPrinterType(printerName);
  return printerType === printUtils.PRINTER_TYPES.THERMAL ? 32 : 80;
}

function getPrinterPaperWidth(printerName) {
  const name = String(printerName || '').toLowerCase();

  if (name.includes('100mm')) return '100mm';
  if (name.includes('80mm') || name.includes('80x80') || name.includes('star') || name.includes('seagull')) return '80mm';
  if (name.includes('58mm') || name.includes('pos-58') || name.includes('yw58') || name.includes('blueprint') || /\b58\b/.test(name)) return '58mm';

  return printUtils.detectPrinterType(printerName) === printUtils.PRINTER_TYPES.THERMAL ? '58mm' : '80mm';
}

function wrapTextToWidth(text, maxWidth) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.split('\n').flatMap(line => {
    const words = line.trim().split(/\s+/);
    const lines = [];
    let current = '';

    for (const word of words) {
      if (!word) continue;

      if (!current) {
        if (word.length <= maxWidth) {
          current = word;
        } else {
          for (let pos = 0; pos < word.length; pos += maxWidth) {
            const chunk = word.slice(pos, pos + maxWidth);
            if (chunk.length === maxWidth) {
              lines.push(chunk);
            } else {
              current = chunk;
            }
          }
        }
        continue;
      }

      if (current.length + 1 + word.length <= maxWidth) {
        current += ' ' + word;
      } else {
        lines.push(current);
        if (word.length <= maxWidth) {
          current = word;
        } else {
          for (let pos = 0; pos < word.length; pos += maxWidth) {
            const chunk = word.slice(pos, pos + maxWidth);
            if (chunk.length === maxWidth) {
              lines.push(chunk);
            } else {
              current = chunk;
            }
          }
        }
      }
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [''];
  });
}

function formatColumns(columns, maxWidth) {
  const sanitized = columns.map(c => ({
    text: String((c && c.text) || ''),
    align: String((c && c.align) || 'left')
  }));

  if (sanitized.length === 0) {
    return '';
  }

  if (sanitized.length === 1) {
    return wrapTextToWidth(sanitized[0].text, maxWidth).join('\n');
  }

  const leftText = sanitized.slice(0, -1).map(c => c.text).join(' ');
  const rightText = sanitized[sanitized.length - 1].text;

  const leftLines = wrapTextToWidth(leftText, maxWidth);
  const rightLines = wrapTextToWidth(rightText, maxWidth);
  const lines = [];

  if (leftLines.length > 0) {
    const firstLeft = leftLines[0];
    const firstRight = rightLines[0] || '';
    if (firstLeft.length + firstRight.length + 1 <= maxWidth) {
      const spaces = maxWidth - firstLeft.length - firstRight.length;
      lines.push(firstLeft + ' '.repeat(spaces) + firstRight);
    } else {
      lines.push(firstLeft);
      if (firstRight) {
        lines.push(firstRight);
      }
    }
    if (leftLines.length > 1) {
      lines.push(...leftLines.slice(1));
    }
    if (rightLines.length > 1) {
      lines.push(...rightLines.slice(1));
    }
  } else {
    lines.push(...rightLines);
  }

  return lines.join('\n');
}

function formatPrintItem(item, maxWidth) {
  if (!item || typeof item !== 'object') {
    return '';
  }

  if (item.type === 'line') {
    return '-'.repeat(maxWidth);
  }

  const value = item.value !== undefined && item.value !== null ? String(item.value) : '';

  if (item.type === 'text') {
    if (item.columns && Array.isArray(item.columns) && item.columns.length > 0) {
      return formatColumns(item.columns, maxWidth);
    }
    return wrapTextToWidth(value, maxWidth).join('\n');
  }

  return wrapTextToWidth(value, maxWidth).join('\n');
}

// Perform structured receipt printing
async function performPrintReceipt(printerName, printData) {
  
  // normalize and trim before doing anything
  printerName = String(printerName || '').trim();
  if (!printerName) {
    throw new Error('Printer name tidak valid');
  }

  if (!Array.isArray(printData) || printData.length === 0) {
    throw new Error('Print data tidak valid');
  }

  // Validate printData structure
  for (let i = 0; i < printData.length; i++) {
    const item = printData[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`Print data item ${i} tidak valid: harus berupa object, got ${typeof item}`);
    }
    if (!item.type) {
      throw new Error(`Print data item ${i} tidak memiliki type field`);
    }
    if (item.type === 'line') {
      continue; // line items don't need value
    }
    if (item.value === undefined && !Array.isArray(item.columns)) {
      throw new Error(`Print data item ${i} (type: ${item.type}) tidak memiliki value atau columns. Keys: ${Object.keys(item).join(',')}`);
    }
  }

  // Always use structured data approach with thermal printer support
  try {
    // First check if this is a thermal printer
    const printerType = printUtils.detectPrinterType(printerName);
    broadcastDebug('performPrintReceipt detected printer type', { printerName, printerType });
    
    // For thermal printers, use QZ Tray as the single print path.
    if (printerType === printUtils.PRINTER_TYPES.THERMAL) {
      broadcastDebug('performPrintReceipt using QZ Tray for thermal printer', { printerName });
      
      // Convert structured data to plain text for thermal receipt with word wrapping
      const maxWidth = getPrinterCharWidth(printerName);
      const plainText = printData
        .map(item => formatPrintItem(item, maxWidth))
        .join('\n');
      
      broadcastDebug('Converted thermal receipt to plain text', { length: plainText.length, sample: plainText.slice(0, 200).replace(/\n/g, '\\n') });
      
      // Sanitize text for printer compatibility (same as before)
      let cleanText = plainText
        .replace(/\u00A0/g, ' ')           // non-breaking space → regular space
        .replace(/\r\n/g, '\n')            // normalize line endings
        .replace(/\r/g, '\n')
        // Replace Unicode box-drawing and special characters with ASCII equivalents
        .replace(/[─═║╔╗╚╝╠╣╦╩╬├┤┬┴┼]/g, '-')  // box drawing → dash
        .replace(/[…]/g, '...')            // ellipsis → three dots
        .replace(/[""]/g, '"')             // smart quotes → straight quotes
        .replace(/['']/g, "'")             // smart quotes → straight quotes
        .replace(/[–—]/g, '-')             // en/em dashes → hyphen
        // Remove any remaining non-latin1 characters (keep only 0-255 range)
        .split('')
        .map(c => {
          const code = c.charCodeAt(0);
          // Keep only ASCII (0-127) and extended ASCII (128-255)
          return code <= 255 ? c : '?';
        })
        .join('');
      
      broadcastDebug('Sanitized thermal text for printer', { length: cleanText.length, preview: cleanText.slice(0, 100) });
      
      const thermalService = require('./thermalPrintService.cjs');
      const result = await thermalService.printThermal(printerName, cleanText, {
        paperWidth: getPrinterPaperWidth(printerName),
        auto_cut: true
      });

      broadcastDebug('✅ Thermal receipt printed via QZ Tray', { printerName, method: result.method });
      return { success: true, method: 'qz-tray-thermal', printer: printerName, qzMethod: result.method };
    }
    
    // For non-thermal printers, produce readable plain text as fallback
    const plainText = printData
      .map(item => formatPrintItem(item, 80))
      .join('\n');
    
    broadcastDebug('performPrintReceipt print completed', { printerName, method: 'structured-text' });
    return { success: true, method: 'structured-text', printer: printerName };
  } catch (error) {
    broadcastDebug('performPrintReceipt error', error && error.message ? error.message : error);
    throw error;
  }
}

// --- FUNCTION TO REGISTER DATABASE IPC HANDLERS ---
// This must be called AFTER database initialization but BEFORE the window is created
// so that the renderer can access these handlers immediately
function registerDatabaseHandlers() {
  // IPC Handler: Query database ready status
  ipcMain.handle('query-db-ready', async (event) => {
    return { ready: isDatabaseReady, timestamp: new Date().toISOString() };
  });

  async function ensureSalesColumn(columnName, columnType = 'TEXT') {
    try {
      const salesColumns = offlineDb.prepare("PRAGMA table_info(sales)").all();
      const hasColumn = salesColumns.some(col => col.name === columnName);
      if (!hasColumn) {
        console.warn(`🔧 Adding missing sales column: ${columnName} (${columnType})`);
        offlineDb.exec(`ALTER TABLE sales ADD COLUMN ${columnName} ${columnType}`);
      }
    } catch (schemaError) {
      console.error(`❌ Failed to ensure sales column ${columnName}:`, schemaError.message);
      throw schemaError;
    }
  }

  // ✅ FIX #3: Define allowed columns for each table (prevent SQL injection)
  const ALLOWED_COLUMNS = {
    products: ['id_produk', 'kode_produk', 'nama_produk', 'id_kategori', 'id_satuan', 'harga_beli', 'harga_jual', 'harga_grosir', 'min_qty_grosir', 'stok_minimum', 'status', 'gambar', 'barcode', 'merek', 'lokasi_rak', 'deskripsi', 'foto_produk', 'created_at', 'updated_at', 'synced', 'sync_version', 'id_cabang_pemilik', 'urutan'],
    branches: ['id_cabang', 'kode_cabang', 'nama_cabang', 'alamat', 'kota', 'no_telp', 'status', 'tipe_katalog', 'created_at'],
    sales: ['id_penjualan', 'kode_transaksi', 'id_cabang', 'id_pelanggan', 'id_user', 'tanggal', 'total', 'total_diskon', 'pajak', 'metode_pembayaran', 'status', 'status_pembayaran', 'catatan', 'tanggal_transaksi', 'created_at', 'updated_at', 'synced', 'sync_version', 'bayar', 'diskon'],
    sale_items: ['id', 'id_penjualan', 'id_produk', 'jumlah', 'harga_satuan', 'subtotal', 'diskon_item', 'created_at', 'tipe_harga', 'harga_produk'],
    payment_details: ['id', 'id_penjualan', 'metode_pembayaran', 'shadow_pay', 'jumlah_bayar', 'created_at'],
    sync_queue: ['id', 'table_name', 'operation', 'record_id', 'data', 'status', 'error_message', 'created_at', 'updated_at', 'server_id', 'retry_count'],
    sync_metadata: ['key', 'value', 'created_at', 'updated_at'],
    categories: ['id_kategori', 'nama_kategori', 'created_at', 'updated_at', 'synced', 'sync_version'],
    units: ['id_satuan', 'nama_satuan', 'created_at', 'updated_at', 'synced', 'sync_version'],
    customers: ['id_pelanggan', 'nama_pelanggan', 'nomor_hp', 'email', 'alamat', 'created_at', 'updated_at', 'synced', 'sync_version'],
    supplier: ['id_supplier', 'nama_supplier', 'alamat', 'telepon', 'email', 'created_at', 'updated_at', 'synced', 'sync_version'],
    suppliers: ['id_supplier', 'nama_supplier', 'alamat', 'telepon', 'email', 'created_at', 'updated_at', 'synced', 'sync_version'],
    purchases: ['id_pembelian', 'kode_pembelian', 'id_supplier', 'id_cabang', 'tanggal', 'total', 'status', 'masuk_gudang', 'catatan', 'id_user', 'created_at', 'updated_at', 'synced', 'sync_version'],
    purchase_items: ['id', 'id_pembelian', 'id_produk', 'jumlah', 'harga_beli', 'subtotal', 'created_at'],
    metode_pembayaran: ['id_metode', 'kode_metode', 'nama_metode', 'tipe_metode', 'aktif', 'konfigurasi', 'is_default', 'urutan_tampil', 'biaya_tambahan_persen', 'biaya_tambahan_nominal', 'minimum_transaksi', 'maksimum_transaksi', 'created_at', 'updated_at', 'synced', 'sync_version'],
    warehouse_stock: ['id', 'id_produk', 'id_cabang', 'stok', 'lokasi_rak', 'updated_at']
  };

  // Validate column names (prevent SQL injection via column names)
  function validateColumns(table, columns) {
    const allowedCols = ALLOWED_COLUMNS[table] || [];
    for (const col of columns) {
      if (!allowedCols.includes(col)) {
        throw new Error(`⚠️ SQL Injection Attempt: Column "${col}" not allowed in table "${table}"`);
      }
    }
  }

  const ALLOWED_TABLES = Object.keys(ALLOWED_COLUMNS);

  function validateWhereClause(whereClause) {
    if (!whereClause || typeof whereClause !== 'string') {
      throw new Error('WHERE clause must be a non-empty string');
    }
    const forbidden = /;|--|\/\*|\*\//;
    if (forbidden.test(whereClause)) {
      throw new Error('Invalid WHERE clause');
    }
    const safePattern = /^[\w\s=<>!\.%'"(),\-?]+$/;
    if (!safePattern.test(whereClause)) {
      throw new Error('WHERE clause contains unsupported characters');
    }
  }

  async function validateAndFixSalesSchema(data) {
    const requiredColumns = {
      status_pembayaran: 'TEXT',
      total: 'REAL',
      tanggal: 'DATETIME',
      id_cabang: 'INTEGER',
      diskon: 'REAL',
      pajak: 'REAL',
      bayar: 'REAL'
    };

    // Get all columns in the table
    const existingColumns = offlineDb.prepare("PRAGMA table_info(sales)").all().map(col => col.name);
    
    // Check for columns needed by data OR required system columns
    const columnsToCheck = {
      ...requiredColumns,
      ...Object.fromEntries(Object.keys(data).map(key => [key, 'TEXT']))
    };

    for (const [colName, colType] of Object.entries(columnsToCheck)) {
      if (!existingColumns.includes(colName)) {
        try {
          await ensureSalesColumn(colName, colType);
        } catch (err) {
          console.error(`Schema validation failed for ${colName}:`, err.message);
          // Don't throw - continue and let insert error handler deal with it
        }
      }
    }
  }

  // IPC Handler: Generic insert into database
  ipcMain.handle('db-insert', async (event, { table, data }) => {
    try {
      if (!offlineDb) throw new Error('Database not initialized');
      if (!table || typeof table !== 'string') throw new Error('Invalid table name');
      if (!data || typeof data !== 'object') throw new Error('Invalid data');

      // Pre-validate schema for sales table
      if (table === 'sales') {
        try {
          await validateAndFixSalesSchema(data);
        } catch (validationErr) {
          console.warn('Pre-insert validation had issues, will attempt insert anyway:', validationErr.message);
        }
      }

      if (!ALLOWED_TABLES.includes(table)) throw new Error(`Table '${table}' not allowed`);

      const columns = Object.keys(data);
      
      // ✅ FIX #3: Validate column names against whitelist (prevent SQL injection)
      validateColumns(table, columns);
      
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(data);

      // Use INSERT OR IGNORE to handle duplicates gracefully
      const stmt = offlineDb.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
      const result = stmt.run(...values);
      return result;
    } catch (error) {
      console.error('❌ db-insert error:', error.message);

      if (table === 'sales' && error.message && error.message.includes('no column named')) {
        const match = error.message.match(/no column named ["`]?(\w+)["`]?/i);
        if (match) {
          const missingColumn = match[1];
          const columnTypes = {
            id_cabang: 'INTEGER',
            tanggal: 'DATETIME',
            status_pembayaran: 'TEXT',
            total: 'REAL',
            diskon: 'REAL',
            pajak: 'REAL',
            bayar: 'REAL',
            harga_jual: 'REAL',
            jumlah: 'INTEGER',
            subtotal: 'REAL'
          };
          const columnType = columnTypes[missingColumn] || 'TEXT';
          
          try {
            console.warn(`🔧 Attempting to add missing sales column: ${missingColumn} (${columnType})`);
            await ensureSalesColumn(missingColumn, columnType);
            // Verify column exists now
            const verifyColumns = offlineDb.prepare("PRAGMA table_info(sales)").all();
            const columnExists = verifyColumns.some(col => col.name === missingColumn);
            if (!columnExists) {
              throw new Error(`Column ${missingColumn} still missing after adding!`);
            }

            // Retry the insert once after adding the missing column
            const columns = Object.keys(data);
            const placeholders = columns.map(() => '?').join(', ');
            const values = Object.values(data);
            const stmt = offlineDb.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
            const result = stmt.run(...values);
            return result;
          } catch (migrationErr) {
            console.error(`❌ Failed to migrate column ${missingColumn}:`, migrationErr.message);
            throw new Error(`Schema migration failed for column ${missingColumn}: ${migrationErr.message}`);
          }
        }
      }

      throw error;
    }
  });

  // IPC Handler: Generic update database
  ipcMain.handle('db-update', async (event, { table, data, whereClause, whereValues }) => {
    try {
      if (!offlineDb) throw new Error('Database not initialized');
      if (!table || typeof table !== 'string') throw new Error('Invalid table name');
      if (!data || typeof data !== 'object') throw new Error('Invalid data');
      if (!whereClause || typeof whereClause !== 'string') throw new Error('WHERE clause required');

      if (!ALLOWED_TABLES.includes(table)) throw new Error(`Table '${table}' not allowed`);

      validateWhereClause(whereClause);
      validateColumns(table, Object.keys(data));

      // ✅ FIX #1: Filter columns to only allowed ones (prevent SQL injection)
      const allowedColumns = ALLOWED_COLUMNS[table] || [];
      const updates = Object.keys(data)
        .filter(col => allowedColumns.includes(col))
        .map(col => `${col} = ?`)
        .join(', ');

      if (updates.length === 0) {
        throw new Error('No valid columns to update');
      }

      // Only include values for allowed columns
      const filteredData = Object.fromEntries(
        Object.entries(data).filter(([key]) => allowedColumns.includes(key))
      );
      const values = Object.values(filteredData);
      const allValues = [...values, ...(whereValues || [])];

      const stmt = offlineDb.prepare(`UPDATE ${table} SET ${updates} WHERE ${whereClause}`);
      const result = stmt.run(...allValues);
      return result;
    } catch (error) {
      console.error('db-update error:', error);
      throw error;
    }
  });

  // ✅ FIX #4: Atomic transaction handler - ensures all-or-nothing updates
  ipcMain.handle('db-transaction', async (event, operations) => {
    try {
      if (!offlineDb) throw new Error('Database not initialized');
      if (!Array.isArray(operations)) throw new Error('Operations must be an array');
      // Begin transaction
      offlineDb.exec('BEGIN TRANSACTION');

      try {
        const results = [];

        for (const op of operations) {
          const { type, table, data, whereClause, whereValues } = op;
          if (!ALLOWED_TABLES.includes(table)) {
            throw new Error(`Table '${table}' not allowed in transaction`);
          }

          if (type === 'insert') {
            const columns = Object.keys(data || {});
            if (columns.length === 0) {
              throw new Error('Insert operation requires data');
            }
            validateColumns(table, columns);
            const placeholders = columns.map(() => '?').join(', ');
            const values = Object.values(data);
            const stmt = offlineDb.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
            results.push(stmt.run(...values));
          } else if (type === 'update') {
            if (!data || typeof data !== 'object') {
              throw new Error('Update operation requires data');
            }
            validateWhereClause(whereClause);
            validateColumns(table, Object.keys(data));
            const updates = Object.keys(data).map(col => `${col} = ?`).join(', ');
            const values = Object.values(data);
            const allValues = [...values, ...(whereValues || [])];
            const stmt = offlineDb.prepare(`UPDATE ${table} SET ${updates} WHERE ${whereClause}`);
            results.push(stmt.run(...allValues));
          } else if (type === 'delete') {
            validateWhereClause(whereClause);
            const stmt = offlineDb.prepare(`DELETE FROM ${table} WHERE ${whereClause}`);
            results.push(stmt.run(...(whereValues || [])));
          } else {
            throw new Error(`Unsupported transaction operation type: ${type}`);
          }
        }

        // Commit transaction
        offlineDb.exec('COMMIT');
        return { success: true, results };
      } catch (transactionErr) {
        // Rollback on any error
        try {
          offlineDb.exec('ROLLBACK');
          console.error('❌ Transaction rolled back due to error:', transactionErr.message);
        } catch (rollbackErr) {
          console.error('❌ Rollback failed:', rollbackErr.message);
        }
        throw transactionErr;
      }
    } catch (error) {
      console.error('db-transaction error:', error.message);
      throw error;
    }
  });

  // IPC Handler: Generic delete from database
  ipcMain.handle('db-delete', async (event, { table, whereClause, whereValues = [] }) => {
    try {
      if (!offlineDb) throw new Error('Database not initialized');
      if (!table || typeof table !== 'string') throw new Error('Invalid table name');
      if (!whereClause || typeof whereClause !== 'string') throw new Error('WHERE clause required');

      if (!ALLOWED_TABLES.includes(table)) throw new Error(`Table '${table}' not allowed`);
      validateWhereClause(whereClause);

      const stmt = offlineDb.prepare(`DELETE FROM ${table} WHERE ${whereClause}`);
      const result = stmt.run(...whereValues);
      return result;
    } catch (error) {
      console.error('db-delete error:', error);
      throw error;
    }
  });

  // IPC Handler: Generic select from database
  ipcMain.handle('db-select', async (event, { table, whereClause = '', whereValues = [], limit = null }) => {
    try {
      if (!offlineDb) throw new Error('Database not initialized');
      if (!table || typeof table !== 'string') throw new Error('Invalid table name');

      if (!ALLOWED_TABLES.includes(table)) throw new Error(`Table '${table}' not allowed`);
      if (whereClause) validateWhereClause(whereClause);

      let query = `SELECT * FROM ${table}`;
      if (whereClause) query += ` WHERE ${whereClause}`;
      query += ' LIMIT ?';

      const stmt = offlineDb.prepare(query);
      return stmt.all(...whereValues, limit || 1000);
    } catch (error) {
      console.error('db-select error:', error);
      throw error;
    }
  });

  // IPC Handler: Get sync queue items
  ipcMain.handle('db-get-sync-queue', async (event, { status = ['pending', 'syncing', 'processing'] } = {}) => {
    try {
      if (!offlineDb) throw new Error('Database not initialized');
      const statuses = typeof status === 'string' ? [status] : Array.isArray(status) ? status : ['pending'];
      const allowedStatuses = ['pending', 'syncing', 'processing', 'failed', 'completed'];
      statuses.forEach((value) => {
        if (!allowedStatuses.includes(value)) throw new Error(`Invalid sync queue status: ${value}`);
      });

      const placeholders = statuses.map(() => '?').join(', ');
      const stmt = offlineDb.prepare(`SELECT * FROM sync_queue WHERE status IN (${placeholders}) ORDER BY created_at ASC`);
      return stmt.all(...statuses);
    } catch (error) {
      console.error('db-get-sync-queue error:', error);
      throw error;
    }
  });

  // IPC Handler: Get sync metadata by key
  ipcMain.handle('db-get-sync-metadata', async (event, { key }) => {
    try {
      if (!offlineDb) throw new Error('Database not initialized');
      if (!key) throw new Error('Metadata key is required');
      const stmt = offlineDb.prepare('SELECT value FROM sync_metadata WHERE key = ?');
      const result = stmt.get(key);
      return result ? result.value : null;
    } catch (error) {
      console.error('db-get-sync-metadata error:', error);
      throw error;
    }
  });

  // IPC Handler: Product database search
  ipcMain.handle('product-db-search', async (event, query, options = {}) => {
    try {
      // Empty query means get all active products
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const status = options.status || 'aktif';
      const id_cabang = options.id_cabang;
      const tipe_katalog = options.tipe_katalog || 'global';
      
      // Try to search in offlineDb first
      if (offlineDb) {
        let stmt, results, totalStmt, totalResult;
        
        let catalogFilter = 'id_cabang_pemilik IS NULL';
        const queryParams = [];
        
        if (id_cabang && tipe_katalog === 'terpisah') {
          catalogFilter = 'id_cabang_pemilik = ?';
          queryParams.push(id_cabang);
        } else {
          catalogFilter = 'id_cabang_pemilik IS NULL';
        }
        
        if (query && query.trim()) {
          // Specific search query
          const searchPattern = `%${query}%`;
          stmt = offlineDb.prepare(`
            SELECT * FROM products 
            WHERE (nama_produk LIKE ? OR kode_produk LIKE ? OR barcode LIKE ?)
            AND status = ?
            AND ${catalogFilter}
            ORDER BY urutan ASC, nama_produk ASC
            LIMIT ? OFFSET ?
          `);
          results = stmt.all(searchPattern, searchPattern, searchPattern, status, ...queryParams, limit, offset);
          
          totalStmt = offlineDb.prepare(`
            SELECT COUNT(*) as count FROM products 
            WHERE (nama_produk LIKE ? OR kode_produk LIKE ? OR barcode LIKE ?)
            AND status = ?
            AND ${catalogFilter}
          `);
          totalResult = totalStmt.get(searchPattern, searchPattern, searchPattern, status, ...queryParams);
        } else {
          // Empty query = get all active products
          stmt = offlineDb.prepare(`
            SELECT * FROM products 
            WHERE status = ?
            AND ${catalogFilter}
            ORDER BY urutan ASC, nama_produk ASC
            LIMIT ? OFFSET ?
          `);
          results = stmt.all(status, ...queryParams, limit, offset);
          
          totalStmt = offlineDb.prepare(`
            SELECT COUNT(*) as count FROM products 
            WHERE status = ?
            AND ${catalogFilter}
          `);
          totalResult = totalStmt.get(status, ...queryParams);
        }
        
        return {
          data: results || [],
          total: totalResult ? totalResult.count : 0,
          limit,
          offset
        };
      }
      
      // Fallback to productDatabase if available
      if (productDatabase && productDatabase.search) {
        try {
          const result = await productDatabase.search(query, options);
          return result || { data: [], total: 0, limit, offset };
        } catch (productDbErr) {
          console.warn('productDatabase.search failed:', productDbErr.message);
        }
      }
      
      return { data: [], total: 0, limit, offset };
    } catch (error) {
      console.error('product-db-search error:', error);
      throw error;
    }
  });

  // IPC Handler: Product count
  ipcMain.handle('product-db-get-count', async (event) => {
    try {
      if (offlineDb) {
        const result = offlineDb.prepare('SELECT COUNT(*) as count FROM products').get();
        return result ? result.count : 0;
      }
      if (productDatabase && productDatabase.getCount) {
        return await productDatabase.getCount();
      }
      return 0;
    } catch (error) {
      console.error('product-db-get-count error:', error);
      return 0;
    }
  });

  // IPC Handler: Bulk upsert products
  ipcMain.handle('product-db-bulk-upsert', async (event, products) => {
    try {
      if (!productDatabase || !productDatabase.isInitialized) {
        throw new Error('ProductDatabase not available');
      }
      const result = productDatabase.bulkUpsertProducts(products);
      // Normalize result
      return {
        synced: (result.inserted || 0) + (result.updated || 0),
        failed: result.failed || 0,
        inserted: result.inserted,
        updated: result.updated,
        failedRows: result.failedRows || []
      };
    } catch (error) {
      console.error('Product DB bulk upsert error:', error);
      throw error;
    }
  });

  // IPC Handler: Get database statistics
  ipcMain.handle('product-db-get-stats', async (event) => {
    try {
      if (!productDatabase || !productDatabase.isInitialized) {
        return { 
          totalProducts: 0, 
          lastSync: null, 
          sampleProducts: [],
          pending: 0,
          synced: 0,
          failed: 0,
          totalPendingValue: 0
        };
      }
      return productDatabase.getStats();
    } catch (error) {
      console.error('Product DB get stats error:', error);
      throw error;
    }
  });

  // IPC Handler: Get stocks for specific branch (offline stock loading)
  ipcMain.handle('product-db-get-stocks-by-cabang', async (event, idCabang) => {
    try {
      if (!idCabang) {
        return [];
      }
      const stocks = productDatabase.getStocksByCabang(idCabang);
      return stocks;
    } catch (error) {
      console.error('❌ product-db-get-stocks-by-cabang error:', error);
      return [];
    }
  });

  // IPC Handler: Get stock for specific product and branch
  ipcMain.handle('product-db-get-stock', async (event, idProduk, idCabang) => {
    try {
      const stock = productDatabase.getStockByProductAndCabang(idProduk, idCabang);
      return stock;
    } catch (error) {
      console.error('❌ product-db-get-stock error:', error);
      return 0;
    }
  });

  // IPC Handler: Get total stock across all branches for product
  ipcMain.handle('product-db-get-product-total-stock', async (event, idProduk) => {
    try {
      const stock = productDatabase.getProductTotalStock(idProduk);
      return stock;
    } catch (error) {
      console.error('❌ product-db-get-product-total-stock error:', error);
      return 0;
    }
  });

  // IPC Handler: Bulk upsert stocks to offline database
  ipcMain.handle('product-db-bulk-upsert-stocks', async (event, stocks) => {
    try {
      if (!Array.isArray(stocks) || stocks.length === 0) {
        return { success: true, synced: 0 };
      }
      const result = productDatabase.bulkUpsertStocks(stocks);
      const summary = `Stocks upserted: ${result.inserted + result.updated} (failed: ${result.failed})`;
      const now = Date.now();
      const lastSummary = global.lastStockSyncSummary || '';
      const lastSummaryTs = global.lastStockSyncSummaryTs || 0;
      const canRepeatLog = now - lastSummaryTs > 60 * 1000;
      const shouldLog = result.failed > 0 || summary !== lastSummary || canRepeatLog;

      if (shouldLog) {
        global.lastStockSyncSummary = summary;
        global.lastStockSyncSummaryTs = now;
      }

      return { success: true, synced: result.inserted + result.updated };
    } catch (error) {
      console.error('❌ product-db-bulk-upsert-stocks error:', error);
      return { success: false, error: error.message };
    }
  });

  // IPC Handler: Get transaction statistics
  ipcMain.handle('product-db-get-transaction-stats', async (event) => {
    try {
      if (!productDatabase || !productDatabase.isInitialized) {
        return {
          pending: 0,
          synced: 0,
          failed: 0,
          totalPendingValue: 0
        };
      }
      return productDatabase.getOfflineTransactionStats();
    } catch (error) {
      console.error('Product DB get transaction stats error:', error);
      throw error;
    }
  });

  // IPC Handler: Set sync metadata
  ipcMain.handle('db-set-sync-metadata', async (event, { key, value }) => {
    try {
      if (!offlineDb) throw new Error('Database not initialized');
      if (!key) throw new Error('Metadata key is required');
      if (value === undefined || value === null) throw new Error('Metadata value is required');

      // Try to update first
      const updateStmt = offlineDb.prepare('UPDATE sync_metadata SET value = ? WHERE key = ?');
      const updateResult = updateStmt.run(value, key);

      // If no rows updated, insert
      if (updateResult.changes === 0) {
        const insertStmt = offlineDb.prepare('INSERT INTO sync_metadata (key, value) VALUES (?, ?)');
        insertStmt.run(key, value);
      }

      return { success: true, key, value };
    } catch (error) {
      console.error('db-set-sync-metadata error:', error);
      throw error;
    }
  });

  // IPC handler for database reset (for development/testing)
  ipcMain.handle('db-reset', async (event) => {
    const Database = require('better-sqlite3');
    const dbPath = path.join(app.getPath('userData'), 'offline.db');
    const productDbPath = path.join(app.getPath('userData'), 'product_offline.db');

    try {
      // Step 1: Close the database connections completely
      if (offlineDb) {
        try {
          offlineDb.close();
          offlineDb = null;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (closeErr) {
          console.error('Error closing offlineDb:', closeErr);
        }
      }

      if (productDatabase && typeof productDatabase.close === 'function') {
        try {
          productDatabase.close();
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (closeErr) {
          console.error('Error closing productDatabase:', closeErr);
        }
      }

      // Step 2: Aggressively delete all offline database files
      const filesToDelete = [
        dbPath,
        `${dbPath}-wal`,
        `${dbPath}-shm`,
        `${dbPath}-journal`,
        productDbPath,
        `${productDbPath}-wal`,
        `${productDbPath}-shm`,
        `${productDbPath}-journal`
      ];

      for (const filePath of filesToDelete) {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (deleteErr) {
            console.warn(`Failed to delete ${filePath}:`, deleteErr.message);
            try {
              const backupPath = `${filePath}.backup-${Date.now()}`;
              fs.renameSync(filePath, backupPath);
            } catch (renameErr) {
              console.warn(`Failed to rename ${filePath}:`, renameErr.message);
            }
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      if (fs.existsSync(dbPath)) {
        try {
          fs.rmSync(dbPath, { force: true, recursive: false });
        } catch (forceErr) {
          console.error('Could not delete offline database file:', forceErr.message);
          throw new Error(`Failed to delete offline database file: ${forceErr.message}`);
        }
      }

      if (fs.existsSync(productDbPath)) {
        try {
          fs.rmSync(productDbPath, { force: true, recursive: false });
        } catch (forceErr) {
          console.error('Could not delete product database file:', forceErr.message);
          throw new Error(`Failed to delete product database file: ${forceErr.message}`);
        }
      }

      // Step 3: Recreate a completely fresh offline database
      offlineDb = new Database(dbPath);
      offlineDb.pragma('journal_mode = WAL');

      // Step 4: Create all tables
      offlineDb.exec(`
        CREATE TABLE categories (
          id_kategori INTEGER PRIMARY KEY,
          nama_kategori TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0
        );

        CREATE TABLE units (
          id_satuan INTEGER PRIMARY KEY,
          nama_satuan TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0
        );

        CREATE TABLE customers (
          id_pelanggan INTEGER PRIMARY KEY,
          nama_pelanggan TEXT NOT NULL,
          nomor_hp TEXT,
          email TEXT,
          alamat TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0
        );

        CREATE TABLE products (
          id_produk INTEGER PRIMARY KEY,
          kode_produk TEXT NOT NULL,
          nama_produk TEXT NOT NULL,
          id_kategori INTEGER,
          id_satuan INTEGER,
          harga_beli REAL NOT NULL DEFAULT 0.00,
          harga_jual REAL NOT NULL DEFAULT 0.00,
          harga_grosir REAL DEFAULT 0.00,
          min_qty_grosir INTEGER DEFAULT 0,
          stok_minimum INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'aktif',
          gambar TEXT,
          barcode TEXT UNIQUE,
          merek TEXT,
          lokasi_rak TEXT,
          deskripsi TEXT,
          foto_produk TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0
        );

        CREATE TABLE sales (
          id_penjualan INTEGER PRIMARY KEY,
          kode_transaksi TEXT UNIQUE NOT NULL,
          id_cabang INTEGER,
          id_pelanggan INTEGER,
          id_user INTEGER,
          tanggal DATETIME,
          total REAL NOT NULL,
          total_diskon REAL DEFAULT 0.00,
          pajak REAL DEFAULT 0.00,
          metode_pembayaran TEXT,
          status TEXT NOT NULL DEFAULT 'selesai',
          status_pembayaran TEXT,
          catatan TEXT,
          tanggal_transaksi DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0
        );

        CREATE TABLE sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_penjualan INTEGER,
          id_produk INTEGER,
          jumlah INTEGER NOT NULL,
          harga_satuan REAL DEFAULT 0,
          subtotal REAL NOT NULL,
          diskon_item REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_penjualan) REFERENCES sales (id_penjualan),
          FOREIGN KEY (id_produk) REFERENCES products (id_produk)
        );

        CREATE TABLE payment_details (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_penjualan INTEGER,
          metode_pembayaran TEXT,
          jumlah_bayar REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_penjualan) REFERENCES sales (id_penjualan)
        );

        CREATE TABLE sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          operation TEXT NOT NULL,
          record_id INTEGER,
          data TEXT,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE metode_pembayaran (
          id_metode INTEGER PRIMARY KEY AUTOINCREMENT,
          kode_metode TEXT UNIQUE,
          nama_metode TEXT NOT NULL,
          tipe_metode TEXT,
          aktif INTEGER DEFAULT 1,
          konfigurasi TEXT,
          is_default INTEGER DEFAULT 0,
          urutan_tampil INTEGER DEFAULT 0,
          biaya_tambahan_persen DECIMAL(5,2) DEFAULT 0.00,
          biaya_tambahan_nominal DECIMAL(15,2) DEFAULT 0.00,
          minimum_transaksi DECIMAL(15,2) DEFAULT 0.00,
          maksimum_transaksi DECIMAL(15,2),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0
        );

        CREATE TABLE supplier (
          id_supplier INTEGER PRIMARY KEY,
          nama_supplier TEXT NOT NULL,
          alamat TEXT,
          telepon TEXT,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0
        );

        CREATE TABLE purchases (
          id_pembelian INTEGER PRIMARY KEY,
          kode_pembelian TEXT UNIQUE,
          id_supplier INTEGER,
          id_cabang INTEGER,
          tanggal DATETIME,
          total REAL,
          status TEXT DEFAULT 'selesai',
          masuk_gudang INTEGER DEFAULT 0,
          catatan TEXT,
          id_user INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0,
          FOREIGN KEY (id_supplier) REFERENCES supplier (id_supplier)
        );

        CREATE TABLE purchase_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_pembelian INTEGER,
          id_produk INTEGER,
          jumlah INTEGER,
          harga_beli REAL,
          subtotal REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_pembelian) REFERENCES purchases (id_pembelian),
          FOREIGN KEY (id_produk) REFERENCES products (id_produk)
        );

        CREATE INDEX idx_products_kode ON products (kode_produk);
        CREATE INDEX idx_products_barcode ON products (barcode);
        CREATE INDEX idx_sales_kode_transaksi ON sales (kode_transaksi);
        CREATE INDEX idx_sales_created_at ON sales (created_at);
        CREATE INDEX idx_sale_items_id_penjualan ON sale_items (id_penjualan);
        CREATE INDEX idx_payment_details_id_penjualan ON payment_details (id_penjualan);
        CREATE INDEX idx_purchases_kode ON purchases (kode_pembelian);
        CREATE INDEX idx_purchases_created_at ON purchases (created_at);
        CREATE INDEX idx_purchase_items_id_pembelian ON purchase_items (id_pembelian);
        CREATE INDEX idx_sync_queue_status ON sync_queue (status);
        CREATE INDEX idx_customers_nama ON customers (nama_pelanggan);
        CREATE INDEX idx_customers_hp ON customers (nomor_hp);
      `);

      if (productDatabase && typeof productDatabase.initialize === 'function') {
        productDatabase.initialize();
      }

      return {
        success: true,
        message: 'Database berhasil direset'
      };

    } catch (error) {
      console.error('Failed to reset database:', error);
      
      try {
        if (!offlineDb) {
          offlineDb = new Database(dbPath);
          offlineDb.pragma('journal_mode = WAL');
        }

        if (productDatabase && typeof productDatabase.initialize === 'function' && !productDatabase.isInitialized) {
          productDatabase.initialize();
        }
      } catch (reopenErr) {
        console.error('Failed to reopen database:', reopenErr);
      }

      throw error;
    }
  });

  // IPC handler for database reinitialize (fix schema without deleting data)
  ipcMain.handle('db-reinitialize', async (event) => {
    try {
      if (!offlineDb) throw new Error('Database not initialized');

      offlineDb.exec(`
        CREATE TABLE IF NOT EXISTS supplier (
          id_supplier INTEGER PRIMARY KEY,
          nama_supplier TEXT NOT NULL,
          alamat TEXT,
          telepon TEXT,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS purchases (
          id_pembelian INTEGER PRIMARY KEY,
          kode_pembelian TEXT UNIQUE,
          id_supplier INTEGER,
          id_cabang INTEGER,
          tanggal DATETIME,
          total REAL,
          status TEXT DEFAULT 'selesai',
          masuk_gudang INTEGER DEFAULT 0,
          catatan TEXT,
          id_user INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          synced INTEGER DEFAULT 0,
          sync_version INTEGER DEFAULT 0,
          FOREIGN KEY (id_supplier) REFERENCES supplier (id_supplier)
        );

        CREATE TABLE IF NOT EXISTS purchase_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_pembelian INTEGER,
          id_produk INTEGER,
          jumlah INTEGER,
          harga_beli REAL,
          subtotal REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_pembelian) REFERENCES purchases (id_pembelian),
          FOREIGN KEY (id_produk) REFERENCES products (id_produk)
        )
      `);

      try {
        const productColumns = offlineDb.prepare("PRAGMA table_info(products)").all();
        
        const productColumnChecks = [
          { name: 'merek', sql: 'ALTER TABLE products ADD COLUMN merek TEXT' },
          { name: 'lokasi_rak', sql: 'ALTER TABLE products ADD COLUMN lokasi_rak TEXT' },
          { name: 'harga_grosir', sql: 'ALTER TABLE products ADD COLUMN harga_grosir REAL DEFAULT 0.00' },
          { name: 'min_qty_grosir', sql: 'ALTER TABLE products ADD COLUMN min_qty_grosir INTEGER DEFAULT 0' },
          { name: 'deskripsi', sql: 'ALTER TABLE products ADD COLUMN deskripsi TEXT' },
          { name: 'foto_produk', sql: 'ALTER TABLE products ADD COLUMN foto_produk TEXT' }
        ];

        for (const check of productColumnChecks) {
          const hasColumn = productColumns.some(col => col.name === check.name);
          if (!hasColumn) {
            try {
              offlineDb.exec(check.sql);
            } catch (colError) {
              console.warn('Column already exists or migration failed:', check.name);
            }
          }
        }

        const salesColumns = offlineDb.prepare("PRAGMA table_info(sales)").all();
        const salesColumnChecks = [
          { name: 'total', sql: 'ALTER TABLE sales ADD COLUMN total REAL' },
          { name: 'status_pembayaran', sql: 'ALTER TABLE sales ADD COLUMN status_pembayaran TEXT' }
        ];

        for (const check of salesColumnChecks) {
          const hasColumn = salesColumns.some(col => col.name === check.name);
          if (!hasColumn) {
            try {
              offlineDb.exec(check.sql);
            } catch (colError) {
              console.warn('Column already exists or migration failed:', check.name);
            }
          }
        }

        const saleItemsColumns = offlineDb.prepare("PRAGMA table_info(sale_items)").all();
        const saleItemsColumnChecks = [
          { name: 'harga_satuan', sql: 'ALTER TABLE sale_items ADD COLUMN harga_satuan REAL DEFAULT 0' }
        ];

        for (const check of saleItemsColumnChecks) {
          const hasColumn = saleItemsColumns.some(col => col.name === check.name);
          if (!hasColumn) {
            try {
              offlineDb.exec(check.sql);
            } catch (colError) {
              console.warn('Column already exists or migration failed:', check.name);
            }
          }
        }
      } catch (migrationError) {
        console.warn('Migration check failed:', migrationError.message);
      }

      offlineDb.exec(`
        CREATE INDEX IF NOT EXISTS idx_products_kode ON products (kode_produk);
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
        CREATE INDEX IF NOT EXISTS idx_sales_kode_transaksi ON sales (kode_transaksi);
        CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);
        CREATE INDEX IF NOT EXISTS idx_sale_items_id_penjualan ON sale_items (id_penjualan);
        CREATE INDEX IF NOT EXISTS idx_payment_details_id_penjualan ON payment_details (id_penjualan);
        CREATE INDEX IF NOT EXISTS idx_purchases_kode ON purchases (kode_pembelian);
        CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases (created_at);
        CREATE INDEX IF NOT EXISTS idx_purchase_items_id_pembelian ON purchase_items (id_pembelian);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status);
        CREATE INDEX IF NOT EXISTS idx_customers_nama ON customers (nama_pelanggan);
        CREATE INDEX IF NOT EXISTS idx_customers_hp ON customers (nomor_hp);
      `);

      return {
        success: true,
        message: 'Database berhasil diinisialisasi ulang'
      };

    } catch (error) {
      console.error('Failed to reinitialize database:', error);
      throw error;
    }
  });

  // IPC handler for database backup (export)
  ipcMain.handle('db-backup', async (event) => {
    try {
      const Database = require('better-sqlite3');
      const path = require('path');
      const fs = require('fs');

      // Ensure database is initialized
      if (!offlineDb) {
        const dbPath = path.join(app.getPath('userData'), 'offline.db');
        offlineDb = new Database(dbPath);
        offlineDb.pragma('journal_mode = WAL');
        offlineDb.pragma('foreign_keys = OFF');
      }

      // Get current timestamp for filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const defaultFilename = `n-pos-backup-${timestamp}.db`;

      // Show save dialog
      const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
        title: 'Backup Database',
        defaultPath: defaultFilename,
        filters: [
          { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        return { success: false, message: 'Backup dibatalkan' };
      }

      // Close current database connection temporarily
      offlineDb.close();

      // Copy database file
      const dbPath = path.join(app.getPath('userData'), 'offline.db');
      await fs.promises.copyFile(dbPath, result.filePath);

      // Reopen database connection
      offlineDb = new Database(dbPath);
      offlineDb.pragma('journal_mode = WAL');

      return {
        success: true,
        message: `Database berhasil di-backup ke: ${result.filePath}`,
        filePath: result.filePath
      };

    } catch (error) {
      console.error('Failed to backup database:', error);

      // Try to reopen database if it was closed
      try {
        if (!offlineDb) {
          const Database = require('better-sqlite3');
          const dbPath = path.join(app.getPath('userData'), 'offline.db');
          offlineDb = new Database(dbPath);
          offlineDb.pragma('journal_mode = WAL');
        }
      } catch (reopenError) {
        console.error('Failed to reopen database:', reopenError);
      }

      return {
        success: false,
        message: `Gagal backup database: ${error.message}`
      };
    }
  });

  // IPC handler for database restore (import)
  ipcMain.handle('db-restore', async (event, options = {}) => {
    const { skipIntegrityCheck = false } = options;

    try {
      const Database = require('better-sqlite3');
      const path = require('path');

      // Show open dialog
      const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
        title: 'Restore Database',
        properties: ['openFile'],
        filters: [
          { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: 'Restore dibatalkan' };
      }

      const backupFilePath = result.filePaths[0];

      // Validate backup file exists
      if (!fs.existsSync(backupFilePath)) {
        throw new Error('File backup tidak ditemukan');
      }

      // Close current database connection
      if (offlineDb) {
        offlineDb.close();
      }

      // Backup current database as safety measure
      const dbPath = path.join(app.getPath('userData'), 'offline.db');
      const safetyBackupPath = `${dbPath}.safety-backup-${Date.now()}`;

      if (fs.existsSync(dbPath)) {
        await fs.promises.copyFile(dbPath, safetyBackupPath);
      }

      // Copy backup file to replace current database
      await fs.promises.copyFile(backupFilePath, dbPath);

      // Reopen database connection
      offlineDb = new Database(dbPath);
      offlineDb.pragma('journal_mode = WAL');

      // Test database integrity with multiple checks (skip if requested)
      if (!skipIntegrityCheck) {
        try {
          // Test 1: Basic connection test
          const basicTest = offlineDb.prepare('SELECT 1 as test');
          basicTest.get();

          // Test 2: Check if essential tables exist
          const tableCheck = offlineDb.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('products', 'sales', 'sync_metadata')
          `);
          const tables = tableCheck.all();

          if (tables.length < 2) {
            throw new Error(`Database missing essential tables. Found: ${tables.map(t => t.name).join(', ')}`);
          }
          
          // Test 3: Try a simple query on products table
          try {
            const productTest = offlineDb.prepare('SELECT COUNT(*) as count FROM products');
            const productCount = productTest.get();
          } catch (productError) {
            console.warn('⚠ Products table test failed, but continuing:', productError.message);
          }

        } catch (integrityError) {
          console.error('Database integrity check failed:', integrityError);

          // Restore from safety backup if available
          if (fs.existsSync(safetyBackupPath)) {
            offlineDb.close();
            await fs.promises.copyFile(safetyBackupPath, dbPath);
            offlineDb = new Database(dbPath);
            offlineDb.pragma('journal_mode = WAL');

            throw new Error(`Database dari file backup rusak atau tidak kompatibel (${integrityError.message}). Database asli telah dikembalikan.`);
          } else {
            throw new Error(`Database rusak setelah restore (${integrityError.message}). Tidak ada safety backup untuk dikembalikan.`);
          }
        }
      }

      // Clean up safety backup
      if (fs.existsSync(safetyBackupPath)) {
        try {
          fs.unlinkSync(safetyBackupPath);
        } catch (cleanupError) {
          console.warn('Failed to clean up safety backup:', cleanupError);
        }
      }

      return {
        success: true,
        message: `Database berhasil di-restore dari: ${backupFilePath}`,
        filePath: backupFilePath
      };

    } catch (error) {
      console.error('Failed to restore database:', error);

      // Try to reopen database if it was closed
      try {
        if (!offlineDb) {
          const Database = require('better-sqlite3');
          const dbPath = path.join(app.getPath('userData'), 'offline.db');
          offlineDb = new Database(dbPath);
          offlineDb.pragma('journal_mode = WAL');
        }
      } catch (reopenError) {
        console.error('Failed to reopen database:', reopenError);
      }

      return {
        success: false,
        message: `Gagal restore database: ${error.message}`
      };
    }
  });
}

// --- CASH DRAWER HANDLER (define BEFORE app.whenReady) ---
async function openCashDrawerInternal(config = {}) {
  let port = null;
  let timeoutId = null;

  try {

    // Default configuration
    const drawerConfig = {
      port: config.port || 'COM1', // Default COM port
      baudRate: config.baudRate || 9600,
      type: config.type || 'serial', // serial, thermal-printer, usb, network
      timeout: config.timeout || 5000,
      printerName: config.printerName || null, // For thermal-printer type
      ...config
    };

    if (drawerConfig.type === 'serial') {
      // Serial port implementation (existing)
      try {
        const { SerialPort } = require('serialport');

        // ESC/POS command to open cash drawer
        // ESC p m t1 t2
        // m = drawer number (0 or 1)
        // t1, t2 = pulse duration (usually 50ms)
        const openCommand = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);

        port = new SerialPort({
          path: drawerConfig.port,
          baudRate: drawerConfig.baudRate,
          autoOpen: false
        });

        return new Promise((resolve, reject) => {
          let isResolved = false;
          let isRejected = false;

          const cleanup = () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            if (port && port.isOpen) {
              try {
                port.close((closeErr) => {
                  if (closeErr) {
                    console.warn('Warning closing serial port during cleanup:', closeErr.message);
                  }
                });
              } catch (closeError) {
                console.warn('Error during port cleanup:', closeError.message);
              }
            }
          };

          const resolveOnce = (result) => {
            if (!isResolved && !isRejected) {
              isResolved = true;
              cleanup();
              resolve(result);
            }
          };

          const rejectOnce = (error) => {
            if (!isResolved && !isRejected) {
              isRejected = true;
              cleanup();
              reject(error);
            }
          };

          // Handle port open
          port.open((err) => {
            if (err) {
              console.error('Failed to open serial port:', err.message);
              let errorMessage = 'Tidak dapat membuka port serial';

              if (err.message.includes('ENOENT')) {
                errorMessage = `Port ${drawerConfig.port} tidak ditemukan. Periksa koneksi cash drawer.`;
              } else if (err.message.includes('EACCES')) {
                errorMessage = `Tidak ada akses ke port ${drawerConfig.port}. Jalankan aplikasi sebagai Administrator.`;
              } else if (err.message.includes('EBUSY')) {
                errorMessage = `Port ${drawerConfig.port} sedang digunakan aplikasi lain.`;
              } else {
                errorMessage = `Error membuka port ${drawerConfig.port}: ${err.message}`;
              }

              rejectOnce(new Error(errorMessage));
              return;
            }

            // Write the open command
            port.write(openCommand, (writeErr) => {
              if (writeErr) {
                console.error('Failed to write to serial port:', writeErr.message);
                rejectOnce(new Error(`Gagal mengirim command ke cash drawer: ${writeErr.message}`));
                return;
              }

              // Wait a bit for the drawer to open, then close port
              setTimeout(() => {
                if (port && port.isOpen) {
                  port.close((closeErr) => {
                    if (closeErr) {
                      console.warn('Warning closing serial port:', closeErr.message);
                      // Don't reject here, the command was sent successfully
                    }
                    resolveOnce({ success: true, message: 'Cash drawer berhasil dibuka' });
                  });
                } else {
                  // Port already closed or not available
                  resolveOnce({ success: true, message: 'Cash drawer berhasil dibuka' });
                }
              }, 500);
            });
          });

          // Handle port errors
          port.on('error', (portErr) => {
            console.error('Serial port error:', portErr.message);
            rejectOnce(new Error(`Error pada port serial: ${portErr.message}`));
          });

          // Timeout handler
          timeoutId = setTimeout(() => {
            console.warn('Cash drawer operation timeout');
            rejectOnce(new Error(`Timeout membuka cash drawer (${drawerConfig.timeout}ms). Periksa koneksi hardware.`));
          }, drawerConfig.timeout);

        });

      } catch (serialError) {
        console.error('Serial port implementation error:', serialError);

        let errorMessage = 'Error pada implementasi serial port';
        if (serialError.code === 'MODULE_NOT_FOUND') {
          errorMessage = 'Library serialport tidak terinstall. Jalankan: npm install serialport';
        } else {
          errorMessage = `Error implementasi serial: ${serialError.message}`;
        }

        throw new Error(errorMessage);
      }

    } else if (drawerConfig.type === 'thermal-printer') {
      // Thermal printer implementation - send command via QZ Tray
      try {
        if (!drawerConfig.printerName) {
          throw new Error('printerName diperlukan untuk tipe thermal-printer');
        }

        // ESC/POS command to open cash drawer
        // ESC p m t1 t2
        // m = drawer number (0 or 1)
        // t1, t2 = pulse duration (usually 50ms)
        const openCommand = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
        // Use thermal print service to send the command
        const thermalService = require('./thermalPrintService.cjs');
        const result = await thermalService.printThermal(drawerConfig.printerName, openCommand, {
          auto_cut: false, // Don't cut paper for drawer command
          timeout: drawerConfig.timeout
        });
        return {
          success: true,
          message: 'Cash drawer berhasil dibuka melalui thermal printer',
          method: 'thermal-printer',
          printer: drawerConfig.printerName
        };

      } catch (thermalError) {
        console.error('Thermal printer cash drawer error:', thermalError);

        let errorMessage = 'Gagal membuka cash drawer melalui thermal printer';
        if (thermalError.message.includes('tidak ditemukan')) {
          errorMessage = `Printer "${drawerConfig.printerName}" tidak ditemukan. Periksa konfigurasi printer.`;
        } else if (thermalError.message.includes('QZ Tray')) {
          errorMessage = 'QZ Tray tidak tersedia atau tidak terhubung. Pastikan QZ Tray berjalan.';
        } else {
          errorMessage = `Error thermal printer: ${thermalError.message}`;
        }

        throw new Error(errorMessage);
      }

    } else if (drawerConfig.type === 'usb') {
      // USB implementation (placeholder)
      throw new Error('USB cash drawer belum diimplementasikan. Gunakan tipe "serial" atau "thermal-printer".');

    } else if (drawerConfig.type === 'network') {
      // Network implementation (placeholder)
      throw new Error('Network cash drawer belum diimplementasikan. Gunakan tipe "serial" atau "thermal-printer".');

    } else {
      throw new Error(`Tipe cash drawer '${drawerConfig.type}' tidak didukung. Gunakan 'serial', 'thermal-printer', 'usb', atau 'network'.`);
    }

  } catch (error) {
    console.error('Cash drawer operation failed:', error);

    // Enhanced error messages for user
    let userMessage = 'Gagal mengoperasikan cash drawer';

    if (error.message.includes('Timeout')) {
      userMessage = 'Cash drawer tidak merespons. Periksa koneksi dan konfigurasi hardware.';
    } else if (error.message.includes('tidak ditemukan')) {
      userMessage = 'Port cash drawer tidak ditemukan. Periksa koneksi USB/serial.';
    } else if (error.message.includes('akses')) {
      userMessage = 'Tidak ada izin akses ke cash drawer. Jalankan aplikasi sebagai Administrator.';
    } else if (error.message.includes('digunakan')) {
      userMessage = 'Cash drawer sedang digunakan aplikasi lain. Tutup aplikasi lain terlebih dahulu.';
    } else if (error.message.includes('serialport tidak terinstall')) {
      userMessage = 'Library serialport tidak terinstall. Hubungi administrator sistem.';
    } else if (error.message.includes('QZ Tray')) {
      userMessage = 'QZ Tray tidak tersedia. Pastikan QZ Tray terinstall dan berjalan.';
    }

    throw new Error(`${userMessage} (Detail: ${error.message})`);
  }
}

// --- DATABASE VARIABLES (declare BEFORE app.whenReady) ---
let offlineDb;
let isDatabaseReady = false; // Flag to track database initialization
let productDatabase; // Make globally available for all IPC handlers

app.whenReady().then(async () => {
  // debug: confirm registered IPC handlers after setup is complete
  try {
    broadcastDebug('ipcMain handlers after whenReady', ipcMain.eventNames());
  } catch (e) {
    console.warn('Failed to broadcast ipcMain handlers after whenReady', e);
  }

  // Register cash drawer handler after app is ready
  ipcMain.handle('open-cash-drawer', async (event, config = {}) => {
    return await openCashDrawerInternal(config);
  });
  // Clear cache in production to avoid stale content
  if (!isDev) {
    try {

      const session = require('electron').session.defaultSession;
      if (session) {
        await session.clearCache();

      }
    } catch (err) {
      console.warn('⚠️ Could not clear cache:', err.message);
    }
  }

  // Initialize offline database
  try {
    let Database;
    try {
      Database = require('better-sqlite3');
    } catch (dbModuleError) {
      console.error('[DB INIT] Failed to load better-sqlite3:', dbModuleError.message);
      console.error('[DB INIT] This is NODE_MODULE_VERSION mismatch (compiled for 127, need 140)');
      throw dbModuleError;
    }
    
    const fs = require('fs');
    const dbPath = path.join(app.getPath('userData'), 'offline.db');
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    offlineDb = new Database(dbPath);
    offlineDb.pragma('journal_mode = WAL');
    offlineDb.pragma('foreign_keys = OFF');
    // Create tables if they don't exist (don't drop existing tables)
    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id_kategori INTEGER PRIMARY KEY,
        nama_kategori TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS units (
        id_satuan INTEGER PRIMARY KEY,
        nama_satuan TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS customers (
        id_pelanggan INTEGER PRIMARY KEY,
        nama_pelanggan TEXT NOT NULL,
        nomor_hp TEXT,
        email TEXT,
        alamat TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 0
      );
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id_produk INTEGER PRIMARY KEY,
        kode_produk TEXT NOT NULL,
        nama_produk TEXT NOT NULL,
        id_kategori INTEGER,
        id_satuan INTEGER,
        harga_beli REAL NOT NULL DEFAULT 0.00,
        harga_jual REAL NOT NULL DEFAULT 0.00,
        harga_grosir REAL DEFAULT 0.00,
        min_qty_grosir INTEGER DEFAULT 0,
        stok_minimum INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'aktif',
        gambar TEXT,
        barcode TEXT UNIQUE,
        merek TEXT,
        lokasi_rak TEXT,
        deskripsi TEXT,
        foto_produk TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 0
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS sales (
        id_penjualan INTEGER PRIMARY KEY,
        kode_transaksi TEXT UNIQUE,
        id_cabang INTEGER,
        id_pelanggan INTEGER,
        tanggal DATETIME,
        total REAL,
        total_sebelum_pajak REAL DEFAULT 0.00,
        jumlah_pajak REAL DEFAULT 0.00,
        jumlah_diskon REAL DEFAULT 0.00,
        diskon_dari_admin REAL DEFAULT 0.00,
        diskon_dari_pelanggan REAL DEFAULT 0.00,
        kode_voucher TEXT,
        id_metode_pembayaran_utama INTEGER,
        diskon_voucher REAL DEFAULT 0.00,
        poin_loyalty_digunakan INTEGER DEFAULT 0,
        poin_loyalty_diperoleh INTEGER DEFAULT 0,
        status_pembayaran TEXT DEFAULT 'lunas',
        catatan TEXT,
        bayar REAL,
        kembalian REAL,
        sisa_pembayaran REAL DEFAULT 0.00,
        tipe_penjualan TEXT DEFAULT 'retail',
        id_user INTEGER,
        dibatalkan_oleh INTEGER,
        alasan_pembatalan TEXT,
        is_void INTEGER DEFAULT 0,
        void_at DATETIME,
        void_reason TEXT,
        voided_by INTEGER,
        reversal_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 0
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_penjualan INTEGER,
        id_produk INTEGER,
        harga_jual REAL,
        harga_satuan REAL DEFAULT 0,
        jumlah INTEGER,
        subtotal REAL,
        diskon_item REAL DEFAULT 0,
        pajak_item REAL DEFAULT 0,
        tipe_harga TEXT DEFAULT 'eceran',
        harga_produk REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 1
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS payment_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_penjualan INTEGER,
        id_metode_pembayaran INTEGER,
        jumlah_bayar REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 1
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER,
        operation TEXT NOT NULL,
        data TEXT,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 0,
        server_id INTEGER,
        server_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS metode_pembayaran (
        id_metode INTEGER PRIMARY KEY,
        kode_metode TEXT,
        nama_metode TEXT NOT NULL,
        tipe_metode TEXT,
        aktif INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        urutan_tampil INTEGER,
        biaya_tambahan_persen REAL DEFAULT 0,
        biaya_tambahan_nominal REAL DEFAULT 0,
        minimum_transaksi REAL,
        maksimum_transaksi REAL,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS supplier (
        id_supplier INTEGER PRIMARY KEY,
        nama_supplier TEXT NOT NULL,
        alamat TEXT,
        telepon TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 0
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        id_pembelian INTEGER PRIMARY KEY,
        kode_pembelian TEXT UNIQUE,
        id_supplier INTEGER,
        id_cabang INTEGER,
        tanggal DATETIME,
        total REAL,
        status TEXT DEFAULT 'selesai',
        masuk_gudang INTEGER DEFAULT 0,
        catatan TEXT,
        id_user INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 0
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_pembelian INTEGER,
        id_produk INTEGER,
        jumlah INTEGER,
        harga_beli REAL,
        subtotal REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_pembelian) REFERENCES purchases (id_pembelian)
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS warehouse_stock (
        id_produk INTEGER NOT NULL,
        id_cabang INTEGER,
        jumlah INTEGER DEFAULT 0,
        stok_minimum INTEGER DEFAULT 0,
        lokasi_rak TEXT,
        nama_produk TEXT,
        kode_produk TEXT,
        nama_kategori TEXT,
        id_kategori INTEGER,
        harga_beli REAL DEFAULT 0,
        harga_jual REAL DEFAULT 0,
        harga_grosir REAL DEFAULT 0,
        min_qty_grosir INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id_produk, id_cabang)
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS tax_rates (
        id_pajak INTEGER PRIMARY KEY,
        kode_pajak TEXT NOT NULL UNIQUE,
        nama_pajak TEXT NOT NULL,
        persentase REAL NOT NULL DEFAULT 0,
        deskripsi TEXT,
        aktif INTEGER DEFAULT 1,
        tipe_pajak TEXT DEFAULT 'penjualan',
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS discounts (
        id_diskon INTEGER PRIMARY KEY,
        kode_diskon TEXT NOT NULL UNIQUE,
        nama_diskon TEXT NOT NULL,
        tipe_diskon TEXT NOT NULL,
        nilai_diskon REAL NOT NULL,
        minimum_transaksi REAL DEFAULT 0,
        maksimum_transaksi REAL,
        tanggal_mulai DATETIME,
        tanggal_selesai DATETIME,
        aktif INTEGER DEFAULT 1,
        dapat_dikombinasi INTEGER DEFAULT 0,
        deskripsi TEXT,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        kunci_setting TEXT PRIMARY KEY,
        nilai_setting TEXT,
        tipe_data TEXT DEFAULT 'string',
        kategori TEXT DEFAULT 'general',
        deskripsi TEXT,
        dapat_diedit INTEGER DEFAULT 1,
        synced INTEGER DEFAULT 0,
        sync_version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create branches table if it does not exist
    offlineDb.exec(`
      CREATE TABLE IF NOT EXISTS branches (
        id_cabang INTEGER PRIMARY KEY,
        kode_cabang TEXT NOT NULL,
        nama_cabang TEXT,
        alamat TEXT,
        kota TEXT,
        no_telp TEXT,
        status TEXT DEFAULT 'aktif',
        tipe_katalog TEXT DEFAULT 'global',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      // Check if branches columns exist
      const branchesColumns = offlineDb.prepare("PRAGMA table_info(branches)").all();
      const hasTipeKatalog = branchesColumns.some(col => col.name === 'tipe_katalog');
      if (!hasTipeKatalog) {
        offlineDb.exec(`ALTER TABLE branches ADD COLUMN tipe_katalog TEXT DEFAULT 'global'`);
      }

      // Check if merek column exists in products table
      const productColumns = offlineDb.prepare("PRAGMA table_info(products)").all();
      
      // Check if id_cabang_pemilik exists in products
      const hasIdCabangPemilik = productColumns.some(col => col.name === 'id_cabang_pemilik');
      if (!hasIdCabangPemilik) {
        offlineDb.exec(`ALTER TABLE products ADD COLUMN id_cabang_pemilik INTEGER NULL`);
      }

      // Check if urutan exists in products
      const hasUrutan = productColumns.some(col => col.name === 'urutan');
      if (!hasUrutan) {
        offlineDb.exec(`ALTER TABLE products ADD COLUMN urutan INTEGER DEFAULT 0`);
      }

      const hasMerek = productColumns.some(col => col.name === 'merek');
      if (!hasMerek) {
        offlineDb.exec(`ALTER TABLE products ADD COLUMN merek TEXT`);
      }

      // Check if lokasi_rak column exists in products table
      const hasLokasiRak = productColumns.some(col => col.name === 'lokasi_rak');
      if (!hasLokasiRak) {
        offlineDb.exec(`ALTER TABLE products ADD COLUMN lokasi_rak TEXT`);

      }

      // Check if harga_grosir column exists in products table
      const hasHargaGrosir = productColumns.some(col => col.name === 'harga_grosir');
      if (!hasHargaGrosir) {
        offlineDb.exec(`ALTER TABLE products ADD COLUMN harga_grosir REAL DEFAULT 0.00`);

      }

      // Check if min_qty_grosir column exists in products table
      const hasMinQtyGrosir = productColumns.some(col => col.name === 'min_qty_grosir');
      if (!hasMinQtyGrosir) {
        offlineDb.exec(`ALTER TABLE products ADD COLUMN min_qty_grosir INTEGER DEFAULT 0`);

      }

      // Check if harga_satuan column exists in sale_items table
      const saleItemsColumns = offlineDb.prepare("PRAGMA table_info(sale_items)").all();
      const hasHargaSatuan = saleItemsColumns.some(col => col.name === 'harga_satuan');
      if (!hasHargaSatuan) {
        offlineDb.exec(`ALTER TABLE sale_items ADD COLUMN harga_satuan REAL DEFAULT 0`);

      }

      // Check if diskon_item column exists in sale_items table
      const hasDiskonItem = saleItemsColumns.some(col => col.name === 'diskon_item');
      if (!hasDiskonItem) {
        offlineDb.exec(`ALTER TABLE sale_items ADD COLUMN diskon_item REAL DEFAULT 0`);

      }

      // Check if pajak_item column exists in sale_items table
      const hasPajakItem = saleItemsColumns.some(col => col.name === 'pajak_item');
      if (!hasPajakItem) {
        offlineDb.exec(`ALTER TABLE sale_items ADD COLUMN pajak_item REAL DEFAULT 0`);

      }

      // Check if synced column exists in sale_items table
      const hasSynced = saleItemsColumns.some(col => col.name === 'synced');
      if (!hasSynced) {
        offlineDb.exec(`ALTER TABLE sale_items ADD COLUMN synced INTEGER DEFAULT 0`);

      }

      // Check if sync_version column exists in sale_items table
      const hasSyncVersion = saleItemsColumns.some(col => col.name === 'sync_version');
      if (!hasSyncVersion) {
        offlineDb.exec(`ALTER TABLE sale_items ADD COLUMN sync_version INTEGER DEFAULT 1`);

      }

      // Check if synced column exists in payment_details table
      const paymentColumns = offlineDb.prepare("PRAGMA table_info(payment_details)").all();
      const hasPaymentSynced = paymentColumns.some(col => col.name === 'synced');
      if (!hasPaymentSynced) {
        offlineDb.exec(`ALTER TABLE payment_details ADD COLUMN synced INTEGER DEFAULT 0`);

      }

      // Check if sync_version column exists in payment_details table
      const hasPaymentSyncVersion = paymentColumns.some(col => col.name === 'sync_version');
      if (!hasPaymentSyncVersion) {
        offlineDb.exec(`ALTER TABLE payment_details ADD COLUMN sync_version INTEGER DEFAULT 1`);

      }

      // Check if sync_version column exists in sync_queue table
      const syncQueueColumns = offlineDb.prepare("PRAGMA table_info(sync_queue)").all();
      const hasSyncQueueSyncVersion = syncQueueColumns.some(col => col.name === 'sync_version');
      if (!hasSyncQueueSyncVersion) {
        offlineDb.exec(`ALTER TABLE sync_queue ADD COLUMN sync_version INTEGER DEFAULT 0`);
      }

      // Check if retry_count column exists in sync_queue table
      const hasRetryCount = syncQueueColumns.some(col => col.name === 'retry_count');
      if (!hasRetryCount) {
        offlineDb.exec(`ALTER TABLE sync_queue ADD COLUMN retry_count INTEGER DEFAULT 0`);
      }

      // Check if server_id column exists in sync_queue table
      const hasServerId = syncQueueColumns.some(col => col.name === 'server_id');
      if (!hasServerId) {
        offlineDb.exec(`ALTER TABLE sync_queue ADD COLUMN server_id INTEGER`);
      }

      // Check if void-related columns exist in sales table
      const salesColumns = offlineDb.prepare("PRAGMA table_info(sales)").all();
      const hasIsVoid = salesColumns.some(col => col.name === 'is_void');
      if (!hasIsVoid) {
        offlineDb.exec(`ALTER TABLE sales ADD COLUMN is_void INTEGER DEFAULT 0`);

      }

      const hasVoidAt = salesColumns.some(col => col.name === 'void_at');
      if (!hasVoidAt) {
        offlineDb.exec(`ALTER TABLE sales ADD COLUMN void_at DATETIME`);

      }

      const hasVoidReason = salesColumns.some(col => col.name === 'void_reason');
      if (!hasVoidReason) {
        offlineDb.exec(`ALTER TABLE sales ADD COLUMN void_reason TEXT`);

      }

      const hasVoidedBy = salesColumns.some(col => col.name === 'voided_by');
      if (!hasVoidedBy) {
        offlineDb.exec(`ALTER TABLE sales ADD COLUMN voided_by INTEGER`);

      }

      const hasReversalId = salesColumns.some(col => col.name === 'reversal_id');
      if (!hasReversalId) {
        offlineDb.exec(`ALTER TABLE sales ADD COLUMN reversal_id INTEGER`);

      }

      const hasIdCabang = salesColumns.some(col => col.name === 'id_cabang');
      if (!hasIdCabang) {
        offlineDb.exec(`ALTER TABLE sales ADD COLUMN id_cabang INTEGER`);

      }

      const hasTanggal = salesColumns.some(col => col.name === 'tanggal');
      if (!hasTanggal) {
        offlineDb.exec(`ALTER TABLE sales ADD COLUMN tanggal DATETIME`);

      }

      // Check if tipe_harga and harga_produk columns exist in sale_items table
      const saleItemsColumnsForPricing = offlineDb.prepare("PRAGMA table_info(sale_items)").all();
      const hasTipeHarga = saleItemsColumnsForPricing.some(col => col.name === 'tipe_harga');
      if (!hasTipeHarga) {
        offlineDb.exec(`ALTER TABLE sale_items ADD COLUMN tipe_harga TEXT DEFAULT 'eceran'`);

      }

      const hasHargaProduk = saleItemsColumnsForPricing.some(col => col.name === 'harga_produk');
      if (!hasHargaProduk) {
        offlineDb.exec(`ALTER TABLE sale_items ADD COLUMN harga_produk REAL`);

      }

      // Check if konfigurasi column exists in metode_pembayaran table
      const metodeColumns = offlineDb.prepare("PRAGMA table_info(metode_pembayaran)").all();
      const hasKonfigurasi = metodeColumns.some(col => col.name === 'konfigurasi');
      if (!hasKonfigurasi) {
        offlineDb.exec(`ALTER TABLE metode_pembayaran ADD COLUMN konfigurasi TEXT`);

      }
    } catch (migrationError) {
    }
    // Create indexes for better performance
    offlineDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_products_kode ON products (kode_produk);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
      CREATE INDEX IF NOT EXISTS idx_sales_kode_transaksi ON sales (kode_transaksi);
      CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales (created_at);
      CREATE INDEX IF NOT EXISTS idx_sale_items_id_penjualan ON sale_items (id_penjualan);
      CREATE INDEX IF NOT EXISTS idx_payment_details_id_penjualan ON payment_details (id_penjualan);
      CREATE INDEX IF NOT EXISTS idx_purchases_kode ON purchases (kode_pembelian);
      CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases (created_at);
      CREATE INDEX IF NOT EXISTS idx_purchase_items_id_pembelian ON purchase_items (id_pembelian);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status);
      CREATE INDEX IF NOT EXISTS idx_customers_nama ON customers (nama_pelanggan);
      CREATE INDEX IF NOT EXISTS idx_customers_hp ON customers (nomor_hp);
    `);
    // ⭐ PROACTIVE SCHEMA VALIDATION - Fix missing columns before any inserts
    try {
      const requiredSalesColumns = {
        id_penjualan: 'INTEGER',
        kode_transaksi: 'TEXT',
        id_cabang: 'INTEGER',
        id_pelanggan: 'INTEGER',
        id_user: 'INTEGER',
        tanggal: 'DATETIME',
        total: 'REAL',
        total_diskon: 'REAL',
        pajak: 'REAL',
        metode_pembayaran: 'TEXT',
        status: 'TEXT',
        status_pembayaran: 'TEXT',
        catatan: 'TEXT',
        tanggal_transaksi: 'DATETIME',
        created_at: 'DATETIME',
        updated_at: 'DATETIME',
        synced: 'INTEGER',
        sync_version: 'INTEGER'
      };

      const salesColumns = offlineDb.prepare("PRAGMA table_info(sales)").all();
      const existingColumnNames = salesColumns.map(col => col.name);

      for (const [columnName, columnType] of Object.entries(requiredSalesColumns)) {
        if (!existingColumnNames.includes(columnName)) {
          try {
            offlineDb.exec(`ALTER TABLE sales ADD COLUMN ${columnName} ${columnType}`);
          } catch (colErr) {
            // If we get "duplicate column name" error, it means it was just added by another check
            if (colErr.message && colErr.message.includes('duplicate column name')) {
            } else {
              console.warn(`  ⚠️  Could not add column ${columnName}: ${colErr.message}`);
            }
          }
        }
      }
    } catch (schemaErr) {
      console.error('[DB INIT] Schema validation error:', schemaErr.message);
    }

    // Recover incomplete syncs from previous crashes
    const syncingItems = offlineDb.prepare(`
      SELECT id FROM sync_queue WHERE status = 'syncing'
    `).all();
    if (syncingItems.length > 0) {
      const resetStmt = offlineDb.prepare(`
        UPDATE sync_queue SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `);
      syncingItems.forEach(item => {
        resetStmt.run(item.id);
      });
    }

    // Initialize product database (moved here from app.on('ready') to ensure it's ready before React starts)
    try {
      productDatabase = require('./productDatabase.cjs');
      productDatabase.initialize();
    } catch (productDbError) {
      console.error('⚠️ ProductDatabase initialization failed, but continuing with offlineDb:', productDbError.message);
      console.error('[DB INIT] Full ProductDatabase error:', productDbError);
      productDatabase = null;
      // Don't throw - let app continue with offlineDb
    }

    // Mark databases as ready after offlineDb and productDatabase initialization attempts
    isDatabaseReady = true;
    // Run database corruption recovery check
    if (offlineDb) {
      try {
        const recoveryResults = runDatabaseCorruptionRecovery(offlineDb);
        if (!recoveryResults.success) {
          console.error('[DB RECOVERY] Failed:', recoveryResults.error);
        }
      } catch (recoveryErr) {
        console.error('[DB RECOVERY] Unexpected error:', recoveryErr.message);
      }
    }

    // NOW REGISTER DATABASE IPC HANDLERS - must happen after database initialization but before window is created
    registerDatabaseHandlers();

    // ✅ Final schema verification - ensure status_pembayaran exists
    if (offlineDb) {
      try {
        const salesCols = offlineDb.prepare("PRAGMA table_info(sales)").all();
        const hasTotalCol = salesCols.some(col => col.name === 'total');
        const hasStatusPembayaranCol = salesCols.some(col => col.name === 'status_pembayaran');
        
        if (!hasTotalCol) {
          console.warn('[DB VERIFY] 🔧 Adding missing total column to sales...');
          offlineDb.exec('ALTER TABLE sales ADD COLUMN total REAL');
        }
        
        if (!hasStatusPembayaranCol) {
          console.warn('[DB VERIFY] 🔧 Adding missing status_pembayaran column to sales...');
          offlineDb.exec('ALTER TABLE sales ADD COLUMN status_pembayaran TEXT');
        }
        
        if (hasTotalCol && hasStatusPembayaranCol) {
        }
      } catch (verifyErr) {
        console.error('[DB VERIFY] ⚠️ Verification error:', verifyErr.message);
      }
    }

  } catch (error) {
    console.error('❌ Fatal: Failed to initialize offlineDb:', error);
    console.error('[DB INIT] This is likely due to better-sqlite3 native module version mismatch.');
    console.error('[DB INIT] Error will crash databases but app will continue without offline storage.');
    isDatabaseReady = false; // Ensure flag is false if offlineDb initialization fails
  }

  // FALLBACK: Set isDatabaseReady to true after a delay even if both databases failed
  // This allows the app to continue running without offline data storage
  // Users can still use the app in connected mode
  if (!isDatabaseReady) {
    console.warn('[DB INIT] Setting isDatabaseReady = true anyway to allow app to continue...');
    console.warn('[DB INIT] Note: Offline features will be unavailable until better-sqlite3 is fixed.');
    console.warn('[DB INIT] To fix: Install Visual Studio Build Tools or use sql.js instead of better-sqlite3');
    isDatabaseReady = true;
    // Still need to register handlers even if database initialization failed
    registerDatabaseHandlers();
  }


  // Pre-populate the global port map with WMIC results so that CLI and
  // renderer print calls don't have to run WMIC themselves (which has been
  // timing out on this machine).  If WMIC fails we simply log and continue;
  // the lookupPortForPrinter helper will still attempt on-demand.
  (function warmPortMap() {
    if (os.platform() !== 'win32') return;
    try {
      const raw = execSync('wmic printer get Name,PortName /format:csv', {
        encoding: 'utf8',
        timeout: 5000
      });
      const map = {};
      raw.split(/\r?\n/).forEach(line => {
        const parts = line.split(',').map(p => p.trim()).filter(p => p);
        // Format: "HOSTNAME,PrinterName,PortName" or "PrinterName,PortName"
        // We need at least printer name and port
        if (parts.length >= 2) {
          // If we have hostname (3 parts), extract last 2; otherwise use as-is
          const name = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
          const port = parts.length >= 3 ? parts[parts.length - 1] : parts[1];
          if (name && port && name !== 'Name' && port !== 'PortName') {
            map[name] = port;
          }
        }
      });
      global.lastPrinterPortMap = map;
      broadcastDebug('WMIC warm port map', { portMap: map });
    } catch (err) {
      broadcastDebug('WMIC warm-up failed', { message: err.message });
    }
  })();

  // If the app was launched with --print-test, perform a one-off print and
  // exit.  This lets developers exercise the printing code path from the
  // command line without loading the full UI.
  if (process.argv.includes('--print-test')) {
    const idx = process.argv.indexOf('--print-test');
    const targetPrinter = process.argv[idx + 1] || '';
    broadcastDebug('cli print-test', targetPrinter);
    try {
      // use minimal printData so performPrintReceipt can validate it
      await performPrintReceipt(targetPrinter, [{ type: 'text', value: 'DEBUG PRINT' }]);
    } catch (err) {
      console.error('🖨️ [MAIN] CLI test print failed', err);
    }
    app.quit();
    return; // skip opening UI
  }

  createWindow();

  // Broadcast database ready status to renderer after a short delay (ensures window is ready)
  setTimeout(() => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('database-ready', { ready: isDatabaseReady });
    }
  }, 500);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // listen for forwarded console messages from renderer
  ipcMain.on('renderer-console', (event, level, ...args) => {
    try {
      // prefix so it's easy to spot
      console[level]('[RENDERER]', ...args);
    } catch (_) {
    }
  });
});
  app.whenReady().then(() => {
      // Auto-test removed: old printHelper functions no longer exist
      // Printer testing now handled via UniversalPrintModal in frontend
    });

// previous stray closing brace removed above; this is the start of the
// standard window-all-closed handler that should be at top level.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS FOR PRINTING ---

// Raw print service for sending ESC/POS bytes directly to thermal printers
const rawPrintService = {
  async printRawBytes(printerName, buffer) {
    if (os.platform() !== 'win32') {
      throw new Error('Raw printing is only supported on Windows');
    }

    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Buffer must be a Buffer instance');
    }

    broadcastDebug('Raw print service called', { printerName, bufferLength: buffer.length });

    // Save buffer to temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `raw_print_${Date.now()}.bin`);
    fs.writeFileSync(tempFile, buffer);
    broadcastDebug('Saved raw buffer to temp file', tempFile);

    try {
      // Method 1: Try direct port write (most reliable for thermal printers)
      const port = lookupPortForPrinter(printerName);
      if (port) {
        broadcastDebug('Attempting direct port write', port);
        try {
          // Use simple copy command for direct port access
          execSync(`copy /B "${tempFile}" ${port}`, { stdio: 'pipe', timeout: 10000 });
          broadcastDebug('✅ Raw print successful via direct port');
          return { success: true, method: 'direct-port' };
        } catch (portErr) {
          broadcastDebug('❌ Direct port write failed', portErr.message);
          // Check for specific port-related errors
          if (portErr.message.includes('Access is denied') || portErr.message.includes('access denied')) {
            throw new Error('Tidak ada izin akses ke port printer. Jalankan aplikasi sebagai Administrator.');
          }
          if (portErr.message.includes('The system cannot find the path') || portErr.message.includes('path specified')) {
            throw new Error(`Port printer "${port}" tidak ditemukan. Periksa koneksi printer di Device Manager.`);
          }
          if (portErr.message.includes('The device is not ready') || portErr.message.includes('device not ready')) {
            throw new Error('Printer tidak siap atau sedang offline. Periksa status printer.');
          }
          throw portErr;
        }
      }

      // Method 2: Try PowerShell Out-Printer
      try {
        broadcastDebug('Attempting PowerShell Out-Printer method');
        const psCmd = `
          $bytes = [System.IO.File]::ReadAllBytes('${tempFile}')
          $bytes | Out-Printer -Name '${printerName}'
        `;
        execSync(`powershell -Command "${psCmd}"`, { stdio: 'pipe', timeout: 15000 });
        broadcastDebug('✅ Raw print successful via PowerShell Out-Printer');
        return { success: true, method: 'powershell-out-printer' };
      } catch (psErr) {
        broadcastDebug('❌ PowerShell Out-Printer failed', psErr.message);
        // Check for PowerShell-specific errors
        if (psErr.message.includes('Access is denied') || psErr.message.includes('access denied')) {
          throw new Error('PowerShell tidak memiliki izin akses printer. Jalankan aplikasi sebagai Administrator.');
        }
        if (psErr.message.includes('printer name') && psErr.message.includes('not found')) {
          throw new Error(`Printer "${printerName}" tidak ditemukan di sistem. Periksa nama printer di pengaturan Windows.`);
        }
        throw psErr;
      }

      // Method 3: Try Windows PrintTo verb as final fallback
      try {
        broadcastDebug('Attempting Windows PrintTo fallback');
        const printCmd = `powershell -Command "Start-Process -FilePath '${tempFile}' -Verb PrintTo -ArgumentList '${printerName}' -WindowStyle Hidden"`;
        execSync(printCmd, { stdio: 'pipe', timeout: 15000 });
        broadcastDebug('✅ Raw print successful via Windows PrintTo');
        return { success: true, method: 'windows-printto' };
      } catch (printToErr) {
        broadcastDebug('❌ Windows PrintTo fallback failed', printToErr.message);
        // Check for PrintTo-specific errors
        if (printToErr.message.includes('not found') || printToErr.message.includes('cannot find')) {
          throw new Error(`Printer "${printerName}" tidak dapat diakses. Periksa koneksi dan status printer.`);
        }
        throw printToErr;
      }

      throw new Error(`All raw printing methods failed. Last error: ${psErr?.message || portErr?.message || printToErr?.message}

🔧 Troubleshooting Tips:
• Pastikan printer terhubung dan menyala
• Periksa kertas printer tidak habis
• Jalankan aplikasi sebagai Administrator
• Periksa driver printer di Device Manager
• Coba restart printer dan komputer
• Pastikan printer tidak digunakan aplikasi lain`);
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupErr) {
        console.warn('Failed to cleanup temp file:', cleanupErr.message);
      }
    }
  }
};

// QZ Tray helper functions
function loadQzTrayCertificate() {
  const fs = require('fs');
  const path = require('path');

  // For ASAR-bundled apps, app.getAppPath() returns the app.asar root
  // For development, it returns the project root
  const appPath = app.getAppPath();

  const certPaths = [
    path.join(getWritableCertDir(), 'digital-certificate.txt'),
    // ASAR-bundled: app.asar is a file, but fs can read from within it
    path.join(appPath, 'certs', 'digital-certificate.txt'),
    // Fallback for development (one level up from electron/)
    path.join(__dirname, '..', 'certs', 'digital-certificate.txt'),
    // Process resources path (sometimes certs are copied here)
    path.join(process.resourcesPath, 'certs', 'digital-certificate.txt'),
    // Fallback: same directory as main.cjs
    path.join(__dirname, 'digital-certificate.txt'),
    // Last resort: project working directory
    path.join(process.cwd(), 'certs', 'digital-certificate.txt')
  ];

  for (const certPath of certPaths) {
    try {
      if (fs.existsSync(certPath)) {
        const cert = fs.readFileSync(certPath, 'utf8').trim();
        if (isValidQzTrayCertificate(cert)) {
          qzTrayDebug('Certificate loaded from', { certPath });
          return cert;
        }
      }
    } catch (err) {
      qzTrayWarn('Failed to load certificate from', { certPath, error: err.message });
    }
  }

  qzTrayWarn('No valid QZ Tray certificate found');
  return '';
}

function loadQzTrayPrivateKey() {
  const fs = require('fs');
  const path = require('path');

  // For ASAR-bundled apps, app.getAppPath() returns the app.asar root
  // For development, it returns the project root
  const appPath = app.getAppPath();

  const keyPaths = [
    path.join(getWritableCertDir(), 'digital-certificate-key.txt'),
    // ASAR-bundled: app.asar is a file, but fs can read from within it
    path.join(appPath, 'certs', 'digital-certificate-key.txt'),
    // Fallback for development (one level up from electron/)
    path.join(__dirname, '..', 'certs', 'digital-certificate-key.txt'),
    // Process resources path (sometimes certs are copied here)
    path.join(process.resourcesPath, 'certs', 'digital-certificate-key.txt'),
    // Fallback: same directory as main.cjs
    path.join(__dirname, 'digital-certificate-key.txt'),
    // Last resort: project working directory
    path.join(process.cwd(), 'certs', 'digital-certificate-key.txt')
  ];

  for (const keyPath of keyPaths) {
    try {
      if (fs.existsSync(keyPath)) {
        const key = fs.readFileSync(keyPath, 'utf8').trim();
        if (isValidQzTrayPrivateKey(key)) {
          qzTrayDebug('Private key loaded from', { keyPath });
          return key;
        }
      }
    } catch (err) {
      qzTrayWarn('Failed to load private key from', { keyPath, error: err.message });
    }
  }

  qzTrayWarn('No valid QZ Tray private key found');
  return '';
}

async function setupQzTraySecurity(qz) {
  if (!qz || !qz.security) {
    throw new Error('QZ Tray security object not available');
  }

  const certificate = loadQzTrayCertificate();
  const privateKey = loadQzTrayPrivateKey();

  if (!isValidQzTrayCertificate(certificate)) {
    throw new Error('QZ Tray certificate tidak ditemukan atau tidak valid. Buat atau impor sertifikat di Settings.');
  }

  if (!isValidQzTrayPrivateKey(privateKey)) {
    throw new Error('QZ Tray private key tidak ditemukan atau tidak valid. Generate sertifikat baru di Settings.');
  }

  try {
    if (typeof qz.security.setCertificatePromise === 'function') {
      qz.security.setCertificatePromise(function (resolve, reject) {
        if (!certificate || certificate.length === 0) {
          return reject(new Error('QZ Tray certificate is empty'));
        }
        resolve(certificate);
      }, { rejectOnFailure: true });
    }
  } catch (err) {
    throw new Error(`QZ Tray certificate promise setup failed: ${err.message}`);
  }

  try {
    if (typeof qz.security.setSignaturePromise === 'function') {
      qz.security.setSignaturePromise(function (dataToSign) {
        return function (resolve, reject) {
          const key = loadQzTrayPrivateKey();
          if (!isValidQzTrayPrivateKey(key)) {
            return reject(new Error('QZ Tray private key not found or invalid'));
          }

          try {
            const crypto = require('crypto');
            const signer = crypto.createSign('SHA256');
            const payload = typeof dataToSign === 'string' ? dataToSign : JSON.stringify(dataToSign);
            signer.update(payload);
            signer.end();
            const signature = signer.sign(key, 'base64');
            resolve(signature);
          } catch (err) {
            reject(err);
          }
        };
      });
      if (typeof qz.security.setSignatureAlgorithm === 'function') {
        qz.security.setSignatureAlgorithm('SHA256');
      }
    }
  } catch (err) {
    throw new Error(`QZ Tray signature promise setup failed: ${err.message}`);
  }
}

async function connectQzTray(qz) {
  if (!qz || !qz.websocket || typeof qz.websocket.connect !== 'function') {
    throw new Error('QZ Tray websocket API tidak tersedia');
  }

  if (typeof qz.websocket.isActive === 'function' && qz.websocket.isActive()) {
    qzTrayDebug('Websocket already active, skipping connect');
    return;
  }

  const candidatePorts = [8182, 8181];
  const MAX_ATTEMPTS_PER_PORT = 4;

  for (const port of candidatePorts) {
    let attempt = 0;
    while (attempt < MAX_ATTEMPTS_PER_PORT) {
      attempt += 1;
      try {
        await qz.websocket.connect({ host: 'localhost', port, retries: 0, delay: 0 });
        qzTrayDebug('Websocket connected on port', { port });
        return;
      } catch (connectErr) {
        const message = String(connectErr?.message || connectErr || '');

        if (message.includes('An open connection with QZ Tray already exists')) {
          qzTrayDebug('Websocket already connected, continuing with existing connection');
          return;
        }

        if (typeof qz.websocket.isActive === 'function' && qz.websocket.isActive()) {
          qzTrayDebug('Websocket became active after connect attempt');
          return;
        }

        if (message.includes('current connection attempt has not returned yet') || message.includes("Cannot read properties of undefined (reading 'length')")) {
          qzTrayWarn('Connection pending, retrying after short delay', { port, attempt, message });
          await new Promise(resolve => setTimeout(resolve, 400));
          continue;
        }

        qzTrayWarn('Connect failed on port', { port, attempt, message });
        break;
      }
    }
  }

  if (typeof qz.websocket.isActive === 'function' && qz.websocket.isActive()) {
    qzTrayDebug('Websocket already active after port attempts');
    return;
  }

  try {
    await qz.websocket.connect();
    qzTrayDebug('Websocket connected using default settings');
    return;
  } catch (connectErr) {
    const message = String(connectErr?.message || connectErr || '');
    if (message.includes('An open connection with QZ Tray already exists')) {
      qzTrayDebug('Websocket already connected using default settings');
      return;
    }
    throw new Error(`QZ Tray websocket connect failed: ${message}`);
  }
}

async function getQzTrayPrinters() {
  const qz = require('qz-tray');
  await setupQzTraySecurity(qz);

  if (!qz || !qz.websocket || typeof qz.websocket.connect !== 'function') {
    throw new Error('QZ Tray websocket API tidak tersedia');
  }

  if (!qz.printers || typeof qz.printers.find !== 'function') {
    throw new Error('QZ Tray printer discovery API tidak tersedia');
  }

  await connectQzTray(qz);

  let printers = [];
  try {
    const found = await qz.printers.find();
    if (Array.isArray(found)) {
      printers = found;
    } else {
      qzTrayWarn('Returned non-array printer list', { found });
    }
  } catch (findErr) {
    const message = String(findErr?.message || findErr || '');
    qzTrayWarn('Printer discovery failed', { message });
    printers = [];
  }

  if (typeof qz.websocket.isActive === 'function' && qz.websocket.isActive()) {
    try {
      await qz.websocket.disconnect();
      qzTrayDebug('Websocket disconnected cleanly');
    } catch (disconnectErr) {
      const disconnectMessage = String(disconnectErr?.message || disconnectErr || '');
      if (!disconnectMessage.includes('No open connection with QZ Tray')) {
        qzTrayWarn('Disconnect failed', { message: disconnectMessage });
      }
    }
  }

  return printers;
}

// Handler to get the list of available printers.
ipcMain.handle('get-printers', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      console.warn('⚠️ Window not found for printer enumeration');
      return [];
    }

    const printers = await win.webContents.getPrintersAsync();

    if (!printers || printers.length === 0) {
      console.warn('⚠️ No printers found on system');
      return [];
    }

    // Attempt to retrieve port information using WMIC.  Electron's
    // `getPrintersAsync` often omits the device port for USB printers,
    // leaving us with only the friendly name.  WMIC can supply a
    // PortName column (e.g. "USB008") that we can merge in.  This is
    // not critical functionality and will quietly fail if WMIC is not
    // available or times out.
    let portMap = {};
    const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
    const cachedPortData = global.printerPortCache || { map: {}, ts: 0 };
    const cacheAge = Date.now() - (cachedPortData.ts || 0);

    if (os.platform() === 'win32') {
      if (cachedPortData.map && cacheAge < CACHE_DURATION_MS) {
        portMap = cachedPortData.map;
      } else {
        try {
          const wmicRaw = execSync('wmic printer get Name,PortName /format:csv', {
            encoding: 'utf8',
            timeout: 2000
          });
          // CSV format gives lines like: Node,Name,PortName\r\nHOST,POS-58,USB008\r\n...
          wmicRaw.split(/\r?\n/).forEach(line => {
            const parts = line.split(',').map(p => p.trim()).filter(p => p);
            // Format can be: "HOSTNAME,PrinterName,PortName" or "PrinterName,PortName"
            // We need at least printer name and port
            if (parts.length >= 2) {
              // If we have hostname (3+ parts), extract last 2; otherwise use as-is
              const name = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
              const port = parts.length >= 3 ? parts[parts.length - 1] : parts[1];
              if (name && port && name !== 'Name' && port !== 'PortName') {
                portMap[name] = port;
              }
            }
          });
          if (Object.keys(portMap).length > 0) {
            broadcastDebug('WMIC printer ports', { portMap });
          }
        } catch (wmicErr) {
          // ignore; this is best-effort
          broadcastDebug('WMIC port lookup failed', { message: wmicErr.message });
        }

        global.printerPortCache = {
          map: portMap,
          ts: Date.now()
        };
      }
    }

    global.lastPrinterPortMap = portMap;

    const formattedPrinters = printers.map(p => {
      const name = String(p.name || 'Unknown Printer').trim();
      const portFromWmic = portMap[name];
      return {
        name,
        displayName: String(p.displayName || p.name || 'Unknown Printer').trim(),
        description: p.description || '',
        isDefault: p.isDefault || false,
        status: p.status || 0, // 0 = idle, 1 = printing, 2 = stopped/error
        // expose additional metadata that may help with raw printing
        portName: portFromWmic || p.portName || p.deviceId || ''
      };
    });

    return formattedPrinters;
  } catch (error) {
    console.error('❌ Printer enumeration error:', error?.message || error);

    let errorMessage = 'Gagal mengambil daftar printer';
    if (error?.message?.includes('getPrintersAsync')) {
      errorMessage = 'API printer tidak tersedia. Update Electron ke versi terbaru.';
    } else if (error?.message?.includes('permission')) {
      errorMessage = 'Tidak ada izin akses printer. Periksa pengaturan sistem.';
    }

    console.warn('⚠️ Returning empty printer list - check system printer configuration');
    return [];
  }
});

// IPC handler to check QZ Tray availability and printer discovery
ipcMain.handle('check-qz-tray', async (event) => {
  try {
    const printers = await getQzTrayPrinters();
    const printerCount = Array.isArray(printers) ? printers.length : 0;
    return {
      success: true,
      printers: Array.isArray(printers) ? printers : [],
      message: `QZ Tray connected. ${printerCount} printer(s) found.`
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error || 'Unknown QZ Tray error')
    };
  }
});

// IPC handler to get QZ Tray certificate
ipcMain.handle('get-qz-certificate', async (event) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const certPaths = [
      path.join(getWritableCertDir(), 'digital-certificate.txt'),
      path.join(__dirname, '..', 'certs', 'digital-certificate.txt'),
      path.join(process.resourcesPath, 'certs', 'digital-certificate.txt'),
      path.join(__dirname, 'digital-certificate.txt'),
      path.join(process.cwd(), 'certs', 'digital-certificate.txt')
    ];

    for (const certPath of certPaths) {
      try {
        if (fs.existsSync(certPath)) {
          const cert = fs.readFileSync(certPath, 'utf8').trim();
          if (cert) {
            return {
              success: true,
              certificate: cert,
              path: certPath
            };
          }
        }
      } catch (err) {
        console.warn('Failed to load certificate from', certPath, err.message);
      }
    }

    return {
      success: false,
      error: 'Certificate not found'
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error || 'Unknown error')
    };
  }
});

// IPC handler to save QZ Tray certificate
ipcMain.handle('save-qz-certificate', async (event, certificate) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const certDir = getWritableCertDir();
    const certPath = path.join(certDir, 'digital-certificate.txt');

    // Validate certificate format
    if (!certificate || typeof certificate !== 'string' || certificate.trim().length === 0) {
      return {
        success: false,
        error: 'Certificate content is empty or invalid'
      };
    }

    // Basic validation - should contain BEGIN CERTIFICATE and END CERTIFICATE
    const certTrimmed = certificate.trim();
    if (!certTrimmed.includes('BEGIN CERTIFICATE') || !certTrimmed.includes('END CERTIFICATE')) {
      return {
        success: false,
        error: 'Invalid certificate format. Should contain BEGIN CERTIFICATE and END CERTIFICATE'
      };
    }

    fs.writeFileSync(certPath, certTrimmed, 'utf8');

    return {
      success: true,
      path: certPath
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error || 'Unknown error')
    };
  }
});

// IPC handler to generate new QZ Tray certificate
ipcMain.handle('generate-qz-certificate', async (event) => {
  try {
    const forge = require('node-forge');
    const fs = require('fs');
    const path = require('path');

    const pki = forge.pki;
    const certDir = getWritableCertDir();
    const certPath = path.join(certDir, 'digital-certificate.txt');

    // Generate RSA key pair
    const keys = pki.rsa.generateKeyPair(2048);

    // Create self-signed certificate
    const cert = pki.createCertificate();
    const randomBytes = require('crypto').randomBytes(16);
    cert.serialNumber = '01' + randomBytes.toString('hex');

    const attrs = [
      { name: 'commonName', value: 'N-POS' },
      { name: 'organizationName', value: 'Nusasoft' },
      { name: 'organizationalUnitName', value: 'POS Systems' },
      { name: 'localityName', value: 'Jakarta' },
      { name: 'stateOrProvinceName', value: 'Jakarta' },
      { name: 'countryName', value: 'ID' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 10);
    cert.publicKey = keys.publicKey;
    cert.setExtensions([
      { name: 'basicConstraints', cA: false },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: '127.0.0.1' },
          { type: 7, ip: '127.0.0.1' }
        ]
      }
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    const certificate = pki.certificateToPem(cert);
    const privateKey = pki.privateKeyToPem(keys.privateKey);
    const keyPath = path.join(certDir, 'digital-certificate-key.txt');

    fs.writeFileSync(certPath, certificate, 'utf8');
    fs.writeFileSync(keyPath, privateKey, 'utf8');

    return {
      success: true,
      certificate,
      certPath,
      keyPath
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error || 'Failed to generate certificate.')
    };
  }
});

// IPC handler to check printer status
ipcMain.handle('check-printer-status', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return { isReady: false, error: 'Window not found' };
    }

    const printers = await win.webContents.getPrintersAsync();
    if (!printers || printers.length === 0) {
      return { isReady: false, error: 'No printers found' };
    }

    // Status codes: 0=idle, 1=printing, 2=stopped (offline/error)
    const readyPrinter = printers.find(p => p.status === 0 || p.status === 1);
    
    return {
      isReady: !!readyPrinter,
      status: readyPrinter?.status || 2,
      name: readyPrinter?.name || 'Tidak tersedia'
    };
  } catch (error) {
    console.error('❌ Printer status check error:', error?.message);
    return { isReady: false, error: error?.message };
  }
});

// Utility: escape HTML for safe embedding in <pre>
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Utility: build HTML wrapper for thermal text receipts
function buildThermalHtml(content, paperWidth = '58mm') {
  const width = paperWidth || '58mm';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Courier, monospace;
      font-size: 18px;
      font-weight: bold;
      line-height: 1.1;
      margin: 0;
      padding: 2mm;
      width: ${width};
      background: white;
      color: black;
    }
    pre {
      margin: 0;
      white-space: pre;
      font-family: Courier, monospace;
      font-size: 18px;
      font-weight: bold;
      line-height: 1.1;
    }
    @page {
      size: ${width} 200mm;
      margin: 0;
    }
    @media print {
      body {
        width: ${width};
        padding: 1mm;
        margin: 0;
      }
      pre {
        font-size: 18px;
        line-height: 1.0;
      }
    }
  </style>
</head>
<body>
  <pre>${escapeHtml(content)}</pre>
</body>
</html>`;
}

// IPC handler for thermal receipt printing
// Accepts: { printerName, content, paperWidth }
ipcMain.handle('print-thermal', async (event, params) => {
  try {
    const { printerName, content, paperWidth } = params || {};

    if (!printerName || !content) {
      throw new Error('printerName atau content diperlukan');
    }

    broadcastDebug('print-thermal invoked', {
      printerName,
      contentLength: content ? content.length : 0,
      paperWidth
    });
    const thermalService = require('./thermalPrintService.cjs');
    const result = await thermalService.printThermal(printerName, content, {
      paperWidth: paperWidth || '58mm',
      auto_cut: true
    });
    broadcastDebug('✅ QZ Tray thermal print successful', { printerName, method: result.method });
    return result;
  } catch (error) {
    const errorMsg = error?.message || String(error);
    console.error('❌ [MAIN] print-thermal error:', errorMsg);
    console.error('❌ [MAIN] Full error:', error);
    broadcastDebug('❌ print-thermal error:', errorMsg);
    throw new Error(errorMsg);
  }
});

// IPC handler for regular printer printing (Inkjet, Laser, etc via Windows Print Driver)
ipcMain.handle('print-regular', async (event, params) => {
  void 0 && ('🖨️ [MAIN] print-regular IPC handler called!', { 
    printerName: params?.printerName, 
    printerType: params?.printerType,
    hasHTML: !!params?.htmlContent,
    hasText: !!params?.plainText
  });

  try {
    const { printerName, htmlContent, plainText, printerType } = params || {};

    if (!printerName || (!htmlContent && !plainText)) {
      throw new Error('printerName dan content (htmlContent atau plainText) diperlukan');
    }

    broadcastDebug('print-regular invoked', {
      printerName,
      type: printerType,
      hasHTML: !!htmlContent,
      hasText: !!plainText
    });

    // Use the main window to print
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      throw new Error('Main window tidak tersedia untuk printing');
    }

    // Create an off-screen window for printing
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.cjs')
      }
    });

    // Load HTML content into the print window
    let htmlToLoad;
    
    // Check if htmlContent is already a full HTML document
    if (htmlContent && (htmlContent.includes('<!DOCTYPE') || htmlContent.includes('<html'))) {
      // Use htmlContent directly - it's already a full document
      htmlToLoad = htmlContent;
    } else if (htmlContent) {
      // htmlContent is just a snippet, wrap it
      const escaped = plainText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      htmlToLoad = `<!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: monospace; margin: 0; padding: 10px; }
          pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
          @media print {
            body { margin: 0; padding: 5mm; }
          }
        </style>
      </head>
      <body>${htmlContent}</body>
      </html>`;
    } else {
      // No htmlContent, use plainText
      const escaped = plainText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      htmlToLoad = `<!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: monospace; margin: 0; padding: 10px; }
          pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
          @media print {
            body { margin: 0; padding: 5mm; }
          }
        </style>
      </head>
      <body><pre>${escaped}</pre></body>
      </html>`;
    }
    
    await printWindow.loadURL(`data:text/html,${encodeURIComponent(htmlToLoad)}`);

    // Wait for content to load
    await printWindow.webContents.executeJavaScript('document.readyState === "complete"');

    // Print to the specified printer
    await printWindow.webContents.print({
      silent: true,
      deviceName: printerName,
      color: printerType === 'color' || false,
      copy: 1
    });

    // Close the print window after printing
    setTimeout(() => printWindow.close(), 1000);
    broadcastDebug('✅ Regular printer job sent', { printerName, type: printerType });
    return { success: true, method: 'windows-print-driver', device: printerName };
  } catch (error) {
    const errorMsg = error?.message || String(error);
    console.error('❌ [MAIN] print-regular error:', errorMsg);
    console.error('❌ [MAIN] Full error:', error);
    broadcastDebug('❌ print-regular error:', errorMsg);
    throw new Error(errorMsg);
  }
});

// Legacy print handlers removed: QZ Tray thermal printing is the only supported print path now.
// Any HTML or electron-pos-printer handlers were intentionally removed to keep the app clean and focused on QZ Tray.

/*
  try {
    try { event.sender.send('print-debug', 'handler print-thermal invoked'); } catch(_) {}
    const { printerName, content, paperWidth } = params || {};
    broadcastDebug('print-thermal invoked', {
      printerName,
      contentLength: content ? content.length : 0,
      paperWidth
    });

    if (!printerName || !content) {
      throw new Error('printerName atau content kosong');
    }

    const thermalService = require('./thermalPrintService.cjs');
    // convert paperWidth to approximate column width if provided
    const widthMap = { '58mm': 32, '80mm': 48, '100mm': 60 };
    const options = {};
    if (paperWidth && widthMap[paperWidth]) {
      options.width = widthMap[paperWidth];
    }

    // call printThermal directly - content is plain text from ReceiptFormatter
    return thermalService.printThermal(printerName, content, options);
  } catch (err) {
    console.error('❌ IPC print-thermal error:', err.message);
    broadcastDebug('❌ IPC print-thermal error:', err.message);
    throw err;
  }
});

// --- IPC HANDLERS FOR OFFLINE DATABASE ---

      }
    })
    .join('\n');
  broadcastDebug('Converted to plain text', { length: plainText.length, sample: plainText.slice(0, 200).replace(/\n/g, '\\n') });

  // Sanitize text for printer compatibility
  let cleanText = plainText
    .replace(/\u00A0/g, ' ')           // non-breaking space → regular space
    .replace(/\r\n/g, '\n')            // normalize line endings
    .replace(/\r/g, '\n')
    // Replace Unicode box-drawing and special characters with ASCII equivalents
    .replace(/[─═║╔╗╚╝╠╣╦╩╬├┤┬┴┼]/g, '-')  // box drawing → dash
    .replace(/[…]/g, '...')            // ellipsis → three dots
    .replace(/[""]/g, '"')             // smart quotes → straight quotes
    .replace(/['']/g, "'")             // smart quotes → straight quotes
    .replace(/[–—]/g, '-')             // en/em dashes → hyphen
    // Remove any remaining non-latin1 characters (keep only 0-255 range)
    .split('')
    .map(c => {
      const code = c.charCodeAt(0);
      // Keep only ASCII (0-127) and extended ASCII (128-255)
      return code <= 255 ? c : '?';
    })
    .join('');
  
  broadcastDebug('Sanitized text for printer', { length: cleanText.length, preview: cleanText.slice(0, 100) });
  
  // ESC/POS commands for thermal printer (58mm) with proper font sizing
  // Font A (12x24) is too big for 58mm thermal, use Font B (9x17) or compressed
  const escPosCommands = [];
  
  // Initialize printer
  escPosCommands.push(Buffer.from([0x1B, 0x40]));        // ESC @ : Reset printer
  
  // Set font to Font B (smaller) - ESC ! n
  // n = 0: Font A (12x24), n = 1: Font B (9x17), n = 16: Font A compressed, n = 17: Font B compressed
  escPosCommands.push(Buffer.from([0x1B, 0x21, 0x01]));  // ESC ! 1 : Select Font B (9x17) - smaller for 58mm
  
  // Set line spacing to 24 dots (compact for thermal)
  escPosCommands.push(Buffer.from([0x1B, 0x33, 0x18]));  // ESC 3 24 : Set line spacing to 24 dots
  
  // Set left margin to 0
  escPosCommands.push(Buffer.from([0x1D, 0x4C, 0x00, 0x00])); // GS L nL nH : Set left margin
  
  // Set print width to 48 chars for 58mm thermal (384 dots / 8 dots per char = 48)
  escPosCommands.push(Buffer.from([0x1D, 0x57, 0x80, 0x01])); // GS W nL nH : Set print width (384 dots)
  
  // Add the receipt text
  escPosCommands.push(Buffer.from(cleanText, 'latin1'));
  
  // Add paper feed and cut
  escPosCommands.push(Buffer.from([0x0A, 0x0A]));        // 2 line feeds
  escPosCommands.push(Buffer.from([0x1D, 0x56, 0x42, 0x00])); // GS V m : Full cut
  
  const buf = Buffer.concat(escPosCommands);

  broadcastDebug('Sending to printer', { printerName, bufferLength: buf.length, commands: escPosCommands.length });

  const result = await rawPrintService.printRawBytes(printerName, buf);
  broadcastDebug('Print succeeded', result);
  return { success: true, method: result.method, printer: printerName };
*/

/*
  try {
    return await performPrintReceipt(printerName, printData);
  } catch (error) {
    const friendly = translatePrinterError(error);
    broadcastDebug('❌ IPC print-receipt error', friendly.message);
    console.error('❌ IPC print-receipt error:', error && error.message ? error.message : error);
    // rethrow the user-friendly message to renderer
    throw friendly;
  }
});


// --- IPC HANDLERS FOR OFFLINE DATABASE ---

// Handler to get offline sales
ipcMain.handle('get-offline-sales', async (event) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');

    const stmt = offlineDb.prepare('SELECT * FROM sales ORDER BY created_at DESC');
    return stmt.all();
  } catch (error) {
    console.error('Failed to get offline sales:', error);
    throw error;
  }
});

// Handler to get offline products
ipcMain.handle('get-offline-products', async (event) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');

    const stmt = offlineDb.prepare('SELECT * FROM products ORDER BY nama_produk ASC');
    return stmt.all();
  } catch (error) {
    console.error('Failed to get offline products:', error);
    throw error;
  }
});

// Handler to save offline sale
ipcMain.handle('save-offline-sale', async (event, saleData) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');

    const stmt = offlineDb.prepare(`
      INSERT INTO sales (
        id_penjualan, kode_transaksi, id_cabang, id_pelanggan, tanggal, total,
        total_sebelum_pajak, jumlah_pajak, jumlah_diskon, diskon_dari_admin,
        diskon_dari_pelanggan, kode_voucher, id_metode_pembayaran_utama,
        diskon_voucher, poin_loyalty_digunakan, poin_loyalty_diperoleh,
        status_pembayaran, catatan, bayar, kembalian, sisa_pembayaran,
        tipe_penjualan, id_user, synced, sync_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
    `);

    const result = stmt.run(
      saleData.id_penjualan,
      saleData.kode_transaksi,
      saleData.id_cabang,
      saleData.id_pelanggan || null,
      saleData.tanggal || new Date().toISOString(),
      saleData.total,
      saleData.total_sebelum_pajak || 0,
      saleData.jumlah_pajak || 0,
      saleData.jumlah_diskon || 0,
      saleData.diskon_dari_admin || 0,
      saleData.diskon_dari_pelanggan || 0,
      saleData.kode_voucher || null,
      saleData.id_metode_pembayaran_utama || null,
      saleData.diskon_voucher || 0,
      saleData.poin_loyalty_digunakan || 0,
      saleData.poin_loyalty_diperoleh || 0,
      saleData.status_pembayaran || 'lunas',
      saleData.catatan || null,
      saleData.bayar || 0,
      saleData.kembalian || 0,
      saleData.sisa_pembayaran || 0,
      saleData.tipe_penjualan || 'retail',
      saleData.id_user
    );

    return result;
  } catch (error) {
    console.error('Failed to save offline sale:', error);
    throw error;
  }
});

// Batch insert handler - prevents N+1 query problems
ipcMain.handle('db-batch-insert', async (event, { table, rows }) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');
    if (!table || typeof table !== 'string') throw new Error('Invalid table name');
    if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, failed: 0, failedRows: [] };

    const allowedTables = ['products', 'sales', 'sale_items', 'payment_details', 'sync_queue', 'sync_metadata', 'categories', 'units', 'customers', 'supplier', 'suppliers', 'purchases', 'purchase_items', 'metode_pembayaran', 'warehouse_stock'];
    if (!allowedTables.includes(table)) throw new Error(`Table '${table}' not allowed`);

    let inserted = 0;
    let failed = 0;
    const failedRows = []; // Collect failed rows for retry

    // Use transaction for atomicity
    const transaction = offlineDb.transaction(() => {
      rows.forEach((data, index) => {
        try {
          const columns = Object.keys(data);
          const placeholders = columns.map(() => '?').join(', ');
          const values = Object.values(data);
          const stmt = offlineDb.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
          stmt.run(...values);
          inserted++;
        } catch (e) {
          console.warn(`Failed to insert row ${index} into ${table}:`, e.message);
          failed++;
          // Track failed row with error info for retry
          failedRows.push({
            index,
            data,
            error: e.message
          });
        }
      });
    });

    transaction();
    return { inserted, failed, failedRows };
  } catch (error) {
    console.error(`Failed to batch insert into ${table}:`, error);
    throw error;
  }
});

// Batch update handler
ipcMain.handle('db-batch-update', async (event, { table, updates }) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');
    if (!table || typeof table !== 'string') throw new Error('Invalid table name');
    if (!Array.isArray(updates) || updates.length === 0) return { updated: 0, failed: 0 };

    const allowedTables = ['products', 'sales', 'sale_items', 'payment_details', 'sync_queue', 'sync_metadata', 'categories', 'units', 'customers', 'supplier', 'suppliers', 'purchases', 'purchase_items', 'metode_pembayaran', 'warehouse_stock'];
    if (!allowedTables.includes(table)) throw new Error(`Table '${table}' not allowed`);

    let updated = 0;
    let failed = 0;

    const transaction = offlineDb.transaction(() => {
      updates.forEach(({ data, whereClause, whereValues }, index) => {
        try {
          // Validate whereValues count matches placeholders in whereClause
          const placeholderCount = (whereClause.match(/\?/g) || []).length;
          const actualValues = whereValues || [];
          if (actualValues.length !== placeholderCount) {
            throw new Error(`Row ${index}: WHERE values count (${actualValues.length}) does not match placeholders (${placeholderCount})`);
          }
          
          const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
          const values = [...Object.values(data), ...actualValues];
          const stmt = offlineDb.prepare(`UPDATE ${table} SET ${setClause} WHERE ${whereClause}`);
          stmt.run(...values);
          updated++;
        } catch (e) {
          console.warn(`Failed to update row ${index} in ${table}:`, e.message);
          failed++;
        }
      });
    });

    transaction();
    return { updated, failed };
  } catch (error) {
    console.error(`Failed to batch update ${table}:`, error);
    throw error;
  }
});

// Batch delete handler
ipcMain.handle('db-batch-delete', async (event, { table, whereClause, whereValues = [] }) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');
    if (!table || typeof table !== 'string') throw new Error('Invalid table name');

    const allowedTables = ['products', 'sales', 'sale_items', 'payment_details', 'sync_queue', 'sync_metadata', 'categories', 'units', 'customers', 'supplier', 'suppliers', 'purchases', 'purchase_items', 'metode_pembayaran', 'warehouse_stock'];
    if (!allowedTables.includes(table)) throw new Error(`Table '${table}' not allowed`);

    // Validate whereValues count matches placeholders in whereClause
    const placeholderCount = (whereClause.match(/\?/g) || []).length;
    if (whereValues.length !== placeholderCount) {
      throw new Error(`WHERE values count (${whereValues.length}) does not match placeholders (${placeholderCount})`);
    }

    const stmt = offlineDb.prepare(`DELETE FROM ${table} WHERE ${whereClause}`);
    const result = stmt.run(...whereValues);
    return result;
  } catch (error) {
    console.error(`Failed to batch delete from ${table}:`, error);
    throw error;
  }
});

ipcMain.handle('db-update-sync-status', async (event, { id, status, retryCount = 0 }) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');

    const stmt = offlineDb.prepare(`
      UPDATE sync_queue
      SET status = ?, retry_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, retryCount, id);
  } catch (error) {
    console.error('Failed to update sync item status:', error);
  }
});

ipcMain.handle('db-update-sync-queue-server-id', async (event, { syncId, serverId, serverResponse }) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');
    if (!syncId || !serverId) throw new Error('syncId and serverId required');

    const stmt = offlineDb.prepare(`
      UPDATE sync_queue
      SET server_id = ?, server_response = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(serverId, serverResponse, syncId);
  } catch (error) {
    console.error('Failed to update sync queue server id:', error);
    throw error;
  }
});

ipcMain.handle('db-set-sync-metadata', async (event, { key, value }) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');

    const stmt = offlineDb.prepare(`
      INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    const result = stmt.run(key, JSON.stringify(value));

    return result;
  } catch (error) {
    console.error('❌ Failed to set sync metadata:', error);
    throw error;
  }
});

// Handler for on-demand database corruption check and repair
ipcMain.handle('db-repair-corruption', async (event) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');
    const results = runDatabaseCorruptionRecovery(offlineDb);
    return results;
  } catch (error) {
    console.error('❌ Failed to repair database corruption:', error);
    throw error;
  }
});

// ===== DATABASE CORRUPTION RECOVERY AND REPAIR =====
function runDatabaseCorruptionRecovery(db) {
  if (!db) return { success: false, error: 'Database not initialized' };
  
  const results = {
    success: true,
    checks: [],
    repairs: [],
    warnings: []
  };

  try {
    // 1. PRAGMA integrity_check
    try {
      const integrityResult = db.prepare('PRAGMA integrity_check').get();

      if (integrityResult && integrityResult.integrity_check !== 'ok') {
        results.checks.push({ name: 'integrity_check', status: 'failed', detail: integrityResult.integrity_check });
        results.warnings.push(`SQLite integrity check failed: ${integrityResult.integrity_check}`);
      } else {
        results.checks.push({ name: 'integrity_check', status: 'passed' });
      }
    } catch (err) {
      results.warnings.push(`Could not run integrity check: ${err.message}`);
    }

    // 2. Verify critical table schemas
    const criticalTables = ['sales', 'sale_items', 'payment_details', 'sync_queue', 'products'];
    const expectedColumns = {
      sales: ['id_penjualan', 'kode_transaksi', 'total', 'bayar', 'status_pembayaran'],
      sale_items: ['id_penjualan', 'id_produk', 'jumlah', 'subtotal'],
      payment_details: ['id_penjualan', 'jumlah_bayar'],
      sync_queue: ['id', 'table_name', 'operation', 'status'],
      products: ['id_produk', 'nama_produk']
    };

    for (const [table, columns] of Object.entries(expectedColumns)) {
      try {
        const pragma = db.prepare(`PRAGMA table_info(${table})`).all();
        const existingCols = pragma.map(p => p.name);
        const missing = columns.filter(c => !existingCols.includes(c));

        if (missing.length > 0) {
          results.repairs.push({ table, action: 'columns_missing', missing });
          results.warnings.push(`Table ${table} missing columns: ${missing.join(', ')}`);
        } else {
          results.checks.push({ table, status: 'schema_ok' });
        }
      } catch (err) {
        results.warnings.push(`Could not check schema for ${table}: ${err.message}`);
      }
    }

    // 3. Cleanup orphaned sale_items (items with non-existent parent sales)
    try {
      const orphanedItems = db.prepare(`
        SELECT COUNT(*) as count FROM sale_items si 
        WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.id_penjualan = si.id_penjualan)
      `).get();

      if (orphanedItems.count > 0) {
        db.exec(`
          DELETE FROM sale_items WHERE id_penjualan NOT IN (SELECT id_penjualan FROM sales)
        `);
        results.repairs.push({ action: 'orphaned_sale_items_deleted', count: orphanedItems.count });
        results.warnings.push(`Cleaned up ${orphanedItems.count} orphaned sale items`);
      }
    } catch (err) {
      results.warnings.push(`Could not cleanup orphaned items: ${err.message}`);
    }

    // 4. Cleanup orphaned payment_details
    try {
      const orphanedPayments = db.prepare(`
        SELECT COUNT(*) as count FROM payment_details pd 
        WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.id_penjualan = pd.id_penjualan)
      `).get();

      if (orphanedPayments.count > 0) {
        db.exec(`
          DELETE FROM payment_details WHERE id_penjualan NOT IN (SELECT id_penjualan FROM sales)
        `);
        results.repairs.push({ action: 'orphaned_payments_deleted', count: orphanedPayments.count });
        results.warnings.push(`Cleaned up ${orphanedPayments.count} orphaned payment details`);
      }
    } catch (err) {
      results.warnings.push(`Could not cleanup orphaned payments: ${err.message}`);
    }

    // 5. Cleanup orphaned sync_queue items for deleted records
    try {
      const orphanedSyncItems = db.prepare(`
        SELECT COUNT(*) as count FROM sync_queue sq
        WHERE sq.table_name = 'sales' 
          AND sq.record_id NOT IN (SELECT id_penjualan FROM sales)
          AND sq.status != 'completed'
      `).get();

      if (orphanedSyncItems.count > 0) {
        db.exec(`
          DELETE FROM sync_queue 
          WHERE table_name = 'sales' 
            AND record_id NOT IN (SELECT id_penjualan FROM sales)
            AND status != 'completed'
        `);
        results.repairs.push({ action: 'orphaned_sync_queue_deleted', count: orphanedSyncItems.count });
        results.warnings.push(`Cleaned up ${orphanedSyncItems.count} orphaned sync queue items`);
      }
    } catch (err) {
      results.warnings.push(`Could not cleanup orphaned sync items: ${err.message}`);
    }

    // 6. Detect and fix orphaned syncing/processing items (crash during sync)
    try {
      const stuckItems = db.prepare(`
        SELECT id FROM sync_queue WHERE status IN ('syncing', 'processing')
      `).all();

      if (stuckItems.length > 0) {
        const resetStmt = db.prepare(`
          UPDATE sync_queue 
          SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);

        stuckItems.forEach(item => {
          resetStmt.run(item.id);
        });

        results.repairs.push({ action: 'stuck_sync_items_reset', count: stuckItems.length });
        results.warnings.push(`Reset ${stuckItems.length} items stuck in 'syncing' or 'processing' status`);
      }
    } catch (err) {
      results.warnings.push(`Could not fix stuck sync items: ${err.message}`);
    }

    if (results.repairs.length > 0 || results.warnings.length > 0) {
      if (results.warnings.length > 0) void 0 && ('[DB RECOVERY] Warnings:', results.warnings);
    } else {
    }

    return results;
  } catch (error) {
    console.error('[DB RECOVERY] ❌ Recovery failed:', error);
    results.success = false;
    results.error = error.message;
    return results;
  }
}

function normalizeOfflineSalePayload({ saleData, items, payments }) {
  if (!saleData || typeof saleData !== 'object') throw new Error('Invalid sale data');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Sale items are required for offline transaction');

  const normalizedItems = items.map((item, index) => {
    const idProduk = item.id_produk || item.idProduk || item.product_id;
    const jumlah = Number(item.jumlah || item.quantity || 0);
    const hargaSatuan = Number(item.harga_satuan || item.harga_jual || 0);

    if (!idProduk) throw new Error(`Item ${index + 1}: id_produk tidak valid`);
    if (!Number.isFinite(jumlah) || jumlah <= 0) throw new Error(`Item ${index + 1}: jumlah harus lebih dari 0`);
    if (!Number.isFinite(hargaSatuan) || hargaSatuan < 0) throw new Error(`Item ${index + 1}: harga_satuan tidak valid`);

    const expectedSubtotal = Number((jumlah * hargaSatuan).toFixed(2));
    if (!Number.isFinite(expectedSubtotal) || expectedSubtotal < 0) {
      throw new Error(`Item ${index + 1}: subtotal tidak valid`);
    }

    return {
      ...item,
      id_produk: idProduk,
      jumlah,
      harga_satuan: hargaSatuan,
      subtotal: expectedSubtotal,
      diskon_item: Number(item.diskon_item || 0),
      pajak_item: Number(item.pajak_item || 0)
    };
  });

  const computedTotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
  if (!Number.isFinite(computedTotal) || computedTotal < 0) {
    throw new Error('Total transaksi tidak valid');
  }

  const normalizedPayments = Array.isArray(payments) ? payments.map((payment, index) => {
    const amount = Number(payment.jumlah_bayar || payment.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Payment ${index + 1}: jumlah_bayar tidak valid`);
    }
    if (!payment.id_metode_pembayaran) {
      throw new Error(`Payment ${index + 1}: id_metode_pembayaran diperlukan`);
    }
    return {
      ...payment,
      jumlah_bayar: amount,
      created_at: payment.created_at || new Date().toISOString()
    };
  }) : [];

  const paidTotal = normalizedPayments.reduce((sum, payment) => sum + payment.jumlah_bayar, 0);
  const statusPembayaran = paidTotal >= computedTotal ? 'lunas' : 'pending';
  const kembalian = paidTotal > computedTotal ? Number((paidTotal - computedTotal).toFixed(2)) : 0;
  const sisaPembayaran = paidTotal < computedTotal ? Number((computedTotal - paidTotal).toFixed(2)) : 0;

  return {
    saleData: {
      ...saleData,
      total: computedTotal,
      bayar: paidTotal,
      kembalian,
      sisa_pembayaran: sisaPembayaran,
      status_pembayaran: saleData.status_pembayaran || statusPembayaran
    },
    items: normalizedItems,
    payments: normalizedPayments
  };
}

// Handler to save complete sale with items and payments (for offline mode)
ipcMain.handle('db-save-sale', async (event, { saleData, items, payments }) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');

    const normalized = normalizeOfflineSalePayload({ saleData, items, payments });
    saleData = normalized.saleData;
    items = normalized.items;
    payments = normalized.payments;

    const transaction = offlineDb.transaction(() => {
      const saleStmt = offlineDb.prepare(`
        INSERT INTO sales (
          id_penjualan, kode_transaksi, id_cabang, id_pelanggan, tanggal, total,
          total_sebelum_pajak, jumlah_pajak, jumlah_diskon, diskon_dari_admin,
          diskon_dari_pelanggan, kode_voucher, id_metode_pembayaran_utama,
          diskon_voucher, poin_loyalty_digunakan, poin_loyalty_diperoleh,
          status_pembayaran, catatan, bayar, kembalian, sisa_pembayaran,
          tipe_penjualan, id_user, synced, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
      `);

      const saleResult = saleStmt.run(
        saleData.id_penjualan,
        saleData.kode_transaksi,
        saleData.id_cabang,
        saleData.id_pelanggan || null,
        saleData.tanggal || new Date().toISOString(),
        saleData.total,
        saleData.total_sebelum_pajak || 0,
        saleData.jumlah_pajak || 0,
        saleData.jumlah_diskon || 0,
        saleData.diskon_dari_admin || 0,
        saleData.diskon_dari_pelanggan || 0,
        saleData.kode_voucher || null,
        saleData.id_metode_pembayaran_utama || null,
        saleData.diskon_voucher || 0,
        saleData.poin_loyalty_digunakan || 0,
        saleData.poin_loyalty_diperoleh || 0,
        saleData.status_pembayaran || 'lunas',
        saleData.catatan || null,
        saleData.bayar || 0,
        saleData.kembalian || 0,
        saleData.sisa_pembayaran || 0,
        saleData.tipe_penjualan || 'retail',
        saleData.id_user
      );

      if (!saleData.id_penjualan) {
        saleData.id_penjualan = saleResult.lastInsertRowid;
      }

      // Insert sale items
      const itemStmt = offlineDb.prepare(`
        INSERT INTO sale_items (
          id_penjualan, id_produk, jumlah, harga_satuan, subtotal,
          diskon_item, pajak_item, synced, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
      `);

      for (const item of items) {
        itemStmt.run(
          saleData.id_penjualan,
          item.id_produk,
          item.jumlah,
          item.harga_satuan,
          item.subtotal,
          item.diskon_item || 0,
          item.pajak_item || 0
        );
      }

      // Insert payment details
      const paymentStmt = offlineDb.prepare(`
        INSERT INTO payment_details (
          id_penjualan, id_metode_pembayaran, jumlah_bayar, created_at,
          synced, sync_version
        ) VALUES (?, ?, ?, ?, 0, 1)
      `);

      for (const payment of payments) {
        paymentStmt.run(
          saleData.id_penjualan,
          payment.id_metode_pembayaran,
          payment.jumlah_bayar,
          payment.created_at || new Date().toISOString()
        );
      }

      // Add to sync queue for later upload
      const syncStmt = offlineDb.prepare(`
        INSERT INTO sync_queue (
          operation, table_name, record_id, data, status, created_at, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      syncStmt.run(
        'INSERT',
        'sales',
        saleData.id_penjualan,
        JSON.stringify({
          id_penjualan: saleData.id_penjualan,
          kode_transaksi: saleData.kode_transaksi,
          id_cabang: saleData.id_cabang,
          id_user: saleData.id_user,
          id_pelanggan: saleData.id_pelanggan || null,
          tanggal: saleData.tanggal || new Date().toISOString(),
          total: saleData.total,
          bayar: saleData.bayar || 0,
          kembalian: saleData.kembalian || 0,
          sisa_pembayaran: saleData.sisa_pembayaran || 0,
          status_pembayaran: saleData.status_pembayaran || 'lunas',
          detail_penjualan: items,
          detail_pembayaran: payments
        }),
        'pending',
        new Date().toISOString(),
        1
      );

      return saleResult;
    });

    const result = transaction();

    // Return comprehensive result for verification
    return {
      success: true,
      saleId: saleData.id_penjualan,
      lastInsertRowid: result.lastInsertRowid,
      changes: result.changes,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to save offline sale:', error);
    throw error;
  }
});

// --- IPC HANDLERS FOR CASH DRAWER ---

// Handler to get cash drawer status/configuration
ipcMain.handle('get-cash-drawer-config', async (event) => {
  try {
    // Get default printer name for thermal-printer type
    let defaultPrinterName = null;
    try {
      // Try to get from localStorage (set by frontend)
      const stored = localStorage?.getItem('defaultPrinterName');
      if (stored) {
        defaultPrinterName = stored;
      }
    } catch (storageError) {
      console.warn('Could not get default printer from localStorage:', storageError.message);
    }

    // Return enhanced configuration
    return {
      enabled: true,
      type: defaultPrinterName ? 'thermal-printer' : 'serial', // Auto-detect based on printer config
      port: 'COM1',
      baudRate: 9600,
      printerName: defaultPrinterName, // For thermal-printer type
      autoOpenOnCashPayment: true,
      timeout: 5000
    };
  } catch (error) {
    console.error('Failed to get cash drawer config:', error);
    throw error;
  }
});

// Handler to test cash drawer connection
ipcMain.handle('test-cash-drawer', async (event, config = {}) => {
  try {

    // Try to open the drawer briefly for testing using the same implementation as the real handler
    const result = await openCashDrawerInternal(config);
    return { success: true, message: 'Cash drawer test berhasil', result };

  } catch (error) {
    console.error('Cash drawer test failed:', error);
    return { success: false, error: error.message };
  }
});

// Handler to ensure window focus
ipcMain.handle('ensure-focus', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.focus();
      win.webContents.focus();

    }
  } catch (error) {
    console.error('Failed to ensure focus:', error);
  }
});


// ===== OPTIMIZED PRODUCT BULK INSERT (bypass individual operations) =====

/**
 * Bulk insert products langsung ke offline.db (EFFICIENT)
 * Menghindari warning "Cache data too large" dengan insert langsung ke SQLite
 */
ipcMain.handle('db-insert-products', async (event, products) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');
    if (!Array.isArray(products) || products.length === 0) {
      return { success: true, inserted: 0, updated: 0, failed: 0 };
    }

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const BATCH_SIZE = 1000; // Process dalam batch untuk efficiency

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      
      // Use transaction untuk atomic operation
      try {
        const insertStmt = offlineDb.prepare(`
          INSERT OR REPLACE INTO products (
            id_produk, kode_produk, nama_produk, id_kategori, id_satuan,
            harga_beli, harga_jual, harga_grosir, min_qty_grosir, stok_minimum,
            status, gambar, barcode, merek, lokasi_rak, deskripsi, foto_produk,
            created_at, updated_at, synced, sync_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Wrap batch in transaction
        const insertMany = offlineDb.transaction((items) => {
          for (const product of items) {
            insertStmt.run(
              product.id_produk || product.id,
              product.kode_produk || null,
              product.nama_produk || 'Unknown',
              product.id_kategori || null,
              product.id_satuan || null,
              product.harga_beli || product.harga || 0,
              product.harga_jual || product.harga || 0,
              product.harga_grosir || 0,
              product.min_qty_grosir || 0,
              product.stok_minimum || 0,
              product.status || 'aktif',
              product.gambar || product.foto || null,
              product.barcode || null,
              product.merek || null,
              product.lokasi_rak || null,
              product.deskripsi || null,
              product.foto_produk || product.gambar || null,
              product.created_at || new Date().toISOString(),
              product.updated_at || new Date().toISOString(),
              0, // synced
              0  // sync_version
            );
            inserted++;
          }
        });

        insertMany(batch);
      } catch (batchErr) {
        console.error('Batch insert error:', batchErr);
        failed += batch.length;
      }
    }
    return { success: true, inserted, updated, failed };
  } catch (error) {
    console.error('db-insert-products error:', error);
    throw error;
  }
});

// ===== PRODUCT SEARCH DARI OFFLINE.DB (fast queries) =====

/**
 * Search products dari offline.db dengan indexed queries
 */
ipcMain.handle('db-search-products', async (event, query, options = {}) => {
  try {
    if (!offlineDb) throw new Error('Database not initialized');

    const { limit = 50, offset = 0, status = 'aktif' } = options;
    
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (query && query.trim()) {
      const searchTerm = `%${query}%`;
      sql += ` AND (kode_produk LIKE ? OR nama_produk LIKE ? OR deskripsi LIKE ?)`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    sql += ` ORDER BY nama_produk ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const results = offlineDb.prepare(sql).all(...params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as count FROM products WHERE 1=1';
    const countParams = [];
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    if (query && query.trim()) {
      const searchTerm = `%${query}%`;
      countSql += ` AND (kode_produk LIKE ? OR nama_produk LIKE ? OR deskripsi LIKE ?)`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    const countResult = offlineDb.prepare(countSql).get(...countParams);

    return {
      data: results || [],
      total: countResult?.count || 0,
      limit,
      offset
    };
  } catch (error) {
    console.error('db-search-products error:', error);
    throw error;
  }
});

// ===== OFFLINE TRANSACTIONS MANAGEMENT (SQLite-based, replaces localStorage) =====

// Handler: Store offline transaction
ipcMain.handle('offline-transaction-store', async (event, transactionData, cartItems, paymentInfo, customerInfo) => {
  try {
    if (!productDatabase) {
      throw new Error('ProductDatabase not available - offline transactions cannot be stored');
    }
    const result = productDatabase.storeOfflineTransaction(transactionData, cartItems, paymentInfo, customerInfo);
    return result;
  } catch (error) {
    console.error('Error storing offline transaction:', error);
    throw error;
  }
});

// Handler: Get pending offline transactions
ipcMain.handle('offline-transaction-pending', async (event, limit = 100) => {
  try {
    if (!productDatabase) {
      return []; // Return empty array if DB not available
    }
    return productDatabase.getPendingOfflineTransactions(limit);
  } catch (error) {
    console.error('Error getting pending transactions:', error);
    throw error;
  }
});

// Handler: Get all offline transactions
ipcMain.handle('offline-transaction-all', async (event, limit = 1000, offset = 0) => {
  try {
    if (!productDatabase) {
      return []; // Return empty array if DB not available
    }
    return productDatabase.getAllOfflineTransactions(limit, offset);
  } catch (error) {
    console.error('Error getting all transactions:', error);
    throw error;
  }
});

// Handler: Mark transaction as synced
ipcMain.handle('offline-transaction-mark-synced', async (event, transactionId, serverId) => {
  try {
    if (!productDatabase) {
      throw new Error('ProductDatabase not available');
    }
    return productDatabase.markTransactionSynced(transactionId, serverId);
  } catch (error) {
    console.error('Error marking transaction synced:', error);
    throw error;
  }
});

// Handler: Update transaction status
ipcMain.handle('offline-transaction-update-status', async (event, transactionId, status, errorMessage) => {
  try {
    if (!productDatabase) {
      throw new Error('ProductDatabase not available');
    }
    return productDatabase.updateTransactionStatus(transactionId, status, errorMessage);
  } catch (error) {
    console.error('Error updating transaction status:', error);
    throw error;
  }
});

// Handler: Get pending transaction count
ipcMain.handle('offline-transaction-count', async (event) => {
  try {
    if (!productDatabase) {
      return 0; // Return 0 if DB not available
    }
    return productDatabase.getPendingTransactionCount();
  } catch (error) {
    console.error('Error getting transaction count:', error);
    throw error;
  }
});

// Handler: Get transaction statistics
ipcMain.handle('offline-transaction-stats', async (event) => {
  try {
    if (!productDatabase) {
      return { pending: 0, failed: 0, synced: 0 }; // Return empty stats if DB not available
    }
    return productDatabase.getOfflineTransactionStats();
  } catch (error) {
    console.error('Error getting transaction stats:', error);
    throw error;
  }
});

// Handler: Cleanup old transactions
ipcMain.handle('offline-transaction-cleanup', async (event, daysToKeep = 30) => {
  try {
    if (!productDatabase) {
      return { deleted: 0 }; // Return no-op if DB not available
    }
    return productDatabase.cleanupOldTransactions(daysToKeep);
  } catch (error) {
    console.error('Error cleaning up transactions:', error);
    throw error;
  }
});

// ===== GRACEFUL SHUTDOWN =====

// Handle app before-quit to cleanup properly
app.on('before-quit', async (event) => {
  if (offlineDb) {
    try {
      offlineDb.close();
      offlineDb = null;
    } catch (err) {
      console.error('Error closing database:', err);
    }
  }
  
  try {
    productDatabase.close();
  } catch (err) {
    console.error('Error closing product database:', err);
  }
});

// File save handler for Excel exports
ipcMain.handle('save-file', async (event, bufferArray, filename) => {
  try {
    const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
      title: 'Simpan File',
      defaultPath: filename,
      filters: [
        {
          name: 'Excel Files',
          extensions: ['xlsx', 'xls']
        },
        {
          name: 'All Files',
          extensions: ['*']
        }
      ]
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const fs = require('fs');

    // Convert array back to buffer
    let fileBuffer;
    if (Array.isArray(bufferArray)) {
      fileBuffer = Buffer.from(bufferArray);
    } else if (Buffer.isBuffer(bufferArray)) {
      fileBuffer = bufferArray;
    } else if (bufferArray instanceof ArrayBuffer) {
      fileBuffer = Buffer.from(bufferArray);
    } else if (bufferArray instanceof Uint8Array) {
      fileBuffer = Buffer.from(bufferArray);
    } else {
      throw new Error('Unsupported buffer type: ' + typeof bufferArray);
    }

    await fs.promises.writeFile(result.filePath, fileBuffer);

    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false, error: error.message };
  }
});

// Clean up IPC listeners when windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ===== END PRODUCT OPTIMIZATION =====

// Close database on app quit
app.on('quit', () => {
  try {
    if (offlineDb) {
      offlineDb.close();
    }
  } catch (error) {
    console.error('Error closing database:', error);
  }
});
