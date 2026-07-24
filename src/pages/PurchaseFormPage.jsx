import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSuppliers, getBranches, getStockReport, createPurchase, getProducts } from '../services/api';
import { UniversalPrintModal, PRINT_TYPES } from '../components/UniversalPrintModal';
import { formatCurrency } from '../utils/formatHelper';
import { useSettings } from '../context/SettingsContext';
import { Trash2, X, Info, Lightbulb, Plus, Loader } from 'lucide-react';

const PurchaseFormPage = () => {
  const navigate = useNavigate();
  const { storeInfo } = useSettings();
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [stockInfo, setStockInfo] = useState({});
  const [header, setHeader] = useState(() => ({
    kode_pembelian: `PO-${Date.now()}`,
    id_supplier: '',
    tanggal: new Date().toISOString().slice(0, 10),
    destination: 'gudang',
    id_cabang: null,
  }));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [purchaseDataForReceipt, setPurchaseDataForReceipt] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [totalHarga, setTotalHarga] = useState(0);
  const [totalJumlah, setTotalJumlah] = useState(0);

  // Autocomplete states for each item
  const [productSearchStates, setProductSearchStates] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        let suppliersData = [];
        let branchesData = [];
        let stockData = [];

        // Try API first for all data
        try {
          const [suppliersRes, branchesRes, stockReportRes] = await Promise.all([
            getSuppliers(),
            getBranches(),
            getStockReport()
          ]);
          suppliersData = suppliersRes.data.data || [];
          branchesData = branchesRes.data.data || [];
          stockData = stockReportRes.data.data || [];
        } catch (_apiError) {
          // Fallback to local database
          if (window.electronAPI?.dbSelect) {
            try {
              const localSuppliers = await window.electronAPI.dbSelect({
                table: 'suppliers',
                whereClause: '1=1',
                whereValues: []
              });
              if (localSuppliers && Array.isArray(localSuppliers)) {
                suppliersData = localSuppliers;
              }

              const localBranches = await window.electronAPI.dbSelect({
                table: 'branches',
                whereClause: '1=1',
                whereValues: []
              });
              if (localBranches && Array.isArray(localBranches)) {
                branchesData = localBranches;
              }
            } catch (_dbError) {
              if (import.meta.env.DEV) {
              }
            }
          }
        }

        setSuppliers(suppliersData);
        setBranches(branchesData);
        setStockInfo(buildStockInfoMap(stockData));
      } catch (err) {
        console.error('Failed to load purchase form data:', err);
        setError('Gagal memuat data untuk form pembelian.');
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


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close all dropdowns if click is not on any search input or dropdown
      const isClickOnSearchInput = event.target.closest('[data-search-input]');
      const isClickOnDropdown = event.target.closest('[data-search-dropdown]');
      if (!isClickOnSearchInput && !isClickOnDropdown) {
        setProductSearchStates(prev => {
          const newState = { ...prev };
          Object.keys(newState).forEach(index => {
            newState[index] = { ...newState[index], showDropdown: false };
          });
          return newState;
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate totals whenever items change
  useEffect(() => {
    const calculateTotals = () => {
      let totalQty = 0;
      let totalPrice = 0;
      
      items.forEach(item => {
        const qty = parseInt(item.jumlah) || 0;
        const price = parseFloat(item.harga_beli) || 0;
        totalQty += qty;
        totalPrice += qty * price;
      });
      
      setTotalJumlah(totalQty);
      setTotalHarga(totalPrice);
    };
    
    calculateTotals();
  }, [items]);

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeader(prev => {
      const newState = { ...prev, [name]: value };
      if (name === 'destination' && value === 'gudang') newState.id_cabang = '';
      return newState;
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    const currentItem = { ...newItems[index] };
    currentItem[field] = value;
    // Note: id_produk selection is now handled directly in the dropdown onClick
    newItems[index] = currentItem;
    setItems(newItems);
  };

  const addItem = () => setItems([...items, { id_produk: '', jumlah: 1, harga_beli: 0 }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const getCurrentStock = (id_produk) => {
    if (!id_produk || !stockInfo[id_produk]) return 0;
    if (header.destination === 'gudang') return stockInfo[id_produk].gudang || 0;
    if (header.destination === 'cabang' && header.id_cabang) return stockInfo[id_produk][`cabang_${header.id_cabang}`] || 0;
    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!header.id_supplier) { setError('Supplier harus dipilih.'); return; }
    if (header.destination === 'cabang' && !header.id_cabang) { setError('Cabang tujuan harus dipilih.'); return; }
    if (items.length === 0) { setError('Transaksi harus memiliki minimal satu item pembelian.'); return; }
    if (items.some(item => !item.id_produk || item.jumlah <= 0)) { setError('Setiap item harus memiliki produk yang dipilih dan jumlah lebih dari 0.'); return; }

    setIsLoading(true);
    let purchaseData = {
      kode_pembelian: header.kode_pembelian,
      id_supplier: parseInt(header.id_supplier),
      tanggal: new Date(header.tanggal).toISOString(),
      items: items.map(item => ({ id_produk: parseInt(item.id_produk), jumlah: parseInt(item.jumlah), harga_beli: parseFloat(item.harga_beli) }))
    };
    if (header.destination === 'cabang' && header.id_cabang) { 
      purchaseData.masuk_gudang = false; 
      purchaseData.id_cabang = parseInt(header.id_cabang); 
    } else { 
      purchaseData.masuk_gudang = true; 
      purchaseData.id_cabang = null; 
    }

    try {
      // Check if we're online
      const isOnline = navigator.onLine;

      let purchaseId;
      let isOfflineTransaction = false;

      if (isOnline) {
        // Online mode: submit to server
        const response = await createPurchase(purchaseData);
        purchaseId = response.data?.data?.id_pembelian || response.data?.id_pembelian;

        if (!purchaseId) {
          throw new Error('Gagal mendapatkan ID pembelian dari server');
        }
      } else {
        // Offline mode: save to local database and sync queue
        isOfflineTransaction = true;

        // Generate a temporary ID for offline transaction
        const tempPurchaseId = Date.now();

        // Prepare purchase data for local storage
        const offlinePurchaseData = {
          id_pembelian: tempPurchaseId,
          kode_pembelian: purchaseData.kode_pembelian,
          id_supplier: purchaseData.id_supplier,
          id_cabang: purchaseData.id_cabang,
          tanggal: purchaseData.tanggal,
          total: items.reduce((sum, item) => sum + (item.jumlah * item.harga_beli), 0),
          status: 'selesai',
          masuk_gudang: purchaseData.masuk_gudang,
          synced: 0,
          sync_version: 1
        };

        // Prepare purchase items
        const purchaseItems = items.map(item => ({
          id_pembelian: tempPurchaseId,
          id_produk: item.id_produk,
          jumlah: item.jumlah,
          harga_beli: item.harga_beli,
          subtotal: item.jumlah * item.harga_beli
        }));

        // Save to local database
        if (window.electronAPI?.dbInsert) {
          // Insert purchase
          await window.electronAPI.dbInsert({
            table: 'purchases',
            data: offlinePurchaseData
          });

          // Insert purchase items
          for (const item of purchaseItems) {
            await window.electronAPI.dbInsert({
              table: 'purchase_items',
              data: item
            });
          }

          // Add to sync queue for later synchronization
          await window.electronAPI.dbInsert({
            table: 'sync_queue',
            data: {
              table_name: 'purchases',
              record_id: tempPurchaseId,
              operation: 'INSERT',
              data: JSON.stringify(purchaseData),
              status: 'pending',
              retry_count: 0
            }
          });
        } else {
          throw new Error('Offline database tidak tersedia');
        }

        purchaseId = tempPurchaseId;
      }

      // Prepare data for receipt printing
      const receiptData = {
        id_pembelian: purchaseId,
        kode_pembelian: purchaseData.kode_pembelian,
        tanggal: purchaseData.tanggal,
        supplier: suppliers.find(s => s.id_supplier == purchaseData.id_supplier),
        items: items.map(item => {
          const product = items.find(i => i.id_produk == item.id_produk)?._productData;
          return {
            ...item,
            nama_produk: product?.nama_produk || `Produk ${item.id_produk}`,
            subtotal: item.jumlah * item.harga_beli
          };
        }),
        total: items.reduce((sum, item) => sum + (item.jumlah * item.harga_beli), 0)
      };

      setPurchaseDataForReceipt(receiptData);
      setShowPrintModal(true);

      const successMessage = isOfflineTransaction
        ? `Pembelian berhasil disimpan offline! ID: ${purchaseId} (akan disinkronkan saat online)`
        : 'Transaksi pembelian berhasil disimpan!';

      setSuccess(successMessage);

      // Reset form
      setItems([]);
      setHeader(prev => ({ ...prev, kode_pembelian: `PO-${Date.now()}`, id_supplier: '', destination: 'gudang', id_cabang: null }));

      // Redirect to purchase history after showing print modal or after a delay
      setTimeout(() => {
        navigate('/pembelian/history');
      }, 3000); // 3 second delay to allow user to see success message and potentially print

    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Gagal menyimpan pembelian.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Print Modal */}
      {showPrintModal && (
        <UniversalPrintModal
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setPurchaseDataForReceipt(null);
          }}
          printType={PRINT_TYPES.PURCHASE_RECEIPT}
          data={purchaseDataForReceipt}
          storeInfo={storeInfo}
        />
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                Panduan Menambah Item
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-lg">1.</span>
                  <div>
                    <p className="font-medium text-gray-800">Pilih Produk</p>
                    <p className="text-sm text-gray-600">Pilih produk yang akan dibeli dari dropdown yang tersedia</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-lg">2.</span>
                  <div>
                    <p className="font-medium text-gray-800">Masukkan Jumlah</p>
                    <p className="text-sm text-gray-600">Masukkan jumlah produk yang akan dibeli (minimal 1)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-lg">3.</span>
                  <div>
                    <p className="font-medium text-gray-800">Harga Beli Otomatis</p>
                    <p className="text-sm text-gray-600">Harga beli akan terisi otomatis dari data produk yang dipilih</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-lg">4.</span>
                  <div>
                    <p className="font-medium text-gray-800">Tambah Item Lain</p>
                    <p className="text-sm text-gray-600">Klik tombol "Tambah Item Baru" untuk menambah produk lainnya</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 flex-shrink-0" />
                  <span><span className="font-medium">Tips:</span> Total pembelian akan otomatis terhitung dan ditampilkan di bagian ringkasan.</span>
                </p>
              </div>
            </div>
            <div className="flex justify-end p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <Info className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
            <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Purchase Header Info */}
        <div className="border border-gray-200 rounded-lg p-6 mb-6 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Pembelian</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Kode Pembelian</label>
              <input type="text" name="kode_pembelian" value={header.kode_pembelian} onChange={handleHeaderChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Supplier</label>
              <select name="id_supplier" value={header.id_supplier} onChange={handleHeaderChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
                <option value="" disabled>Pilih Supplier</option>
                {suppliers.map(s => <option key={s.id_supplier} value={s.id_supplier}>{s.nama_supplier}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Tanggal</label>
              <input type="date" name="tanggal" value={header.tanggal} onChange={handleHeaderChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white" />
            </div>
          </div>

          {/* Destination Selection */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Tujuan Stok</label>
            <div className="flex gap-6">
              <label className="flex items-center">
                <input type="radio" name="destination" value="gudang" checked={header.destination === 'gudang'} onChange={handleHeaderChange} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                <span className="ml-2 text-sm text-gray-700">Masuk Gudang Pusat</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="destination" value="cabang" checked={header.destination === 'cabang'} onChange={handleHeaderChange} className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                <span className="ml-2 text-sm text-gray-700">Kirim ke Cabang</span>
              </label>
            </div>
          </div>

          {/* Branch Selection (conditional) */}
          {header.destination === 'cabang' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Pilih Cabang</label>
              <select name="id_cabang" value={header.id_cabang || ''} onChange={handleHeaderChange} required={header.destination === 'cabang'} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
                <option value="" disabled>Pilih Cabang</option>
                {branches.map(b => <option key={b.id_cabang} value={b.id_cabang}>{b.nama_cabang}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Purchase Items Section */}
        <div className="border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Detail Item Pembelian</h3>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-colors"
              title="Panduan menambah item"
            >
              <Info className="w-4 h-4" />
              Panduan
            </button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">Produk</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide">Jumlah</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">Harga Beli</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">Subtotal</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wide w-20">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      <p>Belum ada item. Klik "Tambah Item Baru" untuk memulai.</p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const subtotal = (parseInt(item.jumlah) || 0) * (parseFloat(item.harga_beli) || 0);
                    return (
                      <tr key={index} className="border-b border-gray-200 hover:bg-blue-50 transition">
                        <td className="px-4 py-3">
                          <div className="relative">
                            <input
                              type="text"
                              value={item.nama_produk || productSearchStates[index]?.searchTerm || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                
                                // Jika produk sudah dipilih, jangan allow edit
                                if (item.nama_produk) return;
                                
                                // Update search term
                                setProductSearchStates(prev => ({
                                  ...prev,
                                  [index]: {
                                    ...prev[index],
                                    searchTerm: value,
                                    showDropdown: value.length >= 2,
                                    isSearching: value.length >= 2,
                                    results: value.length < 2 ? [] : prev[index]?.results || []
                                  }
                                }));
                                
                                // Debounced search
                                if (value.length >= 2) {
                                  clearTimeout(window[`searchTimeout_${index}`]);
                                  window[`searchTimeout_${index}`] = setTimeout(async () => {
                                    try {
                                      const response = await getProducts({ search: value, limit: 20, status: 'aktif' });
                                      setProductSearchStates(prev => ({
                                        ...prev,
                                        [index]: {
                                          ...prev[index],
                                          results: response.data?.data || [],
                                          isSearching: false,
                                          showDropdown: (response.data?.data || []).length > 0
                                        }
                                      }));
                                  } catch (_apiError) {
                                    // Fallback to local database search
                                    if (window.electronAPI?.dbSelect) {
                                      try {
                                        const localResults = await window.electronAPI.dbSelect({
                                          table: 'products',
                                          whereClause: 'status = ? AND (nama_produk LIKE ? OR kode_produk LIKE ?)',
                                          whereValues: ['aktif', `%${value}%`, `%${value}%`]
                                        });
                                        setProductSearchStates(prev => ({
                                          ...prev,
                                          [index]: {
                                            ...prev[index],
                                            results: localResults || [],
                                            isSearching: false,
                                            showDropdown: (localResults || []).length > 0
                                          }
                                        }));
                                      } catch (_dbError) {
                                        setProductSearchStates(prev => ({
                                          ...prev,
                                          [index]: {
                                            ...prev[index],
                                            results: [],
                                            isSearching: false,
                                            showDropdown: false
                                          }
                                        }));
                                      }
                                    } else {
                                      setProductSearchStates(prev => ({
                                        ...prev,
                                        [index]: {
                                          ...prev[index],
                                          results: [],
                                          isSearching: false,
                                          showDropdown: false
                                        }
                                      }));
                                    }
                                    }
                                  }, 300);
                                }
                              }}
                              onFocus={() => {
                                if (item.nama_produk) return;
                                const state = productSearchStates[index];
                                if (state?.searchTerm && state.searchTerm.length >= 2 && state.results?.length > 0) {
                                  setProductSearchStates(prev => ({
                                    ...prev,
                                    [index]: { ...prev[index], showDropdown: true }
                                  }));
                                }
                              }}
                              placeholder={item.nama_produk ? '' : 'Ketik 2+ karakter...'}
                              className={`w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                item.nama_produk ? 'bg-green-50 border-green-200' : 'bg-white'
                              }`}
                              readOnly={!!item.nama_produk}
                              data-search-input
                            />
                            
                            {item.nama_produk && (
                              <button
                                type="button"
                                onClick={() => {
                                  setItems(prev => prev.map((item, idx) =>
                                    idx === index ? { ...item, id_produk: '', nama_produk: '', harga_beli: 0 } : item
                                  ));
                                  setProductSearchStates(prev => ({
                                    ...prev,
                                    [index]: { searchTerm: '', results: [], showDropdown: false }
                                  }));
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}

                            {productSearchStates[index]?.isSearching && (
                              <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                                <Loader className="w-3 h-3 text-blue-500 animate-spin" />
                              </div>
                            )}

                            {/* Dropdown */}
                            {productSearchStates[index]?.showDropdown && !item.nama_produk && (productSearchStates[index]?.searchTerm || '').length >= 2 && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto" data-search-dropdown>
                                {productSearchStates[index]?.isSearching ? (
                                  <div className="px-3 py-3 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                                    <Loader className="w-4 h-4 text-blue-500 animate-spin" />
                                    Mencari...
                                  </div>
                                ) : (productSearchStates[index]?.results || []).length > 0 ? (
                                  (productSearchStates[index]?.results || []).map((product) => (
                                    <div
                                      key={product.id_produk}
                                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-sm"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        // Update item
                                        setItems(prev => prev.map((item, idx) =>
                                          idx === index
                                            ? {
                                                ...item,
                                                id_produk: product.id_produk?.toString() || '',
                                                nama_produk: product.nama_produk || '',
                                                harga_beli: product.harga_beli || product.harga_jual || 0
                                              }
                                            : item
                                        ));
                                        // Clear search state
                                        setProductSearchStates(prev => ({
                                          ...prev,
                                          [index]: { searchTerm: '', showDropdown: false, results: [] }
                                        }));
                                      }}
                                    >
                                      <div className="font-medium text-gray-900">{product.nama_produk}</div>
                                      <div className="text-xs text-gray-500">{product.kode_produk}</div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-3 py-3 text-center text-gray-500 text-sm">
                                    Tidak ada produk
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Hidden input for form validation */}
                          <input
                            type="hidden"
                            value={item.id_produk}
                            required
                          />

                          {item.id_produk && (
                            <span className="text-xs text-blue-600 mt-1 block">
                              Stok: {getCurrentStock(item.id_produk)} unit
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min="1"
                            name="jumlah"
                            value={item.jumlah}
                            onChange={(e) => handleItemChange(index, 'jumlah', e.target.value)}
                            className="w-16 px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mx-auto"
                            placeholder="0"
                          />
                        </td>

                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          Rp {formatCurrency(item.harga_beli)}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          Rp {formatCurrency(subtotal)}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-red-600 hover:bg-red-50 transition"
                            title="Hapus item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
            Tambah Item Baru
          </button>
        </div>

        {/* Summary Section */}
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Pembelian</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Total Jumlah Item</p>
              <p className="text-3xl font-bold text-gray-900">{totalJumlah}</p>
              <p className="text-xs text-gray-500 mt-1">Unit</p>
            </div>
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Total Harga Pembelian</p>
              <p className="text-3xl font-bold text-gray-900">Rp {formatCurrency(totalHarga)}</p>
              <p className="text-xs text-gray-500 mt-1">Rupiah</p>
            </div>
          </div>

          {items.length === 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 flex-shrink-0" />
                <span><span className="font-medium">Info:</span> Tambahkan item pembelian terlebih dahulu untuk melihat ringkasan</span>
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button type="submit" disabled={isLoading} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {isLoading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            'Simpan Transaksi Pembelian'
          )}
        </button>
      </form>
    </div>
  );
};

export default PurchaseFormPage;



