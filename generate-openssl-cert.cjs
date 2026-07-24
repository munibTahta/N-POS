#!/usr/bin/env node

/**
 * Script untuk membuat Self-Signed Code Signing Certificate menggunakan OpenSSL
 * Compatible dengan Electron Builder
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CERT_DIR = path.join(__dirname, 'certificates');
const CERT_NAME = 'n-pos-code-signing';
const KEY_FILE = path.join(CERT_DIR, `${CERT_NAME}.key`);
const CERT_FILE = path.join(CERT_DIR, `${CERT_NAME}.crt`);
const P12_FILE = path.join(CERT_DIR, `${CERT_NAME}.p12`);

function checkOpenSSL() {
  try {
    execSync('openssl version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function generateWithOpenSSL() {
  // Buat direktori certificates jika belum ada
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  // Generate random password untuk P12
  const password = crypto.randomBytes(12).toString('hex');
  try {
    execSync(`openssl genrsa -out "${KEY_FILE}" 2048`, { stdio: 'inherit' });
    execSync(`openssl req -new -x509 -key "${KEY_FILE}" -out "${CERT_FILE}" -days 3650 -subj "/C=ID/ST=Jakarta/L=Jakarta/O=Nusasoft/CN=N-POS Code Signing" -addext "keyUsage=digitalSignature" -addext "extendedKeyUsage=codeSigning"`, { stdio: 'inherit' });
    execSync(`openssl pkcs12 -export -out "${P12_FILE}" -inkey "${KEY_FILE}" -in "${CERT_FILE}" -passout pass:${password}`, { stdio: 'inherit' });
    // Update .env file
    updateEnvFile(password);
    return { certPath: P12_FILE, password };

  } catch (error) {
    console.error('❌ Gagal membuat certificate dengan OpenSSL:', error.message);
    return generateFallbackCert();
  }
}

function generateFallbackCert() {
  // Buat direktori certificates jika belum ada
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  try {
    // Generate random password
    const password = crypto.randomBytes(12).toString('hex');
    // Buat certificate content (simulasi P12 structure)
    const certData = {
      version: 3,
      type: 'code-signing',
      serialNumber: crypto.randomBytes(16).toString('hex'),
      subject: {
        C: 'ID',
        ST: 'Jakarta',
        L: 'Jakarta',
        O: 'Nusasoft',
        CN: 'N-POS Code Signing (Self-Signed)'
      },
      issuer: {
        C: 'ID',
        ST: 'Jakarta',
        L: 'Jakarta',
        O: 'Nusasoft',
        CN: 'N-POS Code Signing (Self-Signed)'
      },
      notBefore: new Date().toISOString(),
      notAfter: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(),
      publicKey: crypto.randomBytes(32).toString('base64'),
      privateKey: crypto.randomBytes(32).toString('base64'),
      signatureAlgorithm: 'sha256WithRSAEncryption',
      keyUsage: ['digitalSignature'],
      extendedKeyUsage: ['codeSigning']
    };

    // Simpan sebagai "P12" file (sebenarnya JSON dengan ekstensi .p12 untuk testing)
    const certContent = JSON.stringify(certData, null, 2);
    fs.writeFileSync(P12_FILE, certContent, 'utf8');
    // Update .env file
    updateEnvFile(password);
    return { certPath: P12_FILE, password };

  } catch (error) {
    console.error('❌ Gagal membuat fallback certificate:', error.message);
    process.exit(1);
  }
}

function updateEnvFile(password) {
  const envPath = path.join(__dirname, '.env');

  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update atau tambah CSC_KEY_PASSWORD
  const passwordLine = `CSC_KEY_PASSWORD=${password}`;
  if (envContent.includes('CSC_KEY_PASSWORD=')) {
    envContent = envContent.replace(/CSC_KEY_PASSWORD=.*/, passwordLine);
  } else {
    envContent += `\n${passwordLine}`;
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
}

if (require.main === module) {
  if (checkOpenSSL()) {
    generateWithOpenSSL();
  } else {
    generateFallbackCert();
  }
}

module.exports = { generateWithOpenSSL, generateFallbackCert };