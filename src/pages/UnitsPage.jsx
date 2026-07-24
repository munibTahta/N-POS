import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUnits, deleteUnit, bulkImportUnits } from '../services/api';
import ExcelJS from 'exceljs';
import { logger } from '../utils/logger';
import ResponsiveTable from '../components/common/ResponsiveTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import { SearchFilterBar } from '../components/SearchFilterBar';
import HeaderActionButton from '../components/HeaderActionButton';
import ActionButton from '../components/ActionButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import { useNotifications } from '../hooks/useNotifications';
import { Plus, Download, Upload, FileText, Edit, Trash2 } from 'lucide-react';

const LoadingSpinner = () => (
  <svg className="w-8 h-8 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 0 20" />
  </svg>
);

const UnitsPage = () => {
  const navigate = useNavigate();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Hapus',
    onConfirm: null,
    variant: 'danger'
  });
  const { success: showSuccess, error: showError } = useNotifications();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const response = await getUnits();
        if (response.data && response.data.success) {
          setUnits(response.data.data);
        } else {
          setUnits([]);
        }
      } catch (_err) {
        // Fallback to SQLite when offline and cache is empty
        console.warn('Failed to fetch units from API, trying SQLite cache:', _err.message);
        if (window.electronAPI?.dbSelect) {
          try {
            const sqliteUnits = await window.electronAPI.dbSelect({
              table: 'units'
            });
            if (sqliteUnits && Array.isArray(sqliteUnits) && sqliteUnits.length > 0) {
              setUnits(sqliteUnits);
              setError('');
            } else {
              setError('Belum ada data satuan. Hubungkan ke internet untuk mengunduh data pertama kali.');
            }
          } catch (sqliteErr) {
            setError('Gagal memuat data satuan dari cache lokal');
            console.error('SQLite fallback error:', sqliteErr);
          }
        } else {
          setError('Gagal memuat data satuan.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUnits();
  }, []);

  // Search and filter
  const { filteredItems: filteredUnits } = useSearchAndFilter(units, {
    searchTerm: searchQuery,
    searchKeys: ['nama_satuan', 'id_satuan'],
    debounceDelay: 300,
  });

  const handleDelete = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Satuan',
      message: 'Apakah Anda yakin ingin menghapus satuan ini? Ini mungkin akan mempengaruhi produk terkait.',
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteUnit(id);
          setUnits(units.filter(u => u.id_satuan !== id));
          showSuccess('Satuan berhasil dihapus');
        } catch (_err) {
          showError('Gagal menghapus satuan.');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Handler untuk export Excel
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Satuan');

      // Header
      worksheet.columns = [
        { header: 'ID Satuan', key: 'id_satuan', width: 15 },
        { header: 'Nama Satuan', key: 'nama_satuan', width: 30 },
      ];

      // Data
      units.forEach(unit => {
        worksheet.addRow({
          id_satuan: unit.id_satuan,
          nama_satuan: unit.nama_satuan,
        });
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'satuan.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Gagal export Excel:', error);
      alert('Gagal export Excel. Lihat console untuk detail error.');
    }
  };

  // Handler untuk download template
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Template Satuan');

      // Header
      worksheet.columns = [
        { header: 'Nama Satuan', key: 'nama_satuan', width: 30 },
      ];

      // Contoh data
      worksheet.addRow({
        nama_satuan: 'Contoh Satuan',
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_satuan.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Gagal download template:', error);
      alert('Gagal download template. Lihat console untuk detail error.');
    }
  };

  // Handler untuk import Excel
  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet(1);

      const importedUnits = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const unit = {
          nama_satuan: row.getCell(1).value?.toString().trim(),
        };

        if (unit.nama_satuan) {
          importedUnits.push(unit);
        }
      });

      if (importedUnits.length === 0) {
        alert('Tidak ada data satuan yang valid di file Excel.');
        return;
      }

      setConfirmDialog({
        isOpen: true,
        title: 'Impor Satuan',
        message: `Apakah Anda ingin mengimpor ${importedUnits.length} satuan?`,
        confirmText: 'Ya, Impor',
        variant: 'info',
        onConfirm: async () => {
          try {
            const response = await bulkImportUnits(importedUnits);
            if (response.data.success) {
              showSuccess(`Berhasil mengimpor ${response.data.data.length} satuan.`);
              // Refresh daftar satuan
              const updatedUnits = await getUnits();
              if (updatedUnits.data && updatedUnits.data.success) {
                setUnits(updatedUnits.data.data);
              } else {
                setUnits([]);
              }
            } else {
              showError(`Gagal mengimpor satuan: ${response.data.message}`);
            }
          } catch (importError) {
            logger.error('Gagal import bulk:', importError);
            if (importError.response?.status === 404 || importError.response?.status === 500) {
              showError(`Fitur import bulk belum tersedia di server. Silakan hubungi administrator untuk mengaktifkan fitur ini.\n\nError: ${importError.response?.status} - ${importError.response?.statusText || 'Server Error'}`);
            } else {
              showError(`Gagal mengimpor satuan: ${importError.response?.data?.message || importError.message}`);
            }
          } finally {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
        }
      });
    } catch (error) {
      logger.error('Gagal import Excel:', error);
      alert('Gagal import Excel. Pastikan file format benar. Lihat console untuk detail error.');
    } finally {
      event.target.value = ''; // Reset input
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="inline-block">
                <LoadingSpinner />
              </div>
              <p className="mt-3 text-slate-600">Memuat data satuan...</p>
            </div>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Manajemen Satuan"
        subtitle="Kelola satuan ukuran produk untuk memudahkan pengelolaan inventori dan transaksi penjualan."
        actions={[
          <HeaderActionButton
            key="add"
            icon={Plus}
            label="Tambah Satuan"
            variant="blue"
            to="/satuan/tambah"
            isLink
            hideLabel={true}
          />,
          <HeaderActionButton
            key="export"
            icon={Download}
            label="Export Excel"
            variant="emerald"
            onClick={handleExportExcel}
            hideLabel={true}
          />,
          <HeaderActionButton
            key="import"
            icon={Upload}
            label="Import Excel"
            variant="amber"
            onClick={() => document.getElementById('import-excel-satuan').click()}
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
        type="file"
        id="import-excel-satuan"
        accept=".xlsx,.xls"
        onChange={handleImportExcel}
        style={{ display: 'none' }}
      />

      <div className="space-y-6">
        {/* Stats Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Satuan</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{units.length}</p>
        </div>

        {/* Search and Filter Section */}
        <PageContainer>
          <div className="space-y-4">
            <SearchFilterBar
              searchTerm={searchQuery}
              onSearchChange={setSearchQuery}
              onClearSearch={() => setSearchQuery('')}
              searchPlaceholder="Cari nama satuan atau ID..."
            />

            {/* Units Table */}
            <div className="overflow-x-auto border-t border-slate-200 pt-4">
              <ResponsiveTable>
                <table className="min-w-full divide-y divide-slate-200 bg-white">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID Satuan</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nama Satuan</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredUnits.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-500">
                          {searchQuery ? 'Tidak ada satuan ditemukan dengan pencarian Anda.' : 'Belum ada data satuan yang tersedia.'}
                        </td>
                      </tr>
                    ) : (
                      filteredUnits.map(unit => (
                        <tr key={unit.id_satuan} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-4 whitespace-nowrap font-mono text-sm font-medium text-slate-900">{unit.id_satuan}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{unit.nama_satuan}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex gap-2 justify-center items-center">
                              <ActionButton
                                icon={Edit}
                                title="Edit satuan"
                                onClick={() => navigate(`/satuan/edit/${unit.id_satuan}`)}
                                variant="primary"
                                size="sm"
                              />
                              <ActionButton
                                icon={Trash2}
                                title="Hapus satuan"
                                onClick={() => handleDelete(unit.id_satuan)}
                                variant="danger"
                                size="sm"
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ResponsiveTable>
            </div>
          </div>

          {/* Reusable Confirm Dialog */}
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            title={confirmDialog.title}
            message={confirmDialog.message}
            confirmText={confirmDialog.confirmText}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            variant={confirmDialog.variant}
          />
        </PageContainer>
      </div>
    </PageLayout>
  );
};

export default UnitsPage;