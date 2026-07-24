import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSuppliers, deleteSupplier, bulkImportSuppliers } from '../services/api';
import ExcelJS from 'exceljs';
import { usePermissions } from '../hooks/usePermissions';
import { useNotifications } from '../hooks/useNotifications';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import { logger } from '../utils/logger';
import DataTable from '../components/DataTable';
import HeaderActionButton from '../components/HeaderActionButton';
import { Edit, Trash2, Plus, Upload, Download, FileText } from 'lucide-react';

const SuppliersPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { success: showSuccess, error: showError } = useNotifications();
  const importInputRef = useRef(null);

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getSuppliers();
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        setSuppliers(response.data.data);
        setError('');
      } else if (Array.isArray(response.data)) {
        setSuppliers(response.data);
        setError('');
      } else {
        setSuppliers([]);
        setError('Belum ada data supplier.');
      }
    } catch (_err) {
      console.warn('Failed to fetch suppliers from API, trying SQLite cache:', _err.message);
      if (window.electronAPI?.dbSelect) {
        try {
          const sqliteSuppliers = await window.electronAPI.dbSelect({ table: 'suppliers' });
          if (sqliteSuppliers && Array.isArray(sqliteSuppliers) && sqliteSuppliers.length > 0) {
            setSuppliers(sqliteSuppliers);
            setError('');
          } else {
            setError('Belum ada data supplier. Hubungkan ke internet untuk mengunduh data pertama kali.');
          }
        } catch (sqliteErr) {
          setError('Gagal memuat data supplier dari cache lokal');
          console.error('SQLite fallback error:', sqliteErr);
        }
      } else {
        setError('Gagal memuat data supplier.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleDelete = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus supplier ini?')) return;

    try {
      await deleteSupplier(id);
      setSuppliers((prev) => prev.filter((s) => s.id_supplier !== id));
      showSuccess('Supplier berhasil dihapus.');
    } catch (_err) {
      showError('Gagal menghapus supplier.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Supplier');
      worksheet.columns = [
        { header: 'Nama Supplier', key: 'nama_supplier', width: 30 },
        { header: 'Kontak', key: 'kontak', width: 20 },
        { header: 'Alamat', key: 'alamat', width: 50 },
      ];
      suppliers.forEach((supplier) => {
        worksheet.addRow({
          nama_supplier: supplier.nama_supplier,
          kontak: supplier.kontak,
          alamat: supplier.alamat,
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'supplier.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('Export Excel supplier berhasil.');
    } catch (err) {
      logger.error('Gagal export Excel:', err);
      showError('Gagal export Excel. Cek console untuk detail.');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Template Supplier');
      worksheet.columns = [
        { header: 'Nama Supplier', key: 'nama_supplier', width: 30 },
        { header: 'Kontak', key: 'kontak', width: 20 },
        { header: 'Alamat', key: 'alamat', width: 50 },
      ];
      worksheet.addRow({
        nama_supplier: 'PT. Contoh Supplier',
        kontak: '081234567890',
        alamat: 'Jl. Contoh No. 123, Jakarta',
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_supplier.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess('Template supplier berhasil diunduh.');
    } catch (err) {
      logger.error('Gagal download template:', err);
      showError('Gagal download template.');
    }
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet(1);

      const importedSuppliers = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const supplier = {
          nama_supplier: row.getCell(1).value,
          kontak: row.getCell(2).value || '',
          alamat: row.getCell(3).value || '',
        };
        if (supplier.nama_supplier) importedSuppliers.push(supplier);
      });

      if (importedSuppliers.length === 0) {
        showError('Tidak ada data supplier yang valid di file Excel.');
        return;
      }

      const confirmImport = window.confirm(`Apakah Anda ingin mengimpor ${importedSuppliers.length} supplier?`);
      if (!confirmImport) return;

      try {
        const response = await bulkImportSuppliers(importedSuppliers);
        if (response.data?.success) {
          showSuccess(`Berhasil mengimpor ${response.data.data.length} supplier.`);
          await fetchSuppliers();
        } else {
          showError(`Gagal mengimpor supplier: ${response.data?.message || 'Terjadi kesalahan.'}`);
        }
      } catch (importError) {
        logger.error('Gagal import bulk:', importError);
        showError(`Gagal mengimpor supplier: ${importError.response?.data?.message || importError.message}`);
      }
    } catch (err) {
      logger.error('Gagal import Excel:', err);
      showError('Gagal import Excel. Pastikan file format benar.');
    } finally {
      event.target.value = '';
    }
  };



  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Supplier"
          subtitle="Kelola daftar supplier, impor data, dan ekspor laporan dengan cepat"
          actions={[
            ...(hasPermission('inventory') ? [
              <HeaderActionButton
                key="add"
                icon={Plus}
                label="Tambah Supplier"
                variant="slate"
                to="/supplier/tambah"
                isLink
                hideLabel={true}
              />
            ] : []),
            <HeaderActionButton
              key="export"
              icon={Download}
              label="Export"
              variant="emerald"
              onClick={handleExportExcel}
              hideLabel={true}
            />,
            <HeaderActionButton
              key="import"
              icon={Upload}
              label="Import"
              variant="amber"
              onClick={() => importInputRef.current?.click()}
              hideLabel={true}
            />,
            <HeaderActionButton
              key="template"
              icon={FileText}
              label="Template"
              variant="slate"
              onClick={handleDownloadTemplate}
              hideLabel={true}
            />
          ]}
        />

        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImportExcel}
          style={{ display: 'none' }}
        />

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">Total Supplier</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{suppliers.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">Total Supplier</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">{suppliers.length}</p>
            </div>
          </div>

          <DataTable
            data={suppliers}
            loading={loading}
            error={error}
            columns={[
              {
                key: 'id_supplier',
                header: 'ID Supplier',
                render: (supplier) => supplier.id_supplier
              },
              {
                key: 'nama_supplier',
                header: 'Nama Supplier',
                render: (supplier) => supplier.nama_supplier
              },
              {
                key: 'kontak',
                header: 'Kontak',
                render: (supplier) => supplier.kontak
              },
              {
                key: 'alamat',
                header: 'Alamat',
                render: (supplier) => supplier.alamat
              }
            ]}
            actions={[
              {
                icon: Edit,
                title: 'Edit',
                onClick: (supplier) => {
                  // Navigate to edit page
                  navigate(`/supplier/edit/${supplier.id_supplier}`);
                },
                variant: 'primary',
                size: 'sm'
              },
              {
                icon: Trash2,
                title: 'Hapus',
                onClick: (supplier) => handleDelete(supplier.id_supplier),
                variant: 'danger',
                size: 'sm'
              }
            ]}
            searchPlaceholder="Cari supplier berdasarkan nama, kontak, atau alamat..."
            emptyMessage="Tidak ada supplier yang cocok. Coba ubah kata kunci pencarian atau tambahkan supplier baru."
            loadingMessage="Memuat data supplier..."
            itemsPerPage={20}
            alwaysShowPagination={true}
          />
        </div>
      </PageContainer>
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImportExcel}
        className="hidden"
      />
    </PageLayout>
  );
};

export default SuppliersPage;