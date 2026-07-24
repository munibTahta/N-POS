import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCategories, deleteCategory, bulkImportCategories } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { usePermissions } from '../hooks/usePermissions';
import { handleError } from '../utils/errorHandler';
import ResponsiveTable from '../components/common/ResponsiveTable';
import { SearchFilterBar, FilterPanel, FilterPanelGrid } from '../components/SearchFilterBar';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import HeaderActionButton from '../components/HeaderActionButton';
import { Plus, Download, Upload, FileText } from 'lucide-react';
import ExcelJS from 'exceljs';
import ConfirmDialog from '../components/common/ConfirmDialog';

const AddIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
  </svg>
);

const ExportIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ImportIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const TemplateIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </svg>
);

const EditIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const DeleteIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const CategoriesPage = () => {
  const { canManageProducts } = usePermissions();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Hapus',
    onConfirm: null,
    variant: 'danger'
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterDescription, setFilterDescription] = useState('all');
  const { success: showSuccess, error: showError, warning, info: _info } = useNotifications();

  useEffect(() => {
    if (!canManageProducts) {
      setError('Anda tidak memiliki izin untuk mengakses manajemen kategori produk.');
      setLoading(false);
      return;
    }

    const fetchCategories = async () => {
      try {
        const response = await getCategories();
        // Handle dua kemungkinan struktur respons: array langsung atau objek { success, data }
        if (response.data && response.data.success && Array.isArray(response.data.data)) {
          setCategories(response.data.data);
        } else if (Array.isArray(response.data)) {
          // Fallback jika API mengembalikan array langsung
          setCategories(response.data);
        } else {
          setCategories([]);
        }
      } catch (_err) {
        // Fallback to SQLite when offline and cache is empty
        console.warn('Failed to fetch categories from API, trying SQLite cache:', _err.message);
        if (window.electronAPI?.dbSelect) {
          try {
            const sqliteCategories = await window.electronAPI.dbSelect({
              table: 'categories'
            });
            if (sqliteCategories && Array.isArray(sqliteCategories) && sqliteCategories.length > 0) {
              setCategories(sqliteCategories);
              setError('');
            } else {
              setError('Belum ada data kategori. Hubungkan ke internet untuk mengunduh data pertama kali.');
              showError('Belum ada data kategori');
            }
          } catch (sqliteErr) {
            setError('Gagal memuat data kategori dari cache lokal');
            showError('Gagal memuat data kategori');
            console.error('SQLite fallback error:', sqliteErr);
          }
        } else {
          setError('Gagal memuat data kategori.');
          showError('Gagal memuat data kategori');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [showError, canManageProducts]);

  const handleDelete = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Kategori',
      message: 'Apakah Anda yakin ingin menghapus kategori ini? Ini mungkin akan mempengaruhi produk terkait.',
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteCategory(id);
          setCategories(categories.filter(c => c.id_kategori !== id));
          setMessage('Kategori berhasil dihapus.');
          showSuccess('Kategori berhasil dihapus');
        } catch (err) {
          handleError(err);
          setMessage('Gagal menghapus kategori.');
          setError('Gagal menghapus kategori.');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const { filteredItems: filteredCategories } = useSearchAndFilter(categories, {
    searchTerm: searchQuery,
    searchKeys: ['nama_kategori', 'deskripsi', 'id_kategori'],
    filters: {
      category: filterDescription === 'all' ? '' : filterDescription,
    },
    filterFns: {
      category: (item, value) => {
        if (!value) return true;
        return item.id_kategori === value;
      },
    },
    debounceDelay: 300,
  });

  const { currentData: paginatedCategories, currentPage, totalPages, setPage, itemsPerPage } = usePagination({
    data: filteredCategories,
    itemsPerPage: 20,
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterDescription, setPage]);

  // Handler untuk export Excel
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Kategori');

      // Header
      worksheet.columns = [
        { header: 'ID Kategori', key: 'id_kategori', width: 15 },
        { header: 'Nama Kategori', key: 'nama_kategori', width: 30 },
        { header: 'Deskripsi', key: 'deskripsi', width: 50 },
      ];

      // Data
      categories.forEach(category => {
        worksheet.addRow({
          id_kategori: category.id_kategori,
          nama_kategori: category.nama_kategori,
          deskripsi: category.deskripsi || '',
        });
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kategori.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      handleError(error);
      showError('Gagal export Excel');
    }
  };

  // Handler untuk download template
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Template Kategori');

      // Header
      worksheet.columns = [
        { header: 'Nama Kategori', key: 'nama_kategori', width: 30 },
        { header: 'Deskripsi', key: 'deskripsi', width: 50 },
      ];

      // Contoh data
      worksheet.addRow({
        nama_kategori: 'Contoh Kategori',
        deskripsi: 'Deskripsi kategori contoh',
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_kategori.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      handleError(error);
      showError('Gagal download template');
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

      const importedCategories = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const category = {
          nama_kategori: row.getCell(1).value?.toString().trim(),
          deskripsi: row.getCell(2).value?.toString().trim() || '',
        };

        if (category.nama_kategori) {
          importedCategories.push(category);
        }
      });

      if (importedCategories.length === 0) {
        warning('Tidak ada data kategori yang valid di file Excel');
        return;
      }

      setConfirmDialog({
        isOpen: true,
        title: 'Impor Kategori',
        message: `Apakah Anda ingin mengimpor ${importedCategories.length} kategori?`,
        confirmText: 'Ya, Impor',
        variant: 'info',
        onConfirm: async () => {
          try {
            const response = await bulkImportCategories(importedCategories);
            if (response.data.success) {
              setMessage(`Berhasil mengimpor ${response.data.data.length} kategori`);
              showSuccess(`Berhasil mengimpor ${response.data.data.length} kategori`);
              // Refresh daftar kategori
              const updatedCategories = await getCategories();
              if (updatedCategories.data && updatedCategories.data.success && Array.isArray(updatedCategories.data.data)) {
                setCategories(updatedCategories.data.data);
              } else if (Array.isArray(updatedCategories.data)) {
                setCategories(updatedCategories.data);
              }
            } else {
              setMessage(`Gagal mengimpor kategori: ${response.data.message}`);
              showError(`Gagal mengimpor kategori: ${response.data.message}`);
            }
          } catch (importError) {
            handleError(importError);
            if (importError.response?.status === 404 || importError.response?.status === 500) {
              showError(`Fitur import bulk belum tersedia. Status: ${importError.response?.status}`);
            } else {
              showError(`Gagal mengimpor kategori: ${importError.response?.data?.message || importError.message}`);
            }
          } finally {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          }
        }
      });
    } catch (error) {
      handleError(error);
      showError('Gagal import Excel. Pastikan file format benar');
    } finally {
      event.target.value = ''; // Reset input
    }
  };

  if (loading) return <div className="text-center mt-10">Loading...</div>;
  if (error) return <div className="text-center mt-10 text-red-500">{error}</div>;

  return (
    <PageLayout>
      <PageHeader
        title="Manajemen Kategori Produk"
        subtitle="Kelola kategori produk untuk mengorganisir inventaris dengan mudah dan efisien."
        actions={
          canManageProducts && (
            <div className="flex gap-2">
              <HeaderActionButton
                icon={Plus}
                label="Tambah"
                variant="slate"
                to="/kategori/tambah"
                isLink
                hideLabel={true}
              />
              <HeaderActionButton
                icon={Download}
                label="Export"
                variant="emerald"
                onClick={handleExportExcel}
                hideLabel={true}
              />
              <HeaderActionButton
                icon={Upload}
                label="Import"
                variant="yellow"
                onClick={() => document.getElementById('import-excel-kategori').click()}
                hideLabel={true}
              />
              <HeaderActionButton
                icon={FileText}
                label="Template"
                variant="gray"
                onClick={handleDownloadTemplate}
                hideLabel={true}
              />
            </div>
          )
        }
      />

      {/* Hidden file input for import */}
      <input
        type="file"
        id="import-excel-kategori"
        accept=".xlsx,.xls"
        onChange={handleImportExcel}
        style={{ display: 'none' }}
      />

      {message && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Kategori</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{categories.length.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Hasil Filter</p>
            <p className="mt-2 text-3xl font-bold text-sky-700">{filteredCategories.length.toLocaleString()}</p>
          </div>
        </div>

        <PageContainer>
          <SearchFilterBar
            searchTerm={searchQuery}
            onSearchChange={setSearchQuery}
            onClearSearch={() => setSearchQuery('')}
            onFilterToggle={() => setShowFilters((prev) => !prev)}
            isFilterActive={showFilters}
            hasActiveFilters={filterDescription !== 'all'}
            onClearFilters={() => {
              setFilterDescription('all');
              setSearchQuery('');
            }}
            searchPlaceholder="Cari nama kategori atau deskripsi..."
            className="mb-4"
          />

          <FilterPanel visible={showFilters} className="mb-6">
            <FilterPanelGrid cols={1} className="gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Filter Kategori</label>
                <select
                  value={filterDescription}
                  onChange={(e) => setFilterDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Semua Kategori</option>
                  {categories.map((category) => (
                    <option key={category.id_kategori} value={category.id_kategori}>
                      {category.nama_kategori} {category.deskripsi ? `— ${category.deskripsi}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </FilterPanelGrid>
          </FilterPanel>

          <ResponsiveTable>
            <table className="min-w-full divide-y divide-slate-200 bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nama Kategori</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Deskripsi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedCategories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                      Tidak ada kategori ditemukan.
                    </td>
                  </tr>
                ) : (
                  paginatedCategories.map((cat) => (
                    <tr key={cat.id_kategori} className="hover:bg-slate-50 transition">
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-mono text-slate-900">#{cat.id_kategori}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-900">{cat.nama_kategori}</td>
                      <td className="px-4 py-4 max-w-xs truncate text-sm text-slate-700">{cat.deskripsi || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/kategori/edit/${cat.id_kategori}`}
                            className="inline-flex items-center justify-center rounded-md bg-blue-100 text-blue-700 p-2 hover:bg-blue-200 transition"
                            title="Edit kategori"
                          >
                            <EditIcon className="w-4 h-4" />
                          </Link>
                          {canManageProducts && (
                            <button
                              onClick={() => handleDelete(cat.id_kategori)}
                              className="inline-flex items-center justify-center rounded-md bg-red-100 text-red-700 p-2 hover:bg-red-200 transition"
                              title="Hapus kategori"
                            >
                              <DeleteIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ResponsiveTable>

          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                itemsPerPage={itemsPerPage}
                totalItems={filteredCategories.length}
              />
            </div>
          )}
        </PageContainer>
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
    </PageLayout>
  );
};

export default CategoriesPage;