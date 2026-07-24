/**
 * QZ Tray Thermal Print Service
 *
 * This service is intentionally narrow: it provides a single, reliable
 * direct thermal printing path for QZ Tray.
 */

const debug = (label, data) => {
  if (data === undefined) {

    return;
  }

};

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

function getWritableCertDir() {
  const certDir = path.join(app.getPath('userData'), 'certs');
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

const loadQzTrayCertificate = () => {
  const certPaths = [
    path.join(getWritableCertDir(), 'digital-certificate.txt'),
    // Development: <project>/certs
    path.join(__dirname, '..', 'certs', 'digital-certificate.txt'),
    // Production packaged: resources/certs (when built with electron-builder)
    path.join(process.resourcesPath, 'certs', 'digital-certificate.txt'),
    // Production packaged: app/certs (alternative path)
    path.join(process.resourcesPath, 'app', 'certs', 'digital-certificate.txt'),
    // Electron main dir
    path.join(__dirname, 'digital-certificate.txt'),
    // Fallback: current working directory
    path.join(process.cwd(), 'certs', 'digital-certificate.txt'),
    // Legacy appData location
    path.join(process.env.APPDATA || os.homedir(), '.n-pos', 'certs', 'digital-certificate.txt')
  ];

  debug('Searching for certificate', { paths: certPaths });

  for (const certPath of certPaths) {
    try {
      if (fs.existsSync(certPath)) {
        const cert = fs.readFileSync(certPath, 'utf8').trim();
        if (isValidQzTrayCertificate(cert)) {
          debug('Certificate loaded from', certPath);
          return cert;
        }
      }
    } catch (err) {
      debug('Failed to load certificate from', certPath, ':', err.message);
    }
  }

  debug('No valid certificate found');
  return '';
};

const loadQzTrayPrivateKey = () => {
  const keyPaths = [
    path.join(getWritableCertDir(), 'digital-certificate-key.txt'),
    // Development: <project>/certs
    path.join(__dirname, '..', 'certs', 'digital-certificate-key.txt'),
    // Production packaged: resources/certs (when built with electron-builder)
    path.join(process.resourcesPath, 'certs', 'digital-certificate-key.txt'),
    // Production packaged: app/certs (alternative path)
    path.join(process.resourcesPath, 'app', 'certs', 'digital-certificate-key.txt'),
    // Electron main dir
    path.join(__dirname, 'digital-certificate-key.txt'),
    // Fallback: current working directory
    path.join(process.cwd(), 'certs', 'digital-certificate-key.txt'),
    // Legacy appData location
    path.join(process.env.APPDATA || os.homedir(), '.n-pos', 'certs', 'digital-certificate-key.txt')
  ];

  debug('Searching for private key', { paths: keyPaths });

  for (const keyPath of keyPaths) {
    try {
      if (fs.existsSync(keyPath)) {
        const key = fs.readFileSync(keyPath, 'utf8').trim();
        if (isValidQzTrayPrivateKey(key)) {
          debug('Private key loaded from', keyPath);
          return key;
        }
      }
    } catch (err) {
      debug('Failed to load private key from', keyPath, ':', err.message);
    }
  }

  debug('No valid private key found');
  return '';
};

/**
 * Verify that certificate and private key are valid and properly paired
 */
const verifyQzTrayCertificateAndKey = (certificate, privateKey) => {
  if (!certificate || !privateKey) {
    debug('⚠️ Certificate or private key is empty');
    return false;
  }

  if (!certificate.includes('-----BEGIN CERTIFICATE-----')) {
    debug('❌ Certificate is not in valid PEM format');
    return false;
  }

  if (!privateKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
    debug('❌ Private key is not in valid RSA PEM format');
    return false;
  }

  try {
    const crypto = require('crypto');
    // Try to create a sign object to verify the key is valid
    const signer = crypto.createSign('SHA256');
    signer.update('test');
    signer.end();
    const testSignature = signer.sign(privateKey, 'base64');
    
    if (!testSignature) {
      debug('❌ Private key validation failed - cannot generate signature');
      return false;
    }
    
    debug('✅ Certificate and private key are both valid');
    return true;
  } catch (err) {
    debug('❌ Certificate/key validation error:', err.message);
    return false;
  }
};

const setupQzTraySecurity = (qz) => {

  if (!qz || !qz.security) {
    throw new Error('QZ Tray security object not available');
  }

  const certificate = loadQzTrayCertificate();
  const privateKey = loadQzTrayPrivateKey();

  if (!isValidQzTrayCertificate(certificate)) {
    throw new Error('QZ Tray certificate tidak ditemukan atau tidak valid. Generate atau impor sertifikat di Settings.');
  }

  if (!isValidQzTrayPrivateKey(privateKey)) {
    throw new Error('QZ Tray private key tidak ditemukan atau tidak valid. Generate sertifikat baru di Settings.');
  }

  if (!verifyQzTrayCertificateAndKey(certificate, privateKey)) {
    throw new Error('QZ Tray certificate/key validation failed. Periksa file sertifikat dan kunci pribadi.');
  }

  try {
    if (typeof qz.security.setCertificatePromise === 'function') {
      qz.security.setCertificatePromise(function(resolve, reject) {
        if (!certificate || certificate.length === 0) {
          return reject(new Error('Certificate is empty'));
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
};

const disconnectQzTray = async (qz) => {
  if (!qz || !qz.websocket || typeof qz.websocket.disconnect !== 'function') {
    return;
  }

  if (typeof qz.websocket.isActive === 'function' && !qz.websocket.isActive()) {
    debug('Websocket already disconnected');
    return;
  }

  try {
    await qz.websocket.disconnect();
    debug('Websocket disconnected cleanly');
  } catch (disconnectErr) {
    const message = String(disconnectErr?.message || disconnectErr || '');
    if (!message.includes('No open connection with QZ Tray')) {
      debug('Disconnect failed:', message);
    }
  }
};

const connectQzTray = async (qz) => {
  if (!qz || !qz.websocket || typeof qz.websocket.connect !== 'function') {
    throw new Error('QZ Tray websocket API tidak tersedia');
  }

  if (typeof qz.websocket.isActive === 'function' && qz.websocket.isActive()) {
    debug('Websocket already active, skipping connect');
    return;
  }

  const candidatePorts = [8182, 8181];
  const MAX_ATTEMPTS_PER_PORT = 3;

  for (const port of candidatePorts) {
    let attempt = 0;
    while (attempt < MAX_ATTEMPTS_PER_PORT) {
      attempt += 1;
      try {
        await qz.websocket.connect({ host: 'localhost', port, retries: 0, delay: 0 });
        debug('Websocket connected on port', { port });
        return;
      } catch (connectErr) {
        const message = String(connectErr?.message || connectErr || '');

        if (message.includes('An open connection with QZ Tray already exists')) {
          debug('Websocket already connected, continuing with existing connection');
          return;
        }

        if (typeof qz.websocket.isActive === 'function' && qz.websocket.isActive()) {
          debug('Websocket became active after connect attempt');
          return;
        }

        if (message.includes('current connection attempt has not returned yet') || message.includes("Cannot read properties of undefined (reading 'length')")) {
          debug('Connection pending, retrying after short delay', { port, attempt, message });
          await new Promise(resolve => setTimeout(resolve, 350));
          continue;
        }

        debug('Connect failed on port', { port, attempt, message });
        break;
      }
    }
  }

  if (typeof qz.websocket.isActive === 'function' && qz.websocket.isActive()) {
    debug('Websocket already active after port attempts');
    return;
  }

  try {
    await qz.websocket.connect();
    debug('Websocket connected using default settings');
    return;
  } catch (connectErr) {
    const message = String(connectErr?.message || connectErr || '');
    if (message.includes('An open connection with QZ Tray already exists')) {
      debug('Websocket already connected using default settings');
      return;
    }
    throw new Error('QZ Tray websocket connect failed: ' + message);
  }
};

const generateEscPosBuffer = (text, options = {}) => {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const chunks = [];

  chunks.push(Buffer.from([0x1B, 0x40])); // Initialize printer
  chunks.push(Buffer.from([0x1B, 0x74, 0x00])); // Character table 0
  chunks.push(Buffer.from([0x1B, 0x33, 0x1E])); // Line spacing

  for (const line of lines) {
    chunks.push(Buffer.from([0x1B, 0x61, 0x00])); // Left align
    chunks.push(Buffer.from(line, 'latin1'));
    chunks.push(Buffer.from([0x0A]));
  }

  if (options.auto_cut !== false) {
    chunks.push(Buffer.from([0x1D, 0x56, 0x41, 0x03])); // Partial cut
  }

  return Buffer.concat(chunks);
};

const printViaQzTray = async (printerName, content, options = {}) => {
  debug('=== printViaQzTray START ===', { printerName, contentLength: String(content || '').length });

  const qz = require('qz-tray');
  if (!qz) {
    throw new Error('QZ Tray tidak terpasang. Jalankan npm install qz-tray');
  }

  // Setup security BEFORE connecting
  debug('Setting up security...');
  setupQzTraySecurity(qz);
  
  // Give security setup time to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
  
  debug('Connecting to websocket...');
  await connectQzTray(qz);

  debug('Querying available printers...');
  const printers = await qz.printers.find();
  if (!Array.isArray(printers)) {
    await disconnectQzTray(qz);
    throw new Error('QZ Tray returned invalid printer list');
  }

  debug('Available printers', { printers });

  if (!printers.includes(printerName)) {
    await disconnectQzTray(qz);
    throw new Error('Printer "' + printerName + '" tidak ditemukan di QZ Tray. Tersedia: ' + printers.join(', '));
  }

  let escPosData;
  if (Buffer.isBuffer(content)) {
    escPosData = content;
  } else if (typeof content === 'string' && (content.startsWith('\x1B') || content.startsWith('\x1D'))) {
    escPosData = Buffer.from(content, 'latin1');
  } else {
    escPosData = generateEscPosBuffer(content, options);
  }

  const config = qz.configs.create(printerName);
  const base64Data = escPosData.toString('base64');

  debug('Sending print job...');
  try {
    await qz.print(config, [{
      type: 'raw',
      format: 'base64',
      data: base64Data
    }]);
  } catch (printErr) {
    const errMsg = printErr?.message || String(printErr);
    debug('Print failed:', errMsg);
    throw new Error('QZ Tray print failed: ' + errMsg);
  }

  debug('Print successful', { printerName, bytes: escPosData.length });
  return {
    success: true,
    method: 'qz-tray',
    printer: printerName,
    bytes: escPosData.length
  };
};

const printThermal = async (printerName, content, options = {}) => {
  if (!printerName || !content) {
    throw new Error('printerName dan content diperlukan');
  }

  try {
    return await printViaQzTray(printerName, content, options);
  } catch (error) {
    debug('printThermal failed', error.message || error);
    throw new Error('QZ Tray print failed: ' + (error.message || error));
  }
};

/**
 * Initialize and verify certificate setup
 */
const initializeCertificates = () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  debug('=== Initializing QZ Tray Certificates ===');
  
  const certPaths = [
    path.join(__dirname, '..', 'certs', 'digital-certificate.txt'),
    path.join(process.resourcesPath, 'certs', 'digital-certificate.txt'),
    path.join(process.cwd(), 'certs', 'digital-certificate.txt'),
    path.join(__dirname, 'digital-certificate.txt'),
    path.join(process.env.APPDATA || os.homedir(), '.n-pos', 'certs', 'digital-certificate.txt')
  ];

  const keyPaths = [
    path.join(__dirname, '..', 'certs', 'digital-certificate-key.txt'),
    path.join(process.resourcesPath, 'certs', 'digital-certificate-key.txt'),
    path.join(process.cwd(), 'certs', 'digital-certificate-key.txt'),
    path.join(__dirname, 'digital-certificate-key.txt'),
    path.join(process.env.APPDATA || os.homedir(), '.n-pos', 'certs', 'digital-certificate-key.txt')
  ];

  let certFound = false;
  let keyFound = false;
  let certPath = null;
  let keyPath = null;

  for (const p of certPaths) {
    const exists = fs.existsSync(p);
    if (exists) {

      certFound = true;
      certPath = p;
      break;
    }
  }

  for (const p of keyPaths) {
    const exists = fs.existsSync(p);
    if (exists) {

      keyFound = true;
      keyPath = p;
      break;
    }
  }

  if (!certFound) {
    console.error('[ThermalService] ❌ NO CERTIFICATE FILE FOUND!');
  }
  if (!keyFound) {
    console.error('[ThermalService] ❌ NO PRIVATE KEY FILE FOUND!');
  }

  if (certFound && keyFound) {
    try {
      const cert = fs.readFileSync(certPath, 'utf8');
      const key = fs.readFileSync(keyPath, 'utf8');


      debug('✅ Both certificate and key files are available');
    } catch (err) {
      console.error('[ThermalService] ❌ ERROR READING FILES:', err.message);
    }
  }

};

// Initialize on module load
initializeCertificates();

module.exports = {
  printThermal,
  generateEscPosBuffer,
  initializeCertificates
};
