#!/usr/bin/env node

/**
 * Script untuk membuat sertifikat self-signed VALID untuk QZ Tray
 * Menggunakan node-forge (pure JavaScript, tidak perlu external OpenSSL)
 * Format: X.509 self-signed certificate dalam PEM format
 */

const forge = require('node-forge');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pki = forge.pki;
const CERT_DIR = path.join(__dirname, 'certs');
const CERT_FILE = path.join(CERT_DIR, 'digital-certificate.txt');
const KEY_FILE = path.join(CERT_DIR, 'digital-certificate-key.txt');

function generateSelfSignedCertificateNodeForge() {
  // Buat direktori certs jika belum ada
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  try {
    // Generate RSA key pair
    const keys = pki.rsa.generateKeyPair(2048);
    // Create certificate
    const cert = pki.createCertificate();
    
    // Set serial number - generate random serial
    const randomBytes = crypto.randomBytes(16);
    const serialNumber = '01' + randomBytes.toString('hex');
    cert.serialNumber = serialNumber;
    
    // Set subject & issuer (same untuk self-signed)
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

    // Set validity (10 years)
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 10);

    // Set public key
    cert.publicKey = keys.publicKey;

    // Extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: '127.0.0.1' },
          { type: 7, ip: '127.0.0.1' }
        ]
      }
    ]);

    // Self-sign certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());
    // Convert to PEM format
    const certPem = pki.certificateToPem(cert);
    const keyPem = pki.privateKeyToPem(keys.privateKey);

    // Write certificate to file
    fs.writeFileSync(CERT_FILE, certPem, 'utf8');
    // Write private key to file
    fs.writeFileSync(KEY_FILE, keyPem, 'utf8');
    // Display certificate info
    return certPem;

  } catch (error) {
    console.error('❌ Gagal membuat sertifikat:', error.message);
    console.error(error);
    process.exit(1);
  }
}

function showUsage() {
}

if (require.main === module) {
  generateSelfSignedCertificateNodeForge();
  showUsage();
}

module.exports = { generateSelfSignedCertificateNodeForge, CERT_FILE, KEY_FILE };