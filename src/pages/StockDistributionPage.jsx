import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { distributeStock, getStockReport, searchProducts } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import ActionButton from '../components/ActionButton';
import HeaderActionButton from '../components/HeaderActionButton';
import { exportToExcel } from '../utils/exportHelper';
import { ArrowLeft, Trash2, Plus, X, Loader, Download } from 'lucide-react';

const StockDistributionPage = () => {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [stockInfo, setStockInfo] = useState({});
  
  const [selectedProduct, setSelectedProduct] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [distributionItems, setDistributionItems] = useState([{ id_cabang: '', jumlah: 1 }]);

  // Autocomplete states
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const productSearchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    try {
      if (!stockInfo || Object.keys(stockInfo).length === 0) {
        setError('Tidak ada data stok untuk diekspor');
        return;
      }

      const exportData = Object.entries(stockInfo).map(([id_produk, info]) => ({
        'ID Produk': id_produk,
        'Stok Gudang': info.gudang || 0,
        'Total Stok Cabang': Object.values(info.cabang || {}).reduce((sum, stok) => sum + stok, 0),
        'Jumlah Cabang': Object.keys(info.cabang || {}).length
      }));

      const filename = `Data_Stok_Distribusi_${new Date().toISOString().split('T')[0]}.xlsx`;
      await exportToExcel(exportData, filename);
      setSuccess('Data stok berhasil diekspor ke Excel');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setError('Gagal mengekspor data stok');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get stock report for detailed stock info
        const stockReportRes = await getStockReport();
        const stockData = stockReportRes.data.data || [];
        
        // Build stock info map
        const stockMap = {};
        stockData.forEach(product => {
          stockMap[product.id_produk] = {
            gudang: product.detail_lokasi?.gudang || 0,
            cabang: {}
          };
          if (product.detail_lokasi?.cabang) {
            product.detail_lokasi.cabang.forEach(c => {
              stockMap[product.id_produk].cabang[c.id_cabang] = c.stok || 0;
            });
          }
        });
        setStockInfo(stockMap);

        // Get branches only (products will be loaded via search)
        const branchesRes = await apiClient.get('/cabang');
        setBranches(branchesRes.data.data || []);
      } catch (_err) {
        setError('Gagal memuat data master untuk form distribusi.');
      }
    };
    fetchData();
  }, []);

  const handleItemChange = (index, field, value) => {
    const newItems = [...distributionItems];
    if (field === 'jumlah') {
      // Pastikan jumlah disimpan sebagai angka yang valid
      newItems[index][field] = value === '' ? 1 : (isNaN(parseInt(value, 10)) ? 1 : parseInt(value, 10));
    } else {
      newItems[index][field] = value;
    }
    setDistributionItems(newItems);
  };

  // Product search functions
  const handleProductSearch = useCallback(async (searchTerm) => {
    if (searchTerm.length < 2) {
      setProductSearchResults([]);
      setShowProductDropdown(false);
      return;
    }

    try {
      setIsSearchingProducts(true);
      setShowProductDropdown(true);
      const response = await searchProducts(searchTerm, 20);
      
      // API returns: { success: true, data: [...], meta: {...} }
      // But searchProducts function handles this and returns array directly
      let results = [];
      
      if (Array.isArray(response)) {
        // If searchProducts returns array directly
        results = response;
      } else if (response?.data && Array.isArray(response.data)) {
        // If it returns { data: [...] } structure
        results = response.data;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        // Nested structure fallback
        results = response.data.data;
      }
      setProductSearchResults(results);
    } catch (error) {
      console.error('❌ Product search failed:', error);
      setProductSearchResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  }, []);

  const handleProductSelect = (product) => {
    setSelectedProduct(product.id_produk.toString());
    setProductSearchTerm(`${product.nama_produk} (${product.kode_produk})`);
    setShowProductDropdown(false);
    setProductSearchResults([]);
  };

  const handleProductSearchChange = useCallback((value) => {
    setProductSearchTerm(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.length >= 2) {
      setShowProductDropdown(true); // Show dropdown immediately when typing
      // Debounce search
      searchTimeoutRef.current = setTimeout(() => {
        handleProductSearch(value);
      }, 300);
    } else {
      setProductSearchResults([]);
      setShowProductDropdown(false);
    }
  }, [handleProductSearch]);

  const clearProductSelection = () => {
    setSelectedProduct('');
    setProductSearchTerm('');
    setShowProductDropdown(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target)) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const addItem = () => {
    setDistributionItems([...distributionItems, { id_cabang: '', jumlah: 1 }]);
  };

  const removeItem = (index) => {
    setDistributionItems(distributionItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // --- VALIDASI SISI KLIEN ---
    if (!selectedProduct) {
      setError('Produk harus dipilih.');
      return;
    }
    if (distributionItems.some(item => !item.id_cabang || item.jumlah <= 0)) {
      setError('Setiap tujuan harus memiliki cabang yang dipilih dan jumlah lebih dari 0.');
      return;
    }

    const totalDistribusi = distributionItems.reduce((sum, item) => sum + parseInt(item.jumlah), 0);
    const stokGudang = stockInfo[selectedProduct]?.gudang || 0;

    if (totalDistribusi > stokGudang) {
      setError(`Total distribusi (${totalDistribusi}) melebihi stok gudang (${stokGudang}).`);
      return;
    }

    setIsLoading(true);

    try {
      // Buat array dari promise, satu untuk setiap item distribusi
      const distributionPromises = distributionItems.map(item => {
        const singleMutationData = {
          dari_cabang: null, // Selalu dari gudang
          ke_cabang: parseInt(item.id_cabang),
          id_produk: parseInt(selectedProduct),
          jumlah: parseInt(item.jumlah),
          keterangan: keterangan || `Distribusi dari gudang ke cabang ID ${item.id_cabang}`
        };
        // Panggil API untuk setiap mutasi
        return distributeStock(singleMutationData);
      });

      // Jalankan semua promise secara bersamaan
      await Promise.all(distributionPromises);

      setSuccess('Distribusi stok berhasil disimpan!');
      setTimeout(() => navigate('/'), 2000);

    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan distribusi stok.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentWarehouseStock = selectedProduct ? (stockInfo[selectedProduct]?.gudang || 0) : 0;
  const currentBranchStocks = selectedProduct ? (stockInfo[selectedProduct]?.cabang || {}) : {};
  const totalBranchStock = Object.values(currentBranchStocks).reduce((sum, stock) => sum + (stock || 0), 0);
  const totalStock = currentWarehouseStock + totalBranchStock;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Distribusi Stok dari Gudang"
          subtitle="Distribusikan produk dari gudang pusat ke cabang-cabang"
          actions={[
            <HeaderActionButton
              key="export"
              icon={Download}
              label="Export Data Stok"
              variant="emerald"
              onClick={handleExport}
              hideLabel={true}
            />,
            <HeaderActionButton
              key="back"
              icon={ArrowLeft}
              label="Kembali"
              variant="slate"
              onClick={() => navigate('/stok')}
              hideLabel={true}
            />
          ]}
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
              <Loader className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Header Distribusi */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Produk</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Produk yang Akan Didistribusi
                </label>
                <div className="relative" ref={productSearchRef}>
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearchTerm}
                      onChange={(e) => handleProductSearchChange(e.target.value)}
                      onFocus={() => {
                        if (productSearchTerm.length >= 2) {
                          if (productSearchResults.length > 0) {
                            setShowProductDropdown(true);
                          } else if (!isSearchingProducts) {
                            // Trigger search if we don't have results yet
                            handleProductSearch(productSearchTerm);
                          }
                        }
                      }}
                      placeholder="Ketik minimal 2 karakter untuk mencari produk..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-8"
                      required={!!selectedProduct}
                    />
                    {selectedProduct && (
                      <button
                        type="button"
                        onClick={clearProductSelection}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {isSearchingProducts && (
                      <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                        <Loader className="w-4 h-4 text-blue-500 animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Dropdown */}
                  {showProductDropdown && productSearchTerm.length >= 2 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {isSearchingProducts ? (
                        <div className="px-3 py-4 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                            Mencari produk...
                          </div>
                        </div>
                      ) : productSearchResults.length > 0 ? (
                        productSearchResults.map((product) => {
                          const warehouseStock = stockInfo[product.id_produk]?.gudang || 0;
                          return (
                            <div
                              key={product.id_produk}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => handleProductSelect(product)}
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{product.nama_produk}</div>
                                  <div className="text-sm text-gray-500">{product.kode_produk}</div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-medium ${warehouseStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Stok: {warehouseStock}
                                  </div>
                                  {product.merek && (
                                    <div className="text-xs text-gray-400">{product.merek}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-4 text-center text-gray-500">
                          Tidak ada produk ditemukan
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Hidden input for form validation */}
                <input
                  type="hidden"
                  value={selectedProduct}
                  required
                />
                {selectedProduct && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-800">Stok Tersedia di Gudang Pusat</p>
                        <p className="text-2xl font-bold text-blue-600">{currentWarehouseStock}</p>
                        <p className="text-xs text-blue-600 mt-1">Total stok keseluruhan: {totalStock} unit</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-blue-600">Unit</p>
                        <p className={`text-sm font-medium ${currentWarehouseStock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {currentWarehouseStock > 0 ? '✓ Tersedia' : '✗ Habis'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contoh: Pengisian stok mingguan"
                />
              </div>
            </div>
          </div>

          {/* Detail Tujuan */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tujuan Distribusi</h3>

            {/* Table Container */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Cabang Tujuan</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Jumlah</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">Stok Saat Ini</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {distributionItems.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                        <p>Belum ada tujuan distribusi. Klik tombol tambah untuk memulai.</p>
                      </td>
                    </tr>
                  ) : (
                    distributionItems.map((item, index) => {
                      const branchStock = selectedProduct ? (stockInfo[selectedProduct]?.cabang?.[item.id_cabang] || 0) : 0;
                      return (
                        <tr key={index} className="border-b border-gray-200 hover:bg-blue-50 transition">
                          <td className="px-4 py-3">
                            <select
                              value={item.id_cabang}
                              onChange={(e) => handleItemChange(index, 'id_cabang', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                              <option value="" disabled>Pilih Cabang</option>
                              {branches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.nama_cabang}</option>)}
                            </select>
                          </td>

                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.jumlah}
                              onChange={(e) => handleItemChange(index, 'jumlah', e.target.value)}
                              className="w-16 px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mx-auto"
                            />
                          </td>

                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {branchStock} unit
                          </td>

                          <td className="px-4 py-3 text-center">
                            <ActionButton
                              icon={Trash2}
                              variant="danger"
                              title="Hapus tujuan distribusi"
                              onClick={() => removeItem(index)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tambah Tujuan Distribusi
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/stok')}
              className="flex-1 bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-gray-600 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading || !selectedProduct}
              className="flex-1 bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Distribusi'
              )}
            </button>
          </div>
        </form>
      </PageContainer>
    </PageLayout>
  );
};

export default StockDistributionPage;