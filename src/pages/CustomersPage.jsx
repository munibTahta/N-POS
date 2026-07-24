import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addPelanggan, updatePelanggan, deletePelanggan, getPelanggan, bulkImportPelanggan, bulkDeletePelanggan } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { handleError } from '../utils/errorHandler';
import { withErrorBoundary } from '../components/withErrorBoundary';
import ExcelJS from 'exceljs';
import { SearchFilterBar } from '../components/SearchFilterBar';
import { FilterPanel, FilterPanelGrid, FilterField } from '../components/FilterPanel';
import Pagination from '../components/Pagination';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import { usePagination } from '../hooks/usePagination';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import DataTable from '../components/DataTable';
import HeaderActionButton from '../components/HeaderActionButton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { Eye, Edit, Trash2, Plus, Download, Upload, FileText } from 'lucide-react';

const CustomersPage = () => {
  const navigate = useNavigate();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Hapus',
    onConfirm: null,
    variant: 'danger'
  });
  const { success: showSuccess, error: showError, warning: showWarning } = useNotifications();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    nama_pelanggan: '',
    email: '',
    no_telp: '',
    alamat: '',
    tipe_pelanggan: 'regular'
  });
  const [_errorMsg, setErrorMsg] = useState('');
  const [_successMsg, setSuccessMsg] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [importProgress, setImportProgress] = useState({ active: false, current: 0, total: 0, successCount: 0, failCount: 0 });
  const [importOptions, setImportOptions] = useState({ ignoreDuplicates: true, updateDuplicates: false });
  const [showImportOptionsModal, setShowImportOptionsModal] = useState(false);
  const [excelDataToImport, setExcelDataToImport] = useState(null);

  // Server-side pagination and filter state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState({ tipe_pelanggan: '' });

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, customers]);
  
  const fetchCustomersData = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = {
        skip_pagination: false,
        page,
        limit,
        search: searchQuery || undefined,
        tipe_pelanggan: filterValues.tipe_pelanggan || undefined
      };
      
      const resp = await getPelanggan(params);
      let data = [];
      let total = 0;
      
      if (resp?.data && resp.data.success) {
        data = resp.data.data || [];
        total = resp.data.pagination?.total || data.length;
      } else if (Array.isArray(resp?.data)) {
        data = resp.data;
        total = data.length;
      } else {
        const payload = resp?.data?.data || resp?.data?.results || [];
        data = Array.isArray(payload) ? payload : [];
        total = data.length;
      }
      
      setCustomers(data);
      setTotalItems(total);
    } catch (_err) {
      // Fallback to SQLite when offline and cache is empty
      console.warn('Failed to fetch customers from API, trying SQLite cache:', _err.message);
      if (window.electronAPI?.dbSelect) {
        try {
          let whereClause = '1=1';
          const whereValues = [];
          
          if (searchQuery) {
            whereClause += ` AND (nama_pelanggan LIKE ? OR email LIKE ? OR nomor_hp LIKE ? OR alamat LIKE ?)`;
            const term = `%${searchQuery}%`;
            whereValues.push(term, term, term, term);
          }
          if (filterValues.tipe_pelanggan) {
            whereClause += ` AND tipe_pelanggan = ?`;
            whereValues.push(filterValues.tipe_pelanggan);
          }

          const sqliteCustomers = await window.electronAPI.dbSelect({
            table: 'customers',
            whereClause,
            whereValues
          });
          
          if (sqliteCustomers && Array.isArray(sqliteCustomers)) {
            setTotalItems(sqliteCustomers.length);
            const offset = (page - 1) * limit;
            const paginatedLocal = sqliteCustomers.slice(offset, offset + limit);
            setCustomers(paginatedLocal);
            setErrorMsg('');
          } else {
            setErrorMsg('Belum ada data pelanggan. Hubungkan ke internet untuk mengunduh data pertama kali.');
          }
        } catch (sqliteErr) {
          setErrorMsg('Gagal memuat data pelanggan dari cache lokal');
          console.error('SQLite fallback error:', sqliteErr);
        }
      } else {
        setErrorMsg('Gagal memuat data pelanggan. Pastikan Anda terhubung ke internet.');
        console.error('Error fetching customers:', _err);
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, filterValues]);

  useEffect(() => {
    fetchCustomersData();
  }, [fetchCustomersData]);

  const fetchCustomers = async () => {
    // Use the new cache-aware fetch function
    await fetchCustomersData();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await updatePelanggan(editingCustomer.id_pelanggan, formData);
        setSuccessMsg('Pelanggan berhasil diperbarui');
      } else {
        await addPelanggan(formData);
        setSuccessMsg('Pelanggan berhasil ditambahkan');
      }
      fetchCustomers();
      resetForm();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Gagal menyimpan data pelanggan');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      nama_pelanggan: customer.nama_pelanggan,
      email: customer.email || '',
      no_telp: customer.no_telp || '',
      alamat: customer.alamat || '',
      tipe_pelanggan: customer.tipe_pelanggan || 'regular'
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Pelanggan',
      message: 'Apakah Anda yakin ingin menghapus pelanggan ini?',
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deletePelanggan(id);
          setSuccessMsg('Pelanggan berhasil dihapus');
          fetchCustomers();
        } catch {
          setErrorMsg('Gagal menghapus pelanggan');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const resetForm = () => {
    setFormData({
      nama_pelanggan: '',
      email: '',
      no_telp: '',
      alamat: '',
      tipe_pelanggan: 'regular'
    });
    setEditingCustomer(null);
    setShowForm(false);
  };

  // Handler untuk export Excel
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Pelanggan');

      // Header
      worksheet.columns = [
        { header: 'Nama Pelanggan', key: 'nama_pelanggan', width: 25 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'No. Telepon', key: 'no_telp', width: 15 },
        { header: 'Alamat', key: 'alamat', width: 40 },
        { header: 'Tipe Pelanggan', key: 'tipe_pelanggan', width: 15 },
      ];

      // Data
      customers.forEach(customer => {
        worksheet.addRow({
          nama_pelanggan: customer.nama_pelanggan,
          email: customer.email || '',
          no_telp: customer.no_telp || '',
          alamat: customer.alamat || '',
          tipe_pelanggan: customer.tipe_pelanggan || 'regular',
        });
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pelanggan.xlsx';
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
      const worksheet = workbook.addWorksheet('Template Pelanggan');

      // Header
      worksheet.columns = [
        { header: 'Nama Pelanggan', key: 'nama_pelanggan', width: 25 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'No. Telepon', key: 'no_telp', width: 15 },
        { header: 'Alamat', key: 'alamat', width: 40 },
        { header: 'Tipe Pelanggan', key: 'tipe_pelanggan', width: 15 },
      ];

      // Contoh data
      worksheet.addRow({
        nama_pelanggan: 'Ahmad Surya',
        email: 'ahmad@example.com',
        no_telp: '081234567890',
        alamat: 'Jl. Malioboro No. 1, Yogyakarta',
        tipe_pelanggan: 'regular',
      });

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_pelanggan.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      handleError(error);
      showError('Gagal download template');
    }
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet(1);

      const importedCustomers = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const getCellString = (colIndex) => {
          const val = row.getCell(colIndex).value;
          if (val && typeof val === 'object' && 'result' in val) {
            return val.result != null ? val.result.toString().trim() : '';
          }
          return val != null ? val.toString().trim() : '';
        };

        const customer = {
          nama_pelanggan: getCellString(1),
          email: getCellString(2),
          no_telp: getCellString(3),
          alamat: getCellString(4),
          tipe_pelanggan: getCellString(5) || 'regular',
        };

        if (customer.nama_pelanggan) {
          importedCustomers.push(customer);
        }
      });

      if (importedCustomers.length === 0) {
        showWarning('Tidak ada data pelanggan yang valid di file Excel');
        setLoading(false);
        return;
      }

      setExcelDataToImport(importedCustomers);
      setShowImportOptionsModal(true);
    } catch (error) {
      handleError(error);
      showError('Gagal memproses file Excel. Pastikan file format benar');
    } finally {
      setLoading(false);
      event.target.value = ''; // Reset input
    }
  };

  const processBulkImport = async (customersList, options) => {
    setShowImportOptionsModal(false);
    setImportProgress({ active: true, current: 0, total: customersList.length, successCount: 0, failCount: 0 });

    const chunkSize = 500; // Optimal client-side chunk size
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < customersList.length; i += chunkSize) {
      const chunk = customersList.slice(i, i + chunkSize);
      try {
        const response = await bulkImportPelanggan(chunk, {
          ignoreDuplicates: options.ignoreDuplicates,
          updateDuplicates: options.updateDuplicates
        });
        
        if (response.data?.success) {
          successCount += response.data.data?.length || chunk.length;
        } else {
          failCount += chunk.length;
        }
      } catch (err) {
        failCount += chunk.length;
      }
      
      setImportProgress(prev => ({
        ...prev,
        current: Math.min(i + chunkSize, customersList.length),
        successCount,
        failCount
      }));
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    await fetchCustomersData();
    showSuccess(`Import selesai! Berhasil: ${successCount}, Gagal: ${failCount}`);
    
    setTimeout(() => {
      setImportProgress(prev => ({ ...prev, active: false }));
      setExcelDataToImport(null);
    }, 5000);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Massal Pelanggan',
      message: `Apakah Anda yakin ingin menghapus ${selectedIds.length} pelanggan terpilih?`,
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsDeletingBulk(true);
          const response = await bulkDeletePelanggan(selectedIds);
          if (response.data?.success) {
            showSuccess(`Berhasil menghapus ${selectedIds.length} pelanggan`);
            setSelectedIds([]);
            fetchCustomersData();
          } else {
            showError(`Gagal menghapus pelanggan: ${response.data?.message || 'Unknown error'}`);
          }
        } catch (err) {
          handleError(err);
          showError('Gagal melakukan hapus massal');
        } finally {
          setIsDeletingBulk(false);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (loading) return <div className="text-center mt-10">Memuat data pelanggan...</div>;

  return (
    <PageLayout>
      <PageHeader
        title="Manajemen Pelanggan"
        subtitle="Kelola data pelanggan dan informasi kontak"
        actions={
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isDeletingBulk}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded shadow transition"
              >
                <Trash2 className="h-4 w-4" />
                Hapus ({selectedIds.length})
              </button>
            )}
            <HeaderActionButton
              icon={Plus}
              label="Tambah"
              variant="slate"
              onClick={() => setShowForm(true)}
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
              onClick={() => document.getElementById('import-excel').click()}
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
        }
      />

      {showForm && (
        <PageContainer className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Pelanggan *</label>
                <input
                  type="text"
                  value={formData.nama_pelanggan}
                  onChange={(e) => setFormData({...formData, nama_pelanggan: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">No. Telepon</label>
                <input
                  type="text"
                  value={formData.no_telp}
                  onChange={(e) => setFormData({...formData, no_telp: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipe Pelanggan</label>
                <select
                  value={formData.tipe_pelanggan}
                  onChange={(e) => setFormData({...formData, tipe_pelanggan: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="regular">Regular</option>
                  <option value="member">Member</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Alamat</label>
              <textarea
                value={formData.alamat}
                onChange={(e) => setFormData({...formData, alamat: e.target.value})}
                className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-xs sm:text-sm font-semibold px-6 py-2 hover:bg-blue-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="hidden sm:inline ml-2">{editingCustomer ? 'Update' : 'Simpan'}</span>
                <span className="sm:hidden">{editingCustomer ? 'Update' : 'Simpan'}</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-full bg-slate-500 text-white text-xs sm:text-sm font-semibold px-6 py-2 hover:bg-slate-600 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline ml-2">Batal</span>
              </button>
            </div>
          </form>
        </PageContainer>
      )}

      <PageContainer>
        <input
          type="file"
          id="import-excel"
          accept=".xlsx,.xls"
          onChange={handleImportExcel}
          style={{ display: 'none' }}
        />

        {importProgress.active && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-amber-900">Mengimpor Data Pelanggan...</span>
              <span className="text-xs text-amber-700 font-semibold">
                {importProgress.current} / {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-amber-200 rounded-full h-3">
              <div
                className="bg-amber-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-amber-700 mt-2 font-medium">
              <span>Berhasil: <span className="text-emerald-700">{importProgress.successCount}</span></span>
              <span>Gagal: <span className="text-red-700">{importProgress.failCount}</span></span>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {_errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {_errorMsg}
          </div>
        )}
        {_successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {_successMsg}
          </div>
        )}

        {/* Data Table dengan Internal Search, Filter, dan Pagination */}
        <DataTable
          data={customers}
          loading={loading}
          error={null}
          showPagination={true}
          selectable={true}
          selectedRows={selectedIds}
          onSelectedRowsChange={setSelectedIds}
          serverSide={true}
          totalItems={totalItems}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
          onSearchChange={setSearchQuery}
          onFilterValueChange={(values) => { setFilterValues(values); setPage(1); }}
          searchPlaceholder="Cari pelanggan berdasarkan nama, email, telepon..."
          searchKeys={['nama_pelanggan', 'email', 'no_telp', 'alamat']}
          filters={[
            {
              key: 'tipe_pelanggan',
              label: 'Tipe Pelanggan',
              type: 'select',
              options: [
                { value: '', label: 'Semua Tipe' },
                { value: 'regular', label: 'Regular' },
                { value: 'member', label: 'Member' },
                { value: 'vip', label: 'VIP' }
              ]
            }
          ]}
          filterGridCols={2}
          itemsPerPage={20}
          columns={[
            {
              key: 'nama_pelanggan',
              header: 'Nama',
              render: (customer) => (
                <div>
                  <div className="text-sm font-medium text-gray-900">{customer.nama_pelanggan}</div>
                  {customer.alamat && (
                    <div className="text-sm text-gray-500 truncate max-w-xs">{customer.alamat}</div>
                  )}
                </div>
              )
            },
            {
              key: 'kontak',
              header: 'Kontak',
              render: (customer) => (
                <div>
                  <div className="text-sm text-gray-900">{customer.email || '-'}</div>
                  <div className="text-sm text-gray-500">{customer.no_telp || '-'}</div>
                </div>
              )
            },
            {
              key: 'tipe_pelanggan',
              header: 'Tipe',
              render: (customer) => (
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  customer.tipe_pelanggan === 'vip' ? 'bg-purple-100 text-purple-800' :
                  customer.tipe_pelanggan === 'member' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {customer.tipe_pelanggan || 'regular'}
                </span>
              )
            }
          ]}
          actions={[
            {
              icon: Eye,
              title: 'Lihat Detail',
              onClick: (customer) => {
                navigate(`/pelanggan/${customer.id_pelanggan}`);
              },
              variant: 'primary',
              size: 'sm'
            },
            {
              icon: Edit,
              title: 'Edit',
              onClick: (customer) => handleEdit(customer),
              variant: 'primary',
              size: 'sm'
            },
            {
              icon: Trash2,
              title: 'Hapus',
              onClick: (customer) => handleDelete(customer.id_pelanggan),
              variant: 'danger',
              size: 'sm'
            }
          ]}
          emptyMessage={customers.length === 0 ? 'Belum ada data pelanggan' : 'Tidak ada pelanggan yang sesuai dengan filter'}
        />
      </PageContainer>
      {showImportOptionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Pengaturan Impor Excel</h2>
            <p className="text-sm text-slate-500 mb-4">
              File Excel memiliki <strong className="text-slate-800">{excelDataToImport?.length}</strong> baris pelanggan yang valid.
            </p>
            
            <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="importOption"
                  checked={importOptions.ignoreDuplicates}
                  onChange={() => setImportOptions({ ignoreDuplicates: true, updateDuplicates: false })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Abaikan duplikat</span>
                  <p className="text-xs text-slate-500">Lewati baris jika nomor HP / email sudah terdaftar.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer pt-3 border-t border-slate-200">
                <input
                  type="radio"
                  name="importOption"
                  checked={importOptions.updateDuplicates}
                  onChange={() => setImportOptions({ ignoreDuplicates: false, updateDuplicates: true })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Perbarui duplikat</span>
                  <p className="text-xs text-slate-500">Perbarui data pelanggan di database jika nomor HP / email cocok.</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowImportOptionsModal(false); setExcelDataToImport(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => processBulkImport(excelDataToImport, importOptions)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition"
              >
                Mulai Impor
              </button>
            </div>
          </div>
        </div>
      )}

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

const CustomersPageWithErrorBoundary = withErrorBoundary(CustomersPage, 'CustomersPage');

export default CustomersPageWithErrorBoundary;