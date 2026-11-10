/**
 * Browser-safe ESC/POS byte encoder + RawBT bridge helper.
 *
 * Mirrors electron/thermalPrintService.cjs's generateEscPosBuffer() so that
 * receipts printed via RawBT (Android Bluetooth/USB bridge app) look the
 * same as receipts printed via QZ Tray on desktop.
 */

const encodeLatin1 = (str) => {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
};

const concatBytes = (chunks) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
};

/**
 * Convert plain receipt text into raw ESC/POS command bytes.
 */
export function textToEscPosBytes(text, options = {}) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const chunks = [];

  chunks.push(new Uint8Array([0x1b, 0x40])); // Initialize printer
  chunks.push(new Uint8Array([0x1b, 0x74, 0x00])); // Character table 0
  chunks.push(new Uint8Array([0x1b, 0x33, 0x1e])); // Line spacing

  lines.forEach((line) => {
    chunks.push(new Uint8Array([0x1b, 0x61, 0x00])); // Left align
    chunks.push(encodeLatin1(line));
    chunks.push(new Uint8Array([0x0a]));
  });

  if (options.auto_cut !== false) {
    chunks.push(new Uint8Array([0x1d, 0x56, 0x41, 0x03])); // Partial cut
  }

  return concatBytes(chunks);
}

export function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Hand raw ESC/POS bytes to the RawBT app via its custom URI scheme.
 * RawBT (Android) owns the actual Bluetooth/USB/Wi-Fi connection to the
 * printer, so the web app never needs Web Bluetooth/GATT access itself.
 */
export function sendToRawBT(base64Data) {
  if (!base64Data) throw new Error('Data cetak kosong');
  window.location.href = `rawbt:base64,${base64Data}`;
}
