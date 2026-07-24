import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Download, ArrowLeft } from 'lucide-react';
import { getBranches, transferStock, getStockReport, searchProducts } from '../services/api';
import { logger } from '../utils/logger';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import HeaderActionButton from '../components/HeaderActionButton';
import { exportToExcel } from '../utils/exportHelper';

const StockTransferPage = () => {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [stockInfo, setStockInfo] = useState({});
  const [transfer, setTransfer] = useState({
    id_produk: '',
    cabang_asal: '',
    cabang_tujuan: '',
    jumlah: 1,
    keterangan: '',
  });

  // Autocomplete states
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const productSearchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let branchesData = [];
        let stockData = [];

        // Try API first for branches and stock data
        try {
          const [branchesRes, stockReportRes] = await Promise.all([
            getBranches(),
            getStockReport()
          ]);
          branchesData = branchesRes.data.data || [];
          stockData = stockReportRes.data.data || [];
          logger.info('Stock transfer data loaded from API');
        } catch (apiError) {
          logger.info('API fetch failed for stock transfer, trying local database fallbacks:', apiError);

          // Fallback to local database for branches
          if (window.electronAPI?.dbSelect) {
            try {
              const localBranches = await window.electronAPI.dbSelect({
                table: 'branches',
                whereClause: '1=1',
                whereValues: []
              });
              if (localBranches && Array.isArray(localBranches)) {
                branchesData = localBranches;
              }
            } catch (dbError) {
              logger.info('Local database fallback for branches failed:', dbError);
            }
          }
        }

        setBranches(branchesData);
        setStockInfo(buildStockInfoMap(stockData));
      } catch (err) {
        logger.error('Failed to load transfer page data:', err);
        toast.error('Gagal memuat data untuk transfer stok.');
      }
    };
    fetchData();
  }, []);

  // Helper function to build stock info map
  const buildStockInfoMap = (stockData) => {
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
    return stockMap;
  };

  const handleExport = async () => {
    try {
      if (!stockInfo || Object.keys(stockInfo).length === 0) {
        toast.error('Tidak ada data stok untuk diekspor');
        return;
      }

      const exportData = Object.entries(stockInfo).map(([id_produk, info]) => ({
        'ID Produk': id_produk,
        'Stok Gudang': info.gudang || 0,
        'Total Stok Cabang': Object.values(info.cabang || {}).reduce((sum, stok) => sum + stok, 0),
        'Jumlah Cabang': Object.keys(info.cabang || {}).length
      }));

      const filename = `Data_Stok_Transfer_${new Date().toISOString().split('T')[0]}.xlsx`;
      await exportToExcel(exportData, filename);
      toast.success('Data stok berhasil diekspor ke Excel');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Gagal mengekspor data stok');
    }
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
      
      // searchProducts returns array directly
      let results = [];
      if (Array.isArray(response)) {
        results = response;
      } else if (response?.data && Array.isArray(response.data)) {
        results = response.data;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        results = response.data.data;
      }
      
      setProductSearchResults(results);
    } catch (error) {
      logger.error('Product search failed:', error);
      setProductSearchResults([]);
    } finally {
      setIsSearchingProducts(false);
    }
  }, []);

  const handleProductSelect = (product) => {
    setTransfer(prev => ({ ...prev, id_produk: product.id_produk.toString() }));
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
      setShowProductDropdown(true);
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
    setTransfer(prev => ({ ...prev, id_produk: '' }));
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    let parsedValue;
    if (['id_produk', 'cabang_asal', 'cabang_tujuan', 'jumlah'].includes(name)) {
      // Untuk field numerik, jika kosong simpan sebagai string kosong, jika valid simpan sebagai angka
      parsedValue = value === '' ? '' : (isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10));
    } else {
      parsedValue = value;
    }
    setTransfer(prev => ({ ...prev, [name]: parsedValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (transfer.cabang_asal === transfer.cabang_tujuan) {
      toast.error('Cabang asal dan tujuan tidak boleh sama.');
      return;
    }
    if (transfer.jumlah <= 0) {
      toast.error('Jumlah transfer harus lebih dari 0.');
      return;
    }
    const stokAsal = stockInfo[transfer.id_produk]?.cabang?.[transfer.cabang_asal] || 0;
    if (transfer.jumlah > stokAsal) {
      toast.error(`Jumlah transfer (${transfer.jumlah}) melebihi stok cabang asal (${stokAsal}).`);
      return;
    }

    try {
      const toastId = toast.loading('Memproses transfer stok...');
      const transferPayload = {
        dari_cabang: transfer.cabang_asal,
        ke_cabang: transfer.cabang_tujuan,
        id_produk: transfer.id_produk,
        jumlah: transfer.jumlah,
        keterangan: transfer.keterangan
      };
      await transferStock(transferPayload);
      toast.update(toastId, {
        render: 'Transfer stok berhasil diproses!',
        type: 'success',
        isLoading: false,
        autoClose: 3000
      });
      setTimeout(() => navigate('/stok'), 3000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal memproses transfer stok.');
    }
  };

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Transfer Stok Antar Cabang"
          subtitle="Pindahkan stok produk antar cabang"
          actions={[
            <HeaderActionButton
              key="export"
              icon={Download}
              label="Export Excel"
              variant="emerald"
              onClick={handleExport}
              hideLabel={true}
            />,
            <HeaderActionButton
              key="back"
              icon={ArrowLeft}
              label="Kembali"
              variant="slate"
              to="/stok"
              isLink
              hideLabel={true}
            />
          ]}
        />

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Dari Cabang & Produk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dari Cabang *</label>
                <select 
                  name="cabang_asal" 
                  value={transfer.cabang_asal} 
                  onChange={handleChange} 
                  required 
                  className="w-full p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Pilih Cabang</option>
                  {branches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.nama_cabang}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Produk *</label>
                <div className="relative" ref={productSearchRef}>
                  <input
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => handleProductSearchChange(e.target.value)}
                    onFocus={() => {
                      if (transfer.cabang_asal && productSearchTerm.length >= 2) {
                        if (productSearchResults.length > 0) {
                          setShowProductDropdown(true);
                        } else if (!isSearchingProducts) {
                          handleProductSearch(productSearchTerm);
                        }
                      }
                    }}
                    disabled={!transfer.cabang_asal}
                    placeholder={transfer.cabang_asal ? "Ketik 2+ karakter..." : "Pilih cabang dulu"}
                    className="w-full p-2.5 border border-gray-300 rounded-md bg-white pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    required={!!transfer.id_produk}
                  />
                  {transfer.id_produk && (
                    <button type="button" onClick={clearProductSelection} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                  )}
                  {isSearchingProducts && <div className="absolute right-2 top-1/2 transform -translate-y-1/2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div></div>}

                  {showProductDropdown && productSearchTerm.length >= 2 && transfer.cabang_asal && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {isSearchingProducts ? (
                        <div className="px-3 py-3 text-center text-gray-500 text-sm">Mencari...</div>
                      ) : productSearchResults.length > 0 ? (
                        productSearchResults.map((product) => {
                          const sourceStock = stockInfo[product.id_produk]?.cabang?.[transfer.cabang_asal] || 0;
                          return (
                            <div key={product.id_produk} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0" onClick={() => handleProductSelect(product)}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900 text-sm">{product.nama_produk}</div>
                                  <div className="text-xs text-gray-500">{product.kode_produk}</div>
                                </div>
                                <div className={`text-xs font-medium px-2 py-1 rounded ml-2 ${sourceStock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {sourceStock}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-3 text-center text-gray-500 text-sm">Tidak ada</div>
                      )}
                    </div>
                  )}
                </div>
                <input type="hidden" value={transfer.id_produk} required />
              </div>
            </div>

            {/* Info: Stok dari cabang asal */}
            {transfer.id_produk && transfer.cabang_asal && (
              <div className="bg-green-50 border border-green-200 rounded p-2.5 text-sm">
                <span className="text-gray-700">Stok: <span className="font-bold text-green-700">{stockInfo[transfer.id_produk]?.cabang?.[transfer.cabang_asal] || 0} unit</span></span>
              </div>
            )}

            {/* Row 2: Ke Cabang & Jumlah */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ke Cabang *</label>
                <select 
                  name="cabang_tujuan" 
                  value={transfer.cabang_tujuan} 
                  onChange={handleChange} 
                  disabled={!transfer.id_produk}
                  required 
                  className="w-full p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Pilih Cabang</option>
                  {branches.filter(b => b.id_cabang !== transfer.cabang_asal).map(b => (
                    <option key={b.id_cabang} value={b.id_cabang}>{b.nama_cabang}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah Transfer *</label>
                <input 
                  type="number" 
                  name="jumlah" 
                  value={transfer.jumlah} 
                  onChange={handleChange} 
                  required 
                  min="1"
                  disabled={!transfer.cabang_tujuan}
                  max={stockInfo[transfer.id_produk]?.cabang?.[transfer.cabang_asal] || 0}
                  className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Masukkan jumlah"
                />
                {transfer.cabang_asal && transfer.id_produk && (
                  <p className="text-xs text-gray-500 mt-1">Maks: {stockInfo[transfer.id_produk]?.cabang?.[transfer.cabang_asal] || 0}</p>
                )}
              </div>
            </div>

            {/* Info: Stok tujuan */}
            {transfer.id_produk && transfer.cabang_tujuan && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2.5 text-sm">
                <span className="text-gray-700">Stok di tujuan: <span className="font-bold text-blue-700">{stockInfo[transfer.id_produk]?.cabang?.[transfer.cabang_tujuan] || 0} unit</span></span>
              </div>
            )}

            {/* Keterangan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Keterangan *</label>
              <textarea 
                name="keterangan" 
                value={transfer.keterangan} 
                onChange={handleChange} 
                disabled={!transfer.cabang_tujuan}
                required 
                className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none" 
                rows="2"
                placeholder="Alasan transfer..."
              ></textarea>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Link to="/stok" className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition text-sm font-medium">
                Batal
              </Link>
              <button 
                type="submit" 
                disabled={!transfer.cabang_asal || !transfer.id_produk || !transfer.cabang_tujuan || !transfer.jumlah || !transfer.keterangan}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                Transfer
              </button>
            </div>
          </form>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default StockTransferPage;