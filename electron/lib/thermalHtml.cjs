'use strict';
// HTML pembungkus struk termal (cetak lewat BrowserWindow).

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

module.exports = { escapeHtml, buildThermalHtml };
