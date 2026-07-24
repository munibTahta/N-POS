/**
 * Export data array to Excel file and trigger download in browser/Electron.
 * Uses `exceljs` to build workbook and `file-saver` (browser) or `electronAPI` (Electron) to save file.
 * @param {Array<Object|Array>} data - Array of plain objects or arrays (rows) to export
 * @param {string} filename - Filename to save (e.g., 'Laporan_Penjualan.xlsx')
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportToExcel = async (data = [], filename = 'export.xlsx') => {
  try {
    // Validate data
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');

    if (data.length === 0) {
      // Add empty row if no data
      worksheet.addRow([]);
    } else if (Array.isArray(data[0])) {
      // Data is already array of arrays
      worksheet.addRows(data);
    } else {
      // Data is array of objects
      if (data.length === 0 || !data[0] || typeof data[0] !== 'object') {
        throw new Error('Invalid data format for export');
      }
      if (data.length > 1000) {
        throw new Error('Data too large. Maximum 1,000 rows allowed.');
      }
      const headers = Object.keys(data[0]);
      if (headers.length === 0) {
        throw new Error('No columns to export');
      }
      // Add header row
      try {
        worksheet.addRow(headers);
      } catch (e) {
        throw new Error('Error adding headers: ' + e.message);
      }
      // Add data rows - ensure all values are strings
      const rows = data.map((obj, index) => {
        if (index >= 1000) return null; // Safety limit
        return headers.map(key => {
          const value = obj && obj[key];
          if (value === null || value === undefined) return '';
          try {
            return String(value);
          } catch (_e) {
            return ''; // If String() fails, return empty
          }
        });
      }).filter(row => row !== null); // Remove null rows
      
      // Add rows in small chunks
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        try {
          worksheet.addRows(rows.slice(i, i + chunkSize));
        } catch (e) {
          throw new Error('Error adding rows chunk ' + i + ': ' + e.message);
        }
      }
    }

    // Write workbook to buffer
    let buffer;
    try {
      buffer = await workbook.xlsx.writeBuffer();
    } catch (e) {
      throw new Error('Error writing buffer: ' + e.message);
    }

    // Check if running in Electron
    if (window.electronAPI && window.electronAPI.saveFile) {
      // Use Electron API to save file
      // Convert buffer to array for transfer
      const arrayBuffer = buffer;
      const result = await window.electronAPI.saveFile(Array.from(new Uint8Array(arrayBuffer)), filename);
      if (!result.success) {
        if (result.canceled) {
          // User canceled the save dialog
        } else {
          throw new Error(result.error || 'Failed to save file');
        }
      }
    } else {
      // Use file-saver for browser
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, filename);
    }
  } catch (err) {
    console.error('Failed to export to Excel:', err);
    throw err;
  }
};
