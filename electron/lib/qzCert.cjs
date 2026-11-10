'use strict';
// Pemeriksaan bentuk sertifikat/kunci QZ Tray (PEM).

function isValidQzTrayCertificate(certificate) {
  return typeof certificate === 'string'
    && certificate.includes('-----BEGIN CERTIFICATE-----')
    && certificate.includes('-----END CERTIFICATE-----');
}

function isValidQzTrayPrivateKey(privateKey) {
  return typeof privateKey === 'string'
    && (privateKey.includes('-----BEGIN RSA PRIVATE KEY-----') || privateKey.includes('-----BEGIN PRIVATE KEY-----'));
}

module.exports = { isValidQzTrayCertificate, isValidQzTrayPrivateKey };
