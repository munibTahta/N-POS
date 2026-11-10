'use strict';
const os = require('os');
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

module.exports = { lookupPortForPrinter };
