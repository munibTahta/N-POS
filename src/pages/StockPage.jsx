import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStock, getWarehouseStock, adjustStock, updateWarehouseStock, updateBranchStock } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { handleError } from '../utils/errorHandler';
import { withErrorBoundary } from '../components/withErrorBoundary';
import { exportToExcel } from '../utils/exportHelper';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import HeaderActionButton from '../components/HeaderActionButton';
import { MapPin, Warehouse, Pencil, Clock, AlertCircle, AlertTriangle, Info, Download, ArrowDownUp, Share2 } from 'lucide-react';

const StockAdjustmentModal = ({ item, onClose, onAdjust }) => {
  const { success: _showSuccess, error: _showError } = useNotifications();
  const [stok_baru, setStokBaru] = useState(item.stok || item.jumlah || 0);
  const [keterangan, setKeterangan] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onAdjust({
      id_cabang: item.id_cabang || null,
      id_produk: item.id_produk,
      stok_baru,
      keterangan,
    });
  };

  const cabangName = item.Cabang?.nama_cabang || (item.id_cabang ? `Cabang ID ${item.id_cabang}` : 'Gudang Pusat');
  const produkName = item.Produk?.nama_produk || item.nama_produk || 'Produk Tidak Diketahui';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Penyesuaian Stok</h2>
        <p className="mb-2"><strong>Produk:</strong> {produkName}</p>
        <p className="mb-4"><strong>Lokasi:</strong> {cabangName}</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block font-medium">Stok Saat Ini</label>
            <input type="number" value={item.stok || item.jumlah || 0} disabled className="w-full p-2 border rounded bg-gray-100" />
          </div>
          <div className="mb-4">
            <label className="block font-medium">Stok Baru (Hasil Opname)</label>
            <input type="number" value={stok_baru} onChange={(e) => setStokBaru(Number(e.target.value))} required className="w-full p-2 border rounded" />
          </div>
          <div className="mb-4">
            <label className="block font-medium">Keterangan/Alasan</label>
            <textarea value={keterangan} onChange={(e) => setKeterangan(e.target.value)} required className="w-full p-2 border rounded" rows="3"></textarea>
          </div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-gray-300 px-4 py-2 rounded">Batal</button>
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Simpan Penyesuaian</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditLocationModal = ({ item, onClose, onSave, newLocation, setNewLocation }) => {
  if (!item) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  const cabangName = item.Cabang?.nama_cabang || (item.id_cabang ? `Cabang ID ${item.id_cabang}` : 'Gudang Pusat');
  const produkName = item.Produk?.nama_produk || item.nama_produk || 'Produk Tidak Diketahui';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[9999]">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-4">Edit Lokasi Rak</h2>
        <p className="mb-2"><strong>Produk:</strong> {produkName}</p>
        <p className="mb-4"><strong>Lokasi:</strong> {cabangName}</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block font-medium">Lokasi Rak</label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Contoh: Rak A1, Shelf B2"
              className="w-full p-2 border rounded"
            />
          </div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-gray-300 px-4 py-2 rounded">Batal</button>
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StockPage = () => {
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useNotifications();
  const { user } = useAuth();
  const [branchStock, setBranchStock] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState('cabang'); // 'cabang' atau 'gudang'

  // Edit location modal
  const [editingLocation, setEditingLocation] = useState(null);
  const [newLocation, setNewLocation] = useState('');

  const fetchStock = async () => {
    try {
      setLoading(true);
      const [branchStockRes, warehouseStockRes] = await Promise.all([
        getStock(),
        getWarehouseStock()
      ]);
      setBranchStock(branchStockRes.data.data || []);
      setWarehouseStock(warehouseStockRes.data.data || []); // PERBAIKAN: Ambil data dari .data.data
    } catch {
      setError('Gagal memuat data stok.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLocation = async (item) => {
    setEditingLocation(item);
    setNewLocation(item.lokasi_rak || '');
  };

  const handleSaveLocation = async () => {
    try {
      // Use correct endpoint based on active tab
      if (activeTab === 'cabang') {
        // For branch stock: PUT /api/stok-cabang/:id_cabang/:id_produk
        await updateBranchStock(
          editingLocation.id_cabang,
          editingLocation.id_produk,
          { lokasi_rak: newLocation }
        );
      } else {
        // For warehouse stock: PUT /api/stok-gudang/:id_produk
        await updateWarehouseStock({
          id_produk: editingLocation.id_produk,
          lokasi_rak: newLocation
        });
      }
      setEditingLocation(null);
      setNewLocation('');
      await fetchStock(); // Refresh data
      showSuccess('Lokasi rak berhasil diperbarui');
    } catch (error) {
      handleError(error);
      showError('Gagal memperbarui lokasi rak');
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const handleExport = async () => {
    try {
      const currentData = activeTab === 'cabang' ? branchStock : warehouseStock;
      if (!currentData || currentData.length === 0) {
        showError('Tidak ada data untuk diekspor');
        return;
      }

      // Apply current filters (simulating DataTable filtering)
      let filteredData = [...currentData];

      // Note: In a real implementation, we would get filtered data from DataTable component
      // For now, export all data with status calculation

      const exportData = filteredData.map(item => {
        if (activeTab === 'cabang') {
          const status = getStockStatus(item.stok);
          return {
            'Kode Produk': item.Produk?.kode_produk || '',
            'Nama Produk': item.Produk?.nama_produk || '',
            'Cabang': item.Cabang?.nama_cabang || '',
            'Stok': item.stok || 0,
            'Lokasi Rak': item.lokasi_rak || '',
            'Status': status.status
          };
        } else {
          const status = getStockStatus(item.jumlah);
          return {
            'Kode Produk': item.Produk?.kode_produk || '',
            'Nama Produk': item.Produk?.nama_produk || '',
            'Stok Gudang': item.jumlah || 0,
            'Lokasi Rak': item.lokasi_rak || '',
            'Status': status.status
          };
        }
      });

      const filename = `Laporan_Stok_${activeTab === 'cabang' ? 'Cabang' : 'Gudang'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await exportToExcel(exportData, filename);
      showSuccess('Data berhasil diekspor ke Excel');
    } catch (error) {
      console.error('Export failed:', error);
      showError('Gagal mengekspor data');
    }
  };

  const handleAdjust = async (adjustmentData) => {
    try {
      await adjustStock(adjustmentData);
      setSelectedItem(null);
      fetchStock(); // Muat ulang data stok setelah penyesuaian
    } catch (_err) {
      handleError(_err);
      showError('Gagal melakukan penyesuaian stok');
    }
  };

  // Helper function untuk determine status stok
  const getStockStatus = (stok) => {
    if (stok === 0) return { status: 'HABIS', color: 'text-red-600', bgColor: 'bg-red-50', badge: 'bg-red-500' };
    if (stok <= 5) return { status: 'KRITIS', color: 'text-red-600', bgColor: 'bg-red-50', badge: 'bg-red-500' };
    if (stok <= 10) return { status: 'RENDAH', color: 'text-orange-600', bgColor: 'bg-orange-50', badge: 'bg-orange-500' };
    return { status: 'NORMAL', color: 'text-green-600', bgColor: 'bg-green-50', badge: 'bg-green-500' };
  };

  // Calculate summary untuk branch stock
  const branchSummary = {
    total: branchStock.length,
    outOfStock: branchStock.filter(item => item.stok === 0).length,
    critical: branchStock.filter(item => item.stok > 0 && item.stok <= 5).length,
    low: branchStock.filter(item => item.stok > 5 && item.stok <= 10).length,
    normal: branchStock.filter(item => item.stok > 10).length,
  };

  // Calculate summary untuk warehouse stock
  const warehouseSummary = {
    total: warehouseStock.length,
    outOfStock: warehouseStock.filter(item => item.jumlah === 0).length,
    low: warehouseStock.filter(item => item.jumlah > 0 && item.jumlah <= 20).length,
    normal: warehouseStock.filter(item => item.jumlah > 20).length,
  };

  if (loading) return <div className="text-center mt-10">Loading...</div>;
  if (error) return <div className="text-center mt-10 text-red-500">{error}</div>;

  return (
    <PageLayout>
      {selectedItem && <StockAdjustmentModal item={selectedItem} onClose={() => setSelectedItem(null)} onAdjust={handleAdjust} />}

      <PageHeader
        title="Manajemen Stok"
        subtitle={`Admin: ${user?.nama_lengkap || user?.username}`}
        actions={
          <div className="flex gap-3 flex-wrap">
            <HeaderActionButton
              icon={Download}
              label="Export Excel"
              variant="emerald"
              onClick={handleExport}
              title="Download data stok ke Excel"
            />
            <HeaderActionButton
              icon={ArrowDownUp}
              label="Distribusi"
              variant="blue"
              to="/stok/distribusi"
              isLink={true}
              title="Distribusi stok dari gudang"
            />
            <HeaderActionButton
              icon={Share2}
              label="Transfer"
              variant="orange"
              to="/stok/transfer"
              isLink={true}
              title="Transfer stok antar cabang"
            />
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
          <p className="text-gray-500 text-xs font-medium">Total Produk</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{activeTab === 'cabang' ? branchSummary.total : warehouseSummary.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-green-500">
          <p className="text-gray-500 text-xs font-medium">Stok Normal</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{activeTab === 'cabang' ? branchSummary.normal : warehouseSummary.normal}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-yellow-500">
          <p className="text-gray-500 text-xs font-medium">Stok Rendah</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{activeTab === 'cabang' ? branchSummary.low : warehouseSummary.low}</p>
        </div>
        {activeTab === 'cabang' && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-orange-500">
            <p className="text-gray-500 text-xs font-medium">Stok Kritis</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{branchSummary.critical}</p>
          </div>
        )}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-red-500">
          <p className="text-gray-500 text-xs font-medium">Stok Habis</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{activeTab === 'cabang' ? branchSummary.outOfStock : warehouseSummary.outOfStock}</p>
        </div>
      </div>

      <PageContainer>
        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveTab('cabang')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'cabang' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <MapPin className="w-4 h-4" />Stok Cabang
          </button>
          <button
            onClick={() => setActiveTab('gudang')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'gudang' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <Warehouse className="w-4 h-4" />Stok Gudang Pusat
          </button>
        </nav>
      </div>

          {/* Stock Table - Branch dengan DataTable */}
          {activeTab === 'cabang' && (
            <>
              <DataTable
                data={branchStock}
                loading={loading}
                error={error}
                showPagination={true}
                searchPlaceholder="Cari produk atau cabang..."
                searchKeys={['Produk.nama_produk', 'Cabang.nama_cabang']}
                filters={[
                  {
                    key: 'status_stok',
                    label: 'Status Stok',
                    type: 'select',
                    options: [
                      { value: '', label: 'Semua Status' },
                      { value: 'normal', label: 'Stok Normal' },
                      { value: 'low', label: 'Stok Rendah' },
                      { value: 'critical', label: 'Stok Kritis' },
                      { value: 'out', label: 'Stok Habis' }
                    ],
                    defaultValue: ''
                  }
                ]}
                itemsPerPage={20}
                columns={[
                  {
                    key: 'produk',
                    header: 'Produk',
                    render: (item) => (
                      <div>
                        <div className="font-medium text-gray-800">{item.Produk?.nama_produk || 'N/A'}</div>
                        <div className="text-xs text-gray-500">ID: {item.id_produk}</div>
                      </div>
                    )
                  },
                  {
                    key: 'cabang',
                    header: 'Cabang',
                    render: (item) => <p className="font-medium">{item.Cabang?.nama_cabang || 'N/A'}</p>
                  },
                  {
                    key: 'lokasi_rak',
                    header: 'Lokasi Rak',
                    render: (item) => (
                      <div className="flex items-center justify-center gap-2 text-center">
                        <span>{item.lokasi_rak || 'N/A'}</span>
                        <button
                          onClick={() => handleEditLocation(item)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit Lokasi Rak"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  },
                  {
                    key: 'stok',
                    header: 'Stok',
                    render: (item) => <span className="text-lg font-bold text-center block">{item.stok}</span>
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (item) => {
                      const status = getStockStatus(item.stok);
                      return (
                        <StatusBadge status={status.status.toLowerCase()} label={status.status} />
                      );
                    }
                  }
                ]}
                actions={[
                  {
                    icon: Pencil,
                    title: 'Sesuaikan Stok',
                    onClick: (item) => setSelectedItem(item),
                    variant: 'primary',
                    size: 'sm'
                  },
                  {
                    icon: Clock,
                    title: 'Riwayat',
                    onClick: (item) => navigate(`/stok/history/${item.id_cabang}/${item.id_produk}`),
                    variant: 'primary',
                    size: 'sm'
                  }
                ]}
                emptyMessage="Tidak ada data stok cabang"
              />

              {/* Alerts */}
              {branchSummary.outOfStock > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Perhatian - Stok Habis</h3>
                  <p className="text-sm text-red-800">
                    Terdapat <strong>{branchSummary.outOfStock} produk</strong> yang stoknya habis di beberapa cabang. 
                    Silakan lakukan distribusi dari gudang pusat.
                  </p>
                </div>
              )}

              {branchSummary.critical > 0 && (
                <div className="mt-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h3 className="font-semibold text-orange-900 mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Perhatian - Stok Kritis</h3>
                  <p className="text-sm text-orange-800">
                    Terdapat <strong>{branchSummary.critical} produk</strong> dengan stok kritis (1-5 unit). 
                    Segera lakukan pengisian ulang stok.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Stock Table - Warehouse dengan DataTable */}
          {activeTab === 'gudang' && (
            <>
              <DataTable
                data={warehouseStock}
                loading={loading}
                error={error}
                showPagination={true}
                searchPlaceholder="Cari produk..."
                searchKeys={['Produk.nama_produk']}
                filters={[
                  {
                    key: 'status_stok',
                    label: 'Status Stok',
                    type: 'select',
                    options: [
                      { value: '', label: 'Semua Status' },
                      { value: 'normal', label: 'Stok Normal' },
                      { value: 'low', label: 'Stok Rendah' },
                      { value: 'out', label: 'Stok Habis' }
                    ],
                    defaultValue: ''
                  }
                ]}
                itemsPerPage={20}
                columns={[
                  {
                    key: 'produk',
                    header: 'Produk',
                    render: (item) => (
                      <div>
                        <div className="font-medium text-gray-800">{item.Produk?.nama_produk || 'N/A'}</div>
                        <div className="text-xs text-gray-500">ID: {item.id_produk}</div>
                      </div>
                    )
                  },
                  {
                    key: 'lokasi_rak',
                    header: 'Lokasi Rak',
                    render: (item) => (
                      <div className="flex items-center justify-center gap-2 text-center">
                        <span>{item.lokasi_rak || 'N/A'}</span>
                        <button
                          onClick={() => handleEditLocation(item)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit Lokasi Rak"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  },
                  {
                    key: 'jumlah',
                    header: 'Jumlah Stok',
                    render: (item) => <span className="text-lg font-bold text-center block">{item.jumlah}</span>
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (item) => {
                      const status = item.jumlah === 0 
                        ? { status: 'HABIS', badge: 'bg-red-500' }
                        : item.jumlah <= 20 
                        ? { status: 'RENDAH', badge: 'bg-yellow-500' }
                        : { status: 'NORMAL', badge: 'bg-green-500' };
                      return (
                        <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${status.badge}`}>
                          {status.status}
                        </span>
                      );
                    }
                  }
                ]}
                actions={[
                  {
                    icon: Pencil,
                    title: 'Sesuaikan Stok',
                    onClick: (item) => setSelectedItem(item),
                    variant: 'primary',
                    size: 'sm'
                  }
                ]}
                emptyMessage="Tidak ada data stok gudang"
              />

              {warehouseSummary.outOfStock > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Perhatian - Stok Gudang Habis</h3>
                  <p className="text-sm text-red-800">
                    Terdapat <strong>{warehouseSummary.outOfStock} produk</strong> yang stoknya habis di gudang pusat. 
                    Perlu segera melakukan pemesanan ke supplier.
                  </p>
                </div>
              )}
            </>
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
        />
      )}

      {/* Information Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2"><Info className="w-5 h-5" />Panduan Status Stok</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-green-500"></span><strong>Stok Normal:</strong> Cabang &gt; 10 unit | Gudang &gt; 20 unit</li>
          <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span><strong>Stok Rendah:</strong> Cabang 1-10 unit | Gudang 1-20 unit (perlu pengisian)</li>
          <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span><strong>Stok Kritis:</strong> Cabang 1-5 unit (segera isi ulang)</li>
          <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-red-500"></span><strong>Stok Habis:</strong> 0 unit (harus segera distribusi/pesan)</li>
        </ul>
      </div>
      </PageContainer>
    </PageLayout>
  );
};

const StockPageWithErrorBoundary = withErrorBoundary(StockPage, 'StockPage');

export default StockPageWithErrorBoundary;