import React, { useState, useEffect } from 'react';
import { Download, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getStock } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import HeaderActionButton from '../components/HeaderActionButton';
import { exportToExcel } from '../utils/exportHelper';

const StockViewKasirPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success: showSuccess, error: showError } = useNotifications();
  const [branchStock, setBranchStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchStock = async () => {
      try {
        setLoading(true);
        const stockRes = await getStock();
        const allStock = stockRes.data.data || [];
        const branchOnly = allStock.filter(item => item.id_cabang === user?.id_cabang);
        setBranchStock(branchOnly);
      } catch {
        setError('Gagal memuat data stok.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id_cabang) {
      fetchStock();
    } else {
      setError('Cabang tidak ditetapkan untuk akun Anda. Hubungi admin untuk mengatur cabang.');
      setLoading(false);
    }
  }, [user?.id_cabang]);

  const getStockStatus = (stok) => {
    if (stok === 0) return { status: 'habis', label: 'Habis', color: 'text-red-600', badge: 'bg-red-500' };
    if (stok <= 5) return { status: 'kritis', label: 'Kritis', color: 'text-orange-600', badge: 'bg-orange-500' };
    if (stok <= 10) return { status: 'rendah', label: 'Rendah', color: 'text-yellow-600', badge: 'bg-yellow-500' };
    return { status: 'normal', label: 'Normal', color: 'text-green-600', badge: 'bg-green-500' };
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      if (!branchStock || branchStock.length === 0) {
        showError('Tidak ada data untuk diekspor');
        return;
      }

      const exportData = branchStock.map(item => {
        const status = getStockStatus(item.stok);
        return {
          'Kode Produk': item.Produk?.kode_produk || '',
          'Nama Produk': item.Produk?.nama_produk || '',
          'Lokasi Rak': item.lokasi_rak || '',
          'Stok': item.stok || 0,
          'Status': status.label
        };
      });

      const branchName = branchStock[0]?.Cabang?.nama_cabang || user?.Cabang?.nama_cabang || 'N/A';
      const filename = `Stok_Cabang_${branchName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await exportToExcel(exportData, filename);
      showSuccess('Data berhasil diekspor ke Excel');
    } catch (err) {
      console.error('Export failed:', err);
      showError('Gagal mengekspor data');
    } finally {
      setIsExporting(false);
    }
  };


  const totalProducts = branchStock.length;
  const outOfStock = branchStock.filter(item => item.stok === 0).length;
  const lowStock = branchStock.filter(item => item.stok > 0 && item.stok <= 10).length;
  const normalStock = totalProducts - outOfStock - lowStock;
  const branchName = branchStock[0]?.Cabang?.nama_cabang || user?.Cabang?.nama_cabang || 'N/A';

  if (loading) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="text-center py-20 text-gray-600">Memuat data stok...</div>
        </PageContainer>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="text-center py-20 text-red-600">{error}</div>
        </PageContainer>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Stok Cabang"
          subtitle={`Cabang: ${branchName}`}
          actions={
            <HeaderActionButton
              icon={Download}
              label="Export Excel"
              variant="emerald"
              onClick={handleExport}
              loading={isExporting}
              title="Download data stok ke Excel"
            />
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white p-3 rounded-lg shadow border-l-4 border-blue-500">
            <p className="text-gray-600 text-xs">Total Produk</p>
            <p className="text-2xl font-bold text-blue-600">{totalProducts}</p>
          </div>
          <div className="bg-white p-3 rounded-lg shadow border-l-4 border-green-500">
            <p className="text-gray-600 text-xs">Stok Normal</p>
            <p className="text-2xl font-bold text-green-600">{normalStock}</p>
          </div>
          <div className="bg-white p-3 rounded-lg shadow border-l-4 border-yellow-500">
            <p className="text-gray-600 text-xs">Stok Rendah</p>
            <p className="text-2xl font-bold text-yellow-600">{lowStock}</p>
          </div>
          <div className="bg-white p-3 rounded-lg shadow border-l-4 border-red-500">
            <p className="text-gray-600 text-xs">Stok Habis</p>
            <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          data={branchStock}
          loading={loading}
          error={error}
          showPagination={true}
          itemsPerPage={20}
          searchPlaceholder="Cari produk atau kode..."
          searchKeys={['Produk.nama_produk', 'Produk.kode_produk']}
          filters={[
            {
              key: 'status',
              label: 'Status Stok',
              type: 'select',
              options: [
                { value: '', label: 'Semua Status' },
                { value: 'normal', label: 'Stok Normal' },
                { value: 'rendah', label: 'Stok Rendah' },
                { value: 'kritis', label: 'Stok Kritis' },
                { value: 'habis', label: 'Stok Habis' }
              ],
              defaultValue: ''
            }
          ]}
          columns={[
            {
              key: 'produk',
              header: 'Produk',
              render: (item) => (
                <div>
                  <div className="font-medium text-gray-800">{item.Produk?.nama_produk || 'N/A'}</div>
                  <div className="text-xs text-gray-500">Kode: {item.Produk?.kode_produk || '-'}</div>
                </div>
              )
            },
            {
              key: 'lokasi_rak',
              header: 'Lokasi Rak',
              render: (item) => <span className="text-center block">{item.lokasi_rak || '-'}</span>
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
                return <StatusBadge status={status.status} label={status.label} />;
              }
            }
          ]}
          actions={[
            {
              icon: Clock,
              title: 'Riwayat Stok',
              onClick: (item) => navigate(`/stok/history/${item.id_cabang}/${item.id_produk}`),
              variant: 'primary',
              size: 'sm'
            }
          ]}
          emptyMessage="Tidak ada data stok di cabang ini"
        />

        {/* Information Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Panduan Status Stok</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-green-500"></span><strong>Stok Normal:</strong> lebih dari 10 unit</li>
            <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span><strong>Stok Rendah:</strong> 6-10 unit</li>
            <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span><strong>Stok Kritis:</strong> 1-5 unit</li>
            <li className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-red-500"></span><strong>Stok Habis:</strong> 0 unit</li>
          </ul>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default StockViewKasirPage;
