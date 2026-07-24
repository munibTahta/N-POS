import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adjustStock, updateWarehouseStock, getProducts } from '../services/api';
import { useStocks } from '../hooks/useStocks';
import { useNotifications } from '../hooks/useNotifications';
import { handleError } from '../utils/errorHandler';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import HeaderActionButton from '../components/HeaderActionButton';
import { logger } from '../utils/logger';
import { ArrowUpDown, ArrowDownUp, Edit, Clock, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const StockAdjustmentModal = ({ item, onClose, onAdjust, isSubmitting, categoryMap }) => {
  logger.info('StockAdjustmentModal item:', item);
  const [stok_baru, setStokBaru] = useState(item.jumlah || 0);
  const [keterangan, setKeterangan] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const adjustmentData = {
      id_produk: item.id_produk,
      stok_lama: item.jumlah,
      stok_baru,
      keterangan,
      id_cabang: item.id_cabang || null
    };
    logger.info('Sending adjustment data:', adjustmentData);
    await onAdjust(adjustmentData);
  };

  // Use same logic as table for consistency
  const getNamaKategori = () => {
    const fromData = item?.nama_kategori || item?.Produk?.Kategori?.nama_kategori || item?.kategori;
    const fromMap = categoryMap?.[item?.id_produk] || categoryMap?.[item?.id];
    return fromData || fromMap || '—';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-96 overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Penyesuaian Stok Gudang</h2>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-slate-600"><span className="font-medium">Produk:</span> {item.nama_produk || item.Produk?.nama_produk}</p>
            <p className="text-sm text-slate-600"><span className="font-medium">Kategori:</span> {getNamaKategori()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Stok Saat Ini</label>
            <input
              type="number"
              value={item.jumlah || 0}
              disabled
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Stok Baru (Hasil Opname)</label>
            <input
              type="number"
              value={stok_baru}
              onChange={(e) => setStokBaru(Number(e.target.value))}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Keterangan/Alasan</label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              required
              rows="3"
              placeholder="Contoh: Opname bulanan, koreksi sistem, dll."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 0 20" />
                </svg>
                Simpan...
              </>
            ) : (
              'Simpan Penyesuaian'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditLocationModal = ({ item, onClose, onSave, newLocation, setNewLocation, isSubmitting, categoryMap }) => {
  if (!item) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  // Use same logic as table for consistency
  const getNamaKategori = () => {
    const fromData = item?.nama_kategori || item?.Produk?.Kategori?.nama_kategori || item?.kategori;
    const fromMap = categoryMap?.[item?.id_produk] || categoryMap?.[item?.id];
    return fromData || fromMap || '—';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-96 overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Edit Lokasi Rak</h2>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-slate-600"><span className="font-medium">Produk:</span> {item.Produk?.nama_produk || item.nama_produk}</p>
            <p className="text-sm text-slate-600"><span className="font-medium">Kategori:</span> {getNamaKategori()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Lokasi Rak</label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Contoh: Rak A1, Shelf B2"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 0 20" />
                </svg>
                Simpan...
              </>
            ) : (
              'Simpan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


const StockGudangPage = () => {
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useNotifications();
  const [submittingModal, setSubmittingModal] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [newLocation, setNewLocation] = useState('');
  const [categoryMap, setCategoryMap] = useState({}); // Map id_produk -> nama_kategori
  const [filterValues, setFilterValues] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Stock cache hook - properly destructure all values
  const { stocks: warehouseStock = [], loading, error, refresh: refetchStocks, fetchStocks } = useStocks();

  // Fetch kategori data from products
  useEffect(() => {
    const fetchKategoriData = async () => {
      try {
        const response = await getProducts({ limit: 10000 });
        const products = Array.isArray(response?.data) ? response.data : response?.data?.data || [];

        const map = {};
        products.forEach(product => {
          map[product.id_produk || product.id] = product.Kategori?.nama_kategori || product.nama_kategori || '';
        });

        setCategoryMap(map);
      } catch (err) {
        console.error('[StockGudangPage] Failed to fetch kategori data:', err);
      }
    };

    fetchKategoriData();
  }, []);

  // Manually trigger fetch on mount
  useEffect(() => {
    logger.info('[StockGudangPage] Component mounted, triggering stock fetch');
    if (fetchStocks) {
      fetchStocks();
    }
  }, [fetchStocks]);

  useEffect(() => {
    logger.info('[StockGudangPage] Stock data updated:', {
      count: warehouseStock?.length || 0,
      loading,
      error,
      sampleData: warehouseStock?.[0]
    });
    if (warehouseStock?.[0]) {



    }
  }, [warehouseStock, loading, error]);

  const handleStockAdjustment = async (adjustmentData) => {
    try {
      setSubmittingModal(true);
      logger.info('Sending adjustment data:', adjustmentData);
      await adjustStock(adjustmentData);
      setAdjustingItem(null);
      await refetchStocks();
      showSuccess('Stok berhasil disesuaikan');
    } catch (err) {
      handleError(err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Gagal menyesuaikan stok';
      showError(`Gagal menyesuaikan stok: ${errorMessage}`);
    } finally {
      setSubmittingModal(false);
    }
  };

  const handleEditLocation = (item) => {
    setEditingLocation(item);
    setNewLocation(item.lokasi_rak || '');
  };

  const handleSaveLocation = async () => {
    try {
      setSubmittingModal(true);
      await updateWarehouseStock({
        id_produk: editingLocation.id_produk,
        lokasi_rak: newLocation
      });
      setEditingLocation(null);
      setNewLocation('');
      await refetchStocks();
      showSuccess('Lokasi rak berhasil diperbarui');
    } catch (err) {
      handleError(err);
      showError('Gagal memperbarui lokasi rak');
    } finally {
      setSubmittingModal(false);
    }
  };

  // Helper function to determine stock status
  const getStockStatus = (jumlah) => {
    if (jumlah === 0) return { label: 'Habis', badge: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700' };
    if (jumlah <= 5) return { label: 'Kritis', badge: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700' };
    if (jumlah <= 10) return { label: 'Rendah', badge: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700' };
    return { label: 'Normal', badge: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' };
  };

  // Export to Excel with filter support
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);

      // Apply filters to data (same logic as DataTable)
      let dataToExport = warehouseStock || [];

      // Apply status filter
      if (filterValues.status && filterValues.status !== 'all') {
        dataToExport = dataToExport.filter(item => {
          const status = getStockStatus(item.jumlah);
          const statusValue = status.label.toLowerCase().replace(/\s+/g, '-');
          return statusValue === filterValues.status.toLowerCase();
        });
      }

      // Apply search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        dataToExport = dataToExport.filter(item =>
          (item.nama_produk?.toLowerCase().includes(term)) ||
          (item.kode_produk?.toLowerCase().includes(term)) ||
          (item.nama_kategori?.toLowerCase().includes(term)) ||
          (item.lokasi_rak?.toLowerCase().includes(term))
        );
      }

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Stok Gudang', {
        pageSetup: { paperSize: 9, orientation: 'landscape' }
      });

      // Add title
      const titleRow = worksheet.addRow(['LAPORAN STOK GUDANG']);
      titleRow.font = { bold: true, size: 14 };
      titleRow.alignment = { horizontal: 'center', vertical: 'center' };
      worksheet.mergeCells('A1:E1');
      worksheet.getRow(1).height = 25;

      // Add filter info
      let filterInfo = '';
      if (filterValues.status && filterValues.status !== 'all') {
        filterInfo += `Status: ${filterValues.status.charAt(0).toUpperCase() + filterValues.status.slice(1)} | `;
      }
      if (searchTerm) {
        filterInfo += `Pencarian: ${searchTerm} | `;
      }
      if (filterInfo) {
        const infoRow = worksheet.addRow([filterInfo.slice(0, -3)]);
        infoRow.font = { italic: true, size: 10, color: { rgb: '666666' } };
        worksheet.mergeCells(`A2:E2`);
        worksheet.addRow([]);
      }

      // Add date
      const dateRow = worksheet.addRow([`Tanggal: ${new Date().toLocaleDateString('id-ID')}`]);
      dateRow.font = { size: 10 };
      worksheet.mergeCells(`A${worksheet.rowCount}:E${worksheet.rowCount}`);

      // Add headers
      const headers = ['Produk', 'Kode Produk', 'Kategori', 'Lokasi Rak', 'Stok', 'Status'];
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, color: { rgb: 'FFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: '1F2937' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'center' };

      // Add data rows
      dataToExport.forEach(item => {
        const status = getStockStatus(item.jumlah);
        worksheet.addRow([
          item.nama_produk || item.Produk?.nama_produk || '',
          item.kode_produk || item.Produk?.kode_produk || '',
          item.nama_kategori || item.Produk?.Kategori?.nama_kategori || categoryMap?.[item.id_produk] || '',
          item.lokasi_rak || '',
          item.jumlah || 0,
          status.label
        ]);
      });

      // Set column widths
      worksheet.columns = [
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 10 },
        { width: 12 }
      ];

      // Format data rows
      for (let i = 7; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        row.alignment = { horizontal: 'left', vertical: 'center' };
        row.borders = {
          top: { style: 'thin', color: { rgb: 'D1D5DB' } },
          left: { style: 'thin', color: { rgb: 'D1D5DB' } },
          bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
          right: { style: 'thin', color: { rgb: 'D1D5DB' } }
        };

        // Center align stok and status
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'center' };
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'center' };
      }

      // Format header row borders
      const headerRowNum = worksheet.rowCount - (dataToExport.length - 1);
      for (let i = 1; i <= 6; i++) {
        const cell = worksheet.getRow(headerRowNum).getCell(i);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }

      // Generate and save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `Stok-Gudang-${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(blob, filename);

      showSuccess(`Excel berhasil diekspor (${dataToExport.length} data)`);
    } catch (err) {
      console.error('[Export Excel Error]:', err);
      showError('Gagal mengekspor ke Excel');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Stok Gudang"
          subtitle="Kelola dan monitor persediaan stok barang di gudang pusat dengan pencarian, penyesuaian, dan riwayat lengkap."
          actions={
            <div className="flex gap-2">
              <HeaderActionButton
                icon={Download}
                label="Export Excel"
                variant="purple"
                onClick={handleExportExcel}
                loading={isExporting}
                disabled={loading || !warehouseStock?.length}
                hideLabel={true}
              />
              <HeaderActionButton
                icon={ArrowUpDown}
                label="Transfer Stok"
                variant="blue"
                to="/stok/transfer"
                isLink
                hideLabel={true}
              />
              <HeaderActionButton
                icon={ArrowDownUp}
                label="Distribusi Stok"
                variant="emerald"
                to="/stok/distribusi"
                isLink
                hideLabel={true}
              />
            </div>
          }
        />

        <DataTable
          data={warehouseStock || []}
          loading={loading}
          error={error?.message || error}
          showPagination={true}
          columns={[
            {
              key: 'nama_produk',
              header: 'Produk',
              render: (item) => (
                <div>
                  <div className="font-medium text-slate-900">{item.Produk?.nama_produk || item.nama_produk}</div>
                  <div className="text-xs text-slate-500">{item.Produk?.kode_produk || item.kode_produk}</div>
                </div>
              )
            },
            {
              key: 'nama_kategori',
              header: 'Kategori',
              render: (item) => {
                const fromData = item?.nama_kategori || item?.Produk?.Kategori?.nama_kategori || item?.kategori;
                const fromMap = categoryMap?.[item?.id_produk] || categoryMap?.[item?.id];
                const kategori = fromData || fromMap || '—';

                return kategori;
              }
            },
            {
              key: 'lokasi_rak',
              header: 'Lokasi Rak',
              render: (item) => item.lokasi_rak || '—'
            },
            {
              key: 'jumlah',
              header: 'Stok',
              render: (item) => (
                <div className="text-right font-semibold text-slate-900">{item.jumlah}</div>
              )
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => {
                const status = getStockStatus(item.jumlah);
                return (
                  <StatusBadge status={status.label.toLowerCase()} label={status.label} />
                );
              }
            }
          ]}
          actions={[
            {
              icon: Edit,
              title: 'Edit Lokasi',
              onClick: (item) => handleEditLocation(item),
              variant: 'primary',
              size: 'sm'
            },
            {
              icon: ArrowUpDown,
              title: 'Sesuaikan Stok',
              onClick: (item) => setAdjustingItem(item),
              variant: 'info',
              size: 'sm'
            },
            {
              icon: Clock,
              title: 'Riwayat',
              onClick: (item) => {
                navigate(`/stok/history/${item.id_cabang || 'gudang'}/${item.id_produk}`);
              },
              variant: 'success',
              size: 'sm'
            }
          ]}
          filters={[
            {
              key: 'status',
              label: 'Status Stok',
              type: 'select',
              options: [
                { value: 'all', label: 'Semua Status' },
                { value: 'normal', label: 'Normal' },
                { value: 'rendah', label: 'Rendah' },
                { value: 'kritis', label: 'Kritis' },
                { value: 'habis', label: 'Habis' }
              ]
            }
          ]}
          onFilterChange={(filterState) => {
            setSearchTerm(filterState.searchTerm);
            setFilterValues(filterState.filterValues);
          }}
        />
      </PageContainer>

      {/* Stock Adjustment Modal */}
      {adjustingItem && (
        <StockAdjustmentModal
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onAdjust={handleStockAdjustment}
          isSubmitting={submittingModal}
          categoryMap={categoryMap}
        />
      )}

      {/* Edit Location Modal */}
      {editingLocation && (
        <EditLocationModal
          item={editingLocation}
          onClose={() => {
            setEditingLocation(null);
            setNewLocation('');
          }}
          onSave={handleSaveLocation}
          newLocation={newLocation}
          setNewLocation={setNewLocation}
          isSubmitting={submittingModal}
          categoryMap={categoryMap}
        />
      )}
    </PageLayout>
  );
};

export default StockGudangPage;