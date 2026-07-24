import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { getProducts, getProductById, createSale, recordPayment, createPaymentPending, getStockReport, createLogAktivitas } from '../services/api';
import APIWithOfflineSupport from '../services/apiWithOfflineSupport';
import { extractData } from '../utils/apiResponseHelper';
import { formatCurrency } from '../utils/formatHelper';
import TimeoutManager from '../utils/TimeoutManager';
import PerformanceMonitor from '../utils/PerformanceMonitor';
import SubmissionProgressHandler from '../utils/SubmissionProgressHandler';
import { mapErrorToUserMessage, getRecoverySuggestion } from '../utils/errorMessageMapper';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../context/SettingsContext';
import { useSync } from '../context/SyncContext';
import { useNetworkState } from '../hooks/useNetworkState';
import { useNotifications } from '../hooks/useNotifications';
import useProductOfflineDB from '../hooks/useProductOfflineDB';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import PaymentMethodSelector from '../components/PaymentMethodSelector';
import PaymentAmountInput from '../components/PaymentAmountInput';
import ProductGrid from '../components/pos/ProductGrid';
import CartItem from '../components/pos/CartItem';
import PrinterStatusIndicator from '../components/PrinterStatusIndicator';
import DiscountDialog from '../components/DiscountDialog';
import OfflineWarningDialog from '../components/OfflineWarningDialog';
import { logger } from '../utils/logger';
import PosErrorBoundary from '../components/PosErrorBoundary';
import LazyLoadErrorBoundary from '../components/LazyLoadErrorBoundary';
import LoadingPage from '../components/common/LoadingPage';
import LoadingButton from '../components/common/LoadingButton';
import ShortcutModal from '../components/ShortcutModal';
import ConfirmDialog from '../components/common/ConfirmDialog';

// Fallback components for when dynamic imports fail
const ModalFallback = ({ onDone }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-sm">
      <h3 className="text-lg font-semibold mb-4">Receipt</h3>
      <p className="text-gray-600 mb-4">Transaction completed successfully</p>
      <button
        onClick={onDone}
        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
      >
        Done
      </button>
    </div>
  </div>
);

const SimpleSearchFallback = ({ onClose }) => (
  <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
    <p className="text-gray-600 mb-4">Customer search temporarily unavailable</p>
    <button onClick={onClose} className="text-blue-500 hover:underline text-sm">Close</button>
  </div>
);

const BarcodeScannerFallback = ({ onClose }) => (
  <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
    <p className="text-gray-600 mb-4">Camera scanner temporarily unavailable</p>
    <button onClick={onClose} className="text-blue-500 hover:underline text-sm">Close</button>
  </div>
);

const VoucherFallback = ({ onClose }) => (
  <div className="p-4 bg-gray-100 rounded-lg border border-gray-300">
    <p className="text-gray-600 mb-4">Voucher input temporarily unavailable</p>
    <button onClick={onClose} className="text-blue-500 hover:underline text-sm">Close</button>
  </div>
);

// Lazy load heavy components with error handling
const TransactionSuccessModal = lazy(() => 
  import('../components/TransactionSuccessModal').catch(err => {
    logger.error('Failed to load TransactionSuccessModal:', err);
    return { default: ModalFallback };
  })
);
const PencarianPelanggan = lazy(() =>
  import('../components/PencarianPelanggan').catch(err => {
    logger.error('Failed to load PencarianPelanggan:', err);
    return { default: SimpleSearchFallback };
  })
);
const CameraBarcodeScanner = lazy(() =>
  import('../components/CameraBarcodeScanner').catch(err => {
    logger.error('Failed to load CameraBarcodeScanner:', err);
    return { default: BarcodeScannerFallback };
  })
);
const InputVoucher = lazy(() =>
  import('../components/InputVoucher').catch(err => {
    logger.error('Failed to load InputVoucher:', err);
    return { default: VoucherFallback };
  })
);

const PosPage = () => {
  const { user } = useAuth();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Ya, Kosongkan',
    onConfirm: null,
    variant: 'danger'
  });
  const { storeInfo, posSettings } = useSettings();
  const { getConnectionStatus, isSyncLocked } = useSync();
  const { isOnline } = useNetworkState();
  const { searchOfflineProducts } = useProductOfflineDB();
  const { error: showError, success: showSuccess } = useNotifications();
  const { fetchPaymentMethods } = usePaymentMethods();
  const navigate = useNavigate();
  
  const pendingErrorMessageRef = useRef(null);
  const pendingErrorTimeoutRef = useRef(null);
  const lastErrorTimeRef = useRef(0); // Track last error notification time to prevent spam

  const flushPendingError = useCallback(() => {
    if (!pendingErrorMessageRef.current) return;
    const message = pendingErrorMessageRef.current;
    pendingErrorMessageRef.current = null;
    showError(message);
  }, [showError]);

  // Debounced error notification to prevent rapid successive error toasts.
  // Store the error message in a ref and flush it after the current render cycle.
  const showErrorDebounced = useCallback((message) => {
    const now = Date.now();
    if (now - lastErrorTimeRef.current >= 500) {
      lastErrorTimeRef.current = now;
      pendingErrorMessageRef.current = message;
      if (pendingErrorTimeoutRef.current == null) {
        pendingErrorTimeoutRef.current = setTimeout(() => {
          pendingErrorTimeoutRef.current = null;
          flushPendingError();
        }, 0);
      }
    }
  }, [flushPendingError]);

  const [products, setProducts] = useState([]);
  const [stockInfo, setStockInfo] = useState({});
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false); // Changed: false instead of true - tidak perlu load produk awal
  const [loadError, setLoadError] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [taxAmount, setTaxAmount] = useState(0);
  const searchIdRef = useRef(0); // Use ref to track search ID without causing re-renders
  const searchInputRef = useRef(null); // ref to search input for keyboard shortcuts
  const branchErrorShownRef = useRef(false); // Track if branch error notification has been shown
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(() => ({ id_metode_pembayaran: 1, id_metode: 1, nama_metode: 'Tunai', tipe: 'cash' }));
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [saleDataForPrint, setSaleDataForPrint] = useState(null);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [isPendingPayment, setIsPendingPayment] = useState(false);
  const [focusedSection, setFocusedSection] = useState('search'); // 'search', 'cart', 'payment', 'payment-amount', 'payment-pending', 'payment-submit'
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1); // -1 means no product selected
  const [cartFocusedIndex, setCartFocusedIndex] = useState(-1); // -1 = no focus, index = focused cart item
  
  // NEW: Dialog states
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);

  const createTemporarySaleId = useCallback(() => {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `OFFLINE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);
  
  // Use ref-based bounded stack instead of state for snapshot management (memory optimization)
  const snapshotStackRef = useRef([]);
  const MAX_SNAPSHOTS = 5;

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    if (loading) return products;

    const term = String(searchTerm || '').trim().toLowerCase();
    if (!term) return products;

    return products.filter((product) => {
      const name = String(product?.nama_produk || '').toLowerCase();
      const kode = String(product?.kode_produk || '').toLowerCase();
      return name.includes(term) || (kode && kode.includes(term));
    });
  }, [products, searchTerm, loading]);

  useEffect(() => {
    if (selectedProductIndex >= filteredProducts.length) {
      setSelectedProductIndex(filteredProducts.length - 1);
    }
  }, [filteredProducts.length, selectedProductIndex]);

  useEffect(() => {
    if (focusedSection === 'products' && selectedProductIndex >= 0) {
      const selectedCard = document.querySelector(`[data-grid-index="${selectedProductIndex}"]`);
      if (selectedCard) {
        selectedCard.focus();
      }
    }
  }, [focusedSection, selectedProductIndex]);

  const [, setCurrentKeyboardHint] = useState(''); // internal hint state without top-bar display
  const paymentAmountInputRef = useRef(null);
  const paymentPanelRef = useRef(null);
  const paymentModalRef = useRef(null);
  const paymentInteractionRef = useRef(false);
  const pendingCheckboxRef = useRef(null);
  const submitButtonRef = useRef(null);
  const customerSearchRef = useRef(null); // ref untuk customer search input

  const getProductGridRows = useCallback(() => {
    const cards = Array.from(document.querySelectorAll('[data-grid-index]'))
      .filter(card => card.offsetParent !== null && card.getClientRects().length > 0);
    if (cards.length === 0) return [];

    const rows = [];
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const index = Number(card.dataset.gridIndex);
      const top = Math.round(rect.top);
      const left = rect.left;

      let row = rows.find(r => Math.abs(r.top - top) <= 14);
      if (!row) {
        row = { top, items: [] };
        rows.push(row);
      }
      row.items.push({ index, left, card });
    });

    rows.forEach(row => row.items.sort((a, b) => a.left - b.left));
    rows.sort((a, b) => a.top - b.top);
    return rows;
  }, []);

  const getNextProductIndex = useCallback((direction, currentIndex) => {
    if (filteredProducts.length === 0) return -1;

    const rows = getProductGridRows();
    if (rows.length === 0) return Math.max(0, currentIndex);

    if (currentIndex < 0) {
      if (direction === 'up') return -1;
      return rows[0].items[0].index;
    }

    const current = currentIndex;
    const currentRowIndex = rows.findIndex(row => row.items.some(item => item.index === current));
    const rowIndex = currentRowIndex >= 0 ? currentRowIndex : 0;
    const row = rows[rowIndex];
    const itemIndex = row.items.findIndex(item => item.index === current);
    const colIndex = itemIndex >= 0 ? itemIndex : 0;

    if (direction === 'left') {
      if (colIndex > 0) return row.items[colIndex - 1].index;
      return row.items[0].index;
    }

    if (direction === 'right') {
      if (colIndex < row.items.length - 1) return row.items[colIndex + 1].index;
      return row.items[row.items.length - 1].index;
    }

    if (direction === 'up') {
      if (rowIndex === 0) return -1;
      const prevRow = rows[rowIndex - 1].items;
      return prevRow[Math.min(colIndex, prevRow.length - 1)].index;
    }

    if (direction === 'down') {
      if (rowIndex === rows.length - 1) return current;
      const nextRow = rows[rowIndex + 1].items;
      return nextRow[Math.min(colIndex, nextRow.length - 1)].index;
    }

    return current;
  }, [filteredProducts.length, getProductGridRows]);

  const focusProductsSection = () => {
    setFocusedSection('products');
    if (selectedProductIndex < 0 && filteredProducts.length > 0) {
      setSelectedProductIndex(0);
    }
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  };

  const focusCartSection = () => {
    setFocusedSection('cart');
    const firstCartItem = document.querySelector('[data-cart-item]');
    if (firstCartItem) {
      firstCartItem.focus();
      setCartFocusedIndex(0);
    }
  };

  const focusPaymentSection = () => {
    setFocusedSection('payment');
    setCartFocusedIndex(-1);
    const paymentMethodSelect = document.getElementById('payment-method-select');
    if (paymentMethodSelect) {
      paymentMethodSelect.focus();
    } else if (paymentAmountInputRef.current) {
      paymentAmountInputRef.current.focus();
      paymentAmountInputRef.current.select();
    }
  };

  // when a popup/modal closes, send focus back to barcode input if available
  // Otherwise focus search box so typing can resume immediately
  // This ensures shortcuts will work because the input is focused
  useEffect(() => {
    if (!showCustomerPopup) {
      setTimeout(() => {
        // Only refocus if no input is currently active
        const activeEl = document.activeElement;
        const isInputActive = activeEl?.tagName === 'INPUT' || 
                              activeEl?.tagName === 'TEXTAREA' || 
                              (activeEl?.type === 'number' && activeEl?.closest('[data-cart-item]'));
        
        if (!isInputActive) {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          } else if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        }
      }, 100);
    }
  }, [showCustomerPopup]);

  useEffect(() => {
    if (!showShortcutsModal) {
      setTimeout(() => {
        // Only refocus if no input is currently active
        const activeEl = document.activeElement;
        const isInputActive = activeEl?.tagName === 'INPUT' || 
                              activeEl?.tagName === 'TEXTAREA' || 
                              (activeEl?.type === 'number' && activeEl?.closest('[data-cart-item]'));
        
        if (!isInputActive) {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          } else if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        }
      }, 100);
    }
  }, [showShortcutsModal]);

  // When camera scanner closes, focus barcode input for physical scanner,
  // not search input - scanner needs focus to receive barcode data
  useEffect(() => {
    if (!showCameraScanner) {
      setTimeout(() => {
        // Only refocus if no input is currently active
        const activeEl = document.activeElement;
        const isInputActive = activeEl?.tagName === 'INPUT' || 
                              activeEl?.tagName === 'TEXTAREA' || 
                              (activeEl?.type === 'number' && activeEl?.closest('[data-cart-item]'));
        
        if (!isInputActive) {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
        }
      }, 100);
    }
  }, [showCameraScanner]);
  const [isOpeningCashDrawer, setIsOpeningCashDrawer] = useState(false);
  const [manualPricingOverrides, setManualPricingOverrides] = useState({}); // { productId: 'eceran' | 'grosir' | 'auto' }
  const barcodeInputRef = useRef(null);
  const pendingPaymentRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const timeoutManager = useRef(new TimeoutManager()); // Centralized timeout management

  // Cleanup timeouts and event listeners on unmount
  useEffect(() => {
    const manager = timeoutManager.current;
    return () => {
      // Clear all managed timeouts
      manager.clearAll();
      // Clear snapshot stack to prevent memory leak
      snapshotStackRef.current = [];
      if (pendingErrorTimeoutRef.current) {
        clearTimeout(pendingErrorTimeoutRef.current);
      }
    };
  }, []);

  const idCabangPengguna = user?.id_cabang;
  const [tipeKatalog, setTipeKatalog] = useState('global');

  useEffect(() => {
    const loadBranchTipeKatalog = async () => {
      try {
        if (idCabangPengguna && window.electronAPI?.dbSelect) {
          const res = await window.electronAPI.dbSelect({
            table: 'branches',
            whereClause: 'id_cabang = ?',
            whereValues: [idCabangPengguna]
          });
          if (res && res.length > 0) {
            setTipeKatalog(res[0].tipe_katalog || 'global');
          }
        }
      } catch (err) {
        console.warn('Failed to load branch tipe_katalog offline:', err);
      }
    };
    loadBranchTipeKatalog();
  }, [idCabangPengguna]);

  /**
   * Cache stock report data untuk offline use
   * Simpan ke offline database (product_stocks table)
   */
  const cacheStockReportData = useCallback(async (stockData) => {
    try {
      if (!Array.isArray(stockData) || stockData.length === 0) {
        console.warn('⚠️ No stock data to cache');
        return;
      }

      // Convert stockReport format ke product_stocks format
      const stocks = [];
      stockData.forEach(item => {
        if (item.detail_lokasi?.cabang && Array.isArray(item.detail_lokasi.cabang)) {
          item.detail_lokasi.cabang.forEach(cabang => {
            stocks.push({
              id_produk: item.id_produk,
              id_cabang: cabang.id_cabang,
              stok: cabang.stok || 0,
              lokasi_rak: item.lokasi_rak || null,
              updated_at: item.updated_at || new Date().toISOString()
            });
          });
        }
      });

      if (stocks.length === 0) {
        console.warn('⚠️ No stocks extracted from stock report');
        return;
      }

      // Save ke offline database
      if (!window.electronAPI?.productDB_bulkUpsertStocks) {
        console.warn('⚠️ No IPC for saving stocks');
        return;
      }

      const result = await window.electronAPI.productDB_bulkUpsertStocks(stocks);
      if (result.success) {
      } else {
        console.warn('⚠️ Failed to cache stocks:', result.error);
      }
    } catch (err) {
      console.error('❌ Error caching stock data:', err);
    }
  }, []);

  /**
   * Load stock data dari offline cache
   * Gunakan saat API gagal dan user offline
   */
  const loadStockFromCache = useCallback(async () => {
    try {
      if (!idCabangPengguna) {
        console.warn('⚠️ No cabang info to load stocks');
        return [];
      }

      // Load stock dari offline database
      if (!window.electronAPI?.productDB_getStocksByCabang) {
        console.warn('⚠️ No IPC for offline stocks');
        return [];
      }

      const stocks = await window.electronAPI.productDB_getStocksByCabang(idCabangPengguna);

      if (!Array.isArray(stocks) || stocks.length === 0) {
        console.warn('⚠️ No stocks in offline database for cabang', idCabangPengguna);
        return [];
      }
      // Convert ke stockReport format untuk kompatibilitas
      return stocks.map(s => ({
        id_produk: s.id_produk,
        detail_lokasi: {
          cabang: [{
            id_cabang: s.id_cabang,
            stok: s.stok
          }]
        },
        lokasi_rak: s.lokasi_rak,
        updated_at: s.updated_at
      }));
    } catch (err) {
      console.error('❌ Error loading stock from cache:', err);
      return [];
    }
  }, [idCabangPengguna]);

  // Lookup stock removed - using stockInfo from API directly

  // Function to load products - DEPRECATED: Produk hanya dimuat saat pencarian (search)
  // Untuk optimasi performa, tidak ada pre-load produk di awal

  useEffect(() => {
    // Check if user has a branch assigned
    if (!idCabangPengguna) {
      if (!branchErrorShownRef.current) {
        branchErrorShownRef.current = true;
        // Set error state for UI to display
        setLoadError('Akun Anda tidak terhubung ke cabang manapun.');
        setLoading(false);
      }
      return;
    }

    // Listen for online/offline
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const fetchData = async () => {
      try {
        // Optimization: Jangan load produk di awal
        // Produk hanya dimuat saat user melakukan pencarian (search)
        // Ini membuat halaman POS lebih cepat dan ringan load
        
        let stockReportData = [];

        // Determine if online or offline
        const connectionStatus = getConnectionStatus();
        const isOnlineMode = connectionStatus.isOnline || navigator.onLine;

        // Try API first for stock report (if online)
        if (isOnlineMode) {
          try {
            const stockReportRes = await getStockReport();
            stockReportData = stockReportRes?.data?.data || [];
            if (stockReportData.length > 0) {
              logger.info(`✅ Stock report loaded from API (${stockReportData.length} records)`);
              
              // Cache stock data for offline use
              try {
                await cacheStockReportData(stockReportData);
              } catch (cacheErr) {
                console.warn('⚠️ Failed to cache stock data:', cacheErr);
                // Non-critical, continue
              }
            } else {
              logger.warn('⚠️ API returned empty stock data, trying offline cache...');
              // Empty API result - try cache as fallback
              try {
                stockReportData = await loadStockFromCache() || [];
                if (stockReportData.length > 0) {
                  logger.info(`📦 Loaded ${stockReportData.length} stock records from offline cache`);
                } else {
                  logger.warn('⚠️ No stock data in offline cache either');
                }
              } catch (cacheErr) {
                console.warn('⚠️ Failed to load from cache:', cacheErr);
              }
            }
          } catch (_apiError) {
            logger.warn('⚠️ API fetch failed for stock report, trying offline cache...');
            // API error - try cache
            try {
              stockReportData = await loadStockFromCache() || [];
              if (stockReportData.length > 0) {
                logger.info(`📦 Loaded ${stockReportData.length} stock records from offline cache`);
              } else {
                logger.warn('⚠️ No stock data in offline cache');
              }
            } catch (cacheLoadErr) {
              console.error('❌ Failed to load stock from cache:', cacheLoadErr);
            }
          }
        } else {
          // Offline mode - go directly to cache (no API attempt)
          logger.info('🔌 Offline mode detected, loading stock from offline cache...');
          try {
            stockReportData = await loadStockFromCache() || [];
            if (stockReportData.length > 0) {
              logger.info(`✅ Loaded ${stockReportData.length} stock records from offline cache`);
            } else {
              logger.warn('⚠️ No stock data in offline cache');
              stockReportData = [];
            }
          } catch (cacheLoadErr) {
            console.error('❌ Error loading stock from offline cache:', cacheLoadErr);
            stockReportData = [];
          }
        }

        // Build stock map from the new product-centric stock report format
        const stockMap = {};
        stockReportData.forEach(productStock => {
          // Find stock for current user's cabang in the cabang array
          if (productStock.detail_lokasi?.cabang && Array.isArray(productStock.detail_lokasi.cabang)) {
            const cabangStock = productStock.detail_lokasi.cabang.find(c => c.id_cabang === idCabangPengguna);
            stockMap[productStock.id_produk] = cabangStock?.stok || 0;
          } else if (productStock.stok !== undefined) {
            // Fallback: gunakan stok langsung jika detail_lokasi tidak tersedia
            stockMap[productStock.id_produk] = productStock.stok || 0;
          } else if (productStock.stokKasir !== undefined) {
            // Fallback: gunakan stokKasir dari cache
            stockMap[productStock.id_produk] = productStock.stokKasir || 0;
          }
        });
        setStockInfo(stockMap);

        // Fetch payment methods (will use cache if offline)
        try {
          const _methods = await fetchPaymentMethods();
        } catch (_err) {
          console.warn('Payment methods fetch failed, will use default');
        }

      } catch (error) {
        logger.error('Error loading POS data:', error);
        setLoadError('Gagal memuat data. Silakan refresh atau coba lagi.');
        // Don't show error toast immediately, let user see error state in UI
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Cleanup listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [idCabangPengguna, fetchPaymentMethods, cacheStockReportData, loadStockFromCache, getConnectionStatus]);

  // Debounced search effect
  useEffect(() => {
    if (!idCabangPengguna) return;

    const currentSearchId = ++searchIdRef.current;
    let isStillRelevant = true;

    const timeoutId = setTimeout(async () => {
      // Ignore if another search has been initiated
      if (currentSearchId !== searchIdRef.current || !isStillRelevant) {
        return;
      }

      if (searchTerm.length >= 3) {
        const cleanQuery = searchTerm.trim().toLowerCase();
        
        try {
          // Quick cache check FIRST - check if we have cached results for this exact query
          const cacheKey = `search_${idCabangPengguna || 0}_${tipeKatalog || 'global'}_${cleanQuery}`;
          const cached = sessionStorage?.getItem(cacheKey);
          if (cached) {
            try {
              const cachedData = JSON.parse(cached);
              if (Date.now() - cachedData.time < 5000) { // 5 second cache
                // CRITICAL: Check race condition before updating state
                if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
                setProducts(cachedData.results);
                return;
              }
            } catch (_e) {
              // Cache parse error, continue with API
            }
          }

          // Try API only if online
          if (isOnline) {
            try {
              const searchRes = await getProducts({ 
                limit: 50,
                page: 1,
                status: 'aktif',
                search: cleanQuery,
                sortBy: 'nama_produk',
                sortOrder: 'asc'
              });
              
              if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
              
              const productsData = searchRes.data?.data || [];
              
              if (productsData.length > 0) {
                const enhanced = productsData.map(p => ({
                  ...p,
                  harga_jual: Number(p.harga_jual || p.harga_eceran || 0),
                  harga_beli: Number(p.harga_beli || 0),
                  harga_grosir: Number(p.harga_grosir || 0),
                  min_qty_grosir: Number(p.min_qty_grosir || 0),
                  barcode: p.barcode || p.kode_produk,
                }));
                
                // Cache results
                try {
                  sessionStorage?.setItem(cacheKey, JSON.stringify({
                    results: enhanced,
                    time: Date.now()
                  }));
                } catch (storageErr) {
                  console.warn('⚠️ Session storage error (API search cache):', storageErr.message);
                  logger.warn('Store session cache failed:', storageErr);
                  // Continue anyway - search still works without cache
                }
                
                setProducts(enhanced);
                return;
              }
            } catch (_apiErr) {
            }
          }
          
          // Fallback to offline search
          let offlineResults = await searchOfflineProducts(cleanQuery, false, { id_cabang: idCabangPengguna, tipe_katalog: tipeKatalog });
          
          if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
          
          // Jika offline kosong tapi isOnline, try API
          if (offlineResults.length === 0 && isOnline) {
            try {
              const retryRes = await getProducts({
                limit: 50,
                page: 1,
                status: 'aktif',
                search: cleanQuery,
                sortBy: 'nama_produk',
                sortOrder: 'asc'
              });
              const retryData = retryRes.data?.data || [];
              if (retryData.length > 0) {
                const enhanced = retryData.map(p => ({
                  ...p,
                  harga_jual: Number(p.harga_jual || p.harga_eceran || 0),
                  harga_beli: Number(p.harga_beli || 0),
                  harga_grosir: Number(p.harga_grosir || 0),
                  min_qty_grosir: Number(p.min_qty_grosir || 0),
                  barcode: p.barcode || p.kode_produk,
                  // Get stock from API response or fallback to cached stock info
                  stok: Number(p.stok || stockInfo[p.id_produk || p.id] || 0)
                }));
                // CRITICAL: Check race condition before updating state
                if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
                setProducts(enhanced);
                return;
              }
            } catch (_retryErr) {
            }
          }
          
          const enhanced = offlineResults.map(p => ({
            // Normalize fields returned from DB/searchStrategy to app shape
            ...p,
            id_produk: p.id_produk || p.id || p.product_id,
            nama_produk: p.nama_produk || p.name || p.product_name || '',
            kode_produk: p.kode_produk || p.kd_produk || p.sku || p.code || '',
            harga_jual: Number(p.harga_jual || p.harga_eceran || p.harga || p.price || 0),
            harga_beli: Number(p.harga_beli || p.cost || 0),
            harga_grosir: Number(p.harga_grosir || p.wholesale_price || 0),
            min_qty_grosir: Number(p.min_qty_grosir || p.min_qty || 0),
            barcode: p.barcode || p.kode_produk || p.sku || '',
            // Get stock from stockInfo state (loaded from cache), fallback to product stok field
            stok: stockInfo[p.id_produk || p.id] ?? Number(p.stok || 0)
          }));
          
          // No need to extract stock from offline results since we use stockInfo state
          
          // Cache results
          try {
            sessionStorage?.setItem(cacheKey, JSON.stringify({
              results: enhanced,
              time: Date.now()
            }));
          } catch (storageErr) {
            console.warn('⚠️ Session storage error (offline search cache):', storageErr.message);
            logger.warn('Store session cache failed:', storageErr);
            // Continue anyway - search still works without cache
          }
          
          // CRITICAL: Check race condition before updating state
          if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
          setProducts(enhanced);
        } catch (error) {
          console.error('Search error:', error);
          if (isStillRelevant) {
            logger.error('Search failed:', error);
            showError('Gagal mencari produk');
          }
        }
      } else if (searchTerm.length === 0) {
        // CRITICAL: Check race condition before clearing products
        if (currentSearchId !== searchIdRef.current || !isStillRelevant) return;
        setProducts([]);
      }
    }, 300); // Debounce 300ms to reduce heavy searches

    return () => {
      isStillRelevant = false;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, idCabangPengguna, tipeKatalog, isOnline, searchOfflineProducts, getConnectionStatus]);

  const getProductStock = useCallback((id_produk) => {
    return stockInfo[id_produk] || 0;
  }, [stockInfo]);

  // Helper function to determine pricing based on wholesale conditions
  const debugGetProductPricing = useCallback((product, quantity) => {
    const hargaJual = Number(product.harga_jual || 0);
    const hargaGrosir = Number(product.harga_grosir || 0);
    const minQtyGrosir = Number(product.min_qty_grosir || 0);
    const override = manualPricingOverrides[product.id_produk];

    let price, priceType, isWholesale;

    if (override === 'eceran') {
      price = hargaJual;
      priceType = 'eceran';
      isWholesale = false;
    } else if (override === 'grosir') {
      price = hargaGrosir > 0 ? hargaGrosir : hargaJual;
      priceType = 'grosir';
      isWholesale = true;
    } else {
      // Auto mode - check if wholesale pricing applies
      isWholesale = hargaGrosir > 0 && minQtyGrosir > 0 && quantity >= minQtyGrosir;
      price = isWholesale ? hargaGrosir : hargaJual;
      priceType = isWholesale ? 'grosir' : 'eceran';
    }

    const result = { price, priceType, isWholesale };
    
    return result;
  }, [manualPricingOverrides]);

  const cartLockRef = useRef(false);

  // Save cart snapshot for undo (Ctrl+Z) - bounded stack prevents memory leak
  const saveCartSnapshot = useCallback(() => {
    // Create compressed snapshot with only essential data
    const snapshot = {
      items: cart.map(item => ({
        id_produk: item.id_produk,
        jumlah: item.jumlah,
        harga_satuan: item.harga_satuan,
        tipe_harga: item.tipe_harga,
        nama_produk: item.nama_produk,
        subtotal: item.subtotal
      })),
      timestamp: Date.now()
    };
    
    snapshotStackRef.current.push(snapshot);
    
    // Keep only last N snapshots (bounded memory)
    while (snapshotStackRef.current.length > MAX_SNAPSHOTS) {
      snapshotStackRef.current.shift(); // Remove oldest
    }
  }, [cart]);

  // Undo last action (restore from snapshot)
  const handleUndo = useCallback(() => {
    if (snapshotStackRef.current.length > 0) {
      const previousSnapshot = snapshotStackRef.current.pop();
      
      const restoredCart = previousSnapshot.items.map((item, idx) => {
        const original = cart[idx];
        if (original) {
          return { 
            ...original, 
            jumlah: item.jumlah,
            harga_satuan: item.harga_satuan,
            tipe_harga: item.tipe_harga,
            subtotal: item.subtotal
          };
        }
        return item;
      });
      
      setCart(restoredCart);
      showSuccess('Aksi dibatalkan');
    } else {
      showError('Tidak ada aksi untuk di-undo');
    }
  }, [cart, showSuccess, showError]);

  const handleAddToCart = useCallback((product, fromBarcodeScan = false, skipSearchFocus = false) => {
    // Prevent race conditions with mutex lock
    if (cartLockRef.current) {
      return; // Skip if already processing
    }
    
    // Save snapshot before making changes
    saveCartSnapshot();
    cartLockRef.current = true;
    
    try {
      const currentStock = getProductStock(product.id_produk);
      if (currentStock <= 0) {
        showErrorDebounced(`Stok produk ${product.nama_produk} habis.`);
        return;
      }

      let shouldShowWholesaleMessage = false;
      let wholesaleProductName = '';
      let wholesalePrice = 0;
      let hasInsufficientStock = false;

      setCart(prevCart => {
        const existingItem = prevCart.find(item => item.id_produk === product.id_produk);
        if (existingItem) {
          const newQuantity = existingItem.jumlah + 1;
          if (newQuantity > currentStock) {
            showErrorDebounced(`Stok tidak mencukupi. Maksimal ${currentStock} item.`);
            hasInsufficientStock = true;
            return prevCart;
          }
          const oldPricing = debugGetProductPricing(product, existingItem.jumlah);
          const pricing = debugGetProductPricing(product, newQuantity);
          
          // Check if price changed to wholesale
          if (!oldPricing.isWholesale && pricing.isWholesale) {
            shouldShowWholesaleMessage = true;
            wholesaleProductName = product.nama_produk;
            wholesalePrice = pricing.price;
          }
          return prevCart.map(item =>
            item.id_produk === product.id_produk
              ? { 
                  ...item, 
                  jumlah: newQuantity, 
                  harga_satuan: pricing.price,
                  tipe_harga: pricing.priceType,
                  subtotal: newQuantity * pricing.price 
                }
              : item
          );
        }
        const pricing = debugGetProductPricing(product, 1);
        
        // Check if new item qualifies for wholesale pricing
        if (pricing.isWholesale) {
          shouldShowWholesaleMessage = true;
          wholesaleProductName = product.nama_produk;
          wholesalePrice = pricing.price;
        }
        
        return [...prevCart, { 
          ...product, 
          jumlah: 1, 
          harga_satuan: pricing.price,
          tipe_harga: pricing.priceType,
          subtotal: pricing.price 
        }];
      });

      // Show wholesale message after state update
      if (shouldShowWholesaleMessage) {
        showSuccess(`Harga grosir aktif! ${wholesaleProductName} sekarang ${formatCurrency(wholesalePrice)} per item.`);
      }

      // Don't continue if stock was insufficient
      if (hasInsufficientStock) {
        return;
      }

      // Auto-focus behavior depends on source:
      // - Barcode scan: Keep focus on barcode input for continuous scanning
      // - Manual add: Focus search input for convenience
      if (!fromBarcodeScan && !skipSearchFocus) {
        setTimeout(() => {
          const searchInput = searchInputRef.current;
          if (searchInput) {
            searchInput.focus();
            searchInput.select(); // Select all text for easy replacement
          }
        }, 100);
      }

      // Clear selection/search term for next manual product add
      if (!fromBarcodeScan) {
        setSearchTerm('');
        setSelectedProductIndex(-1);
      }

      // Show success feedback
      showSuccess(`+ ${product.nama_produk}`);
    } finally {
      // Release lock after a short delay to prevent too rapid clicks
      setTimeout(() => {
        cartLockRef.current = false;
      }, 100);
    }
  }, [getProductStock, showErrorDebounced, showSuccess, debugGetProductPricing, saveCartSnapshot]);

  // Track input timing to detect rapid scanner input vs manual typing
  const lastInputTimeRef = useRef(0);

  const handleBarcodeScan = useCallback(async (barcode) => {
    if (!barcode || barcode.trim() === '') return;

    const now = Date.now();

    // Rate limiting: Ignore scans that are too close together (less than 200ms)
    if (now - lastScanTimeRef.current < 200) {
      logger.debug('Barcode scan ignored due to rate limiting');
      return;
    }

    // Clear search term when barcode scan succeeds - important for POS flow
    // This ensures product grid shows all products, not filtered results
    setSearchTerm('');
    setSelectedProductIndex(-1);

    // Debouncing: Clear any pending scan timeout using timeoutManager
    timeoutManager.current.clear('barcodeScan');

    // Set new timeout for debounced scan (100ms delay)
    timeoutManager.current.set('barcodeScan', async () => {
      // Check if products are still loading or array is empty
      // If empty, auto-load all products from API as fallback for barcode scanning
      if (products.length === 0 && !loading) {
        logger.debug('Products array empty, auto-loading all products for barcode scan...');
        try {
          const allProductsRes = await getProducts({
            limit: 1000,
            page: 1,
            status: 'aktif',
            sortBy: 'nama_produk',
            sortOrder: 'asc'
          });
          const loadedProducts = allProductsRes.data?.data || [];
          const enhancedProducts = loadedProducts.map(p => ({
            ...p,
            harga_jual: Number(p.harga_jual || 0),
            harga_beli: Number(p.harga_beli || 0),
            harga_grosir: Number(p.harga_grosir || 0),
            min_qty_grosir: Number(p.min_qty_grosir || 0),
            barcode: p.barcode || p.kode_produk,
          }));
          setProducts(enhancedProducts);
          logger.info(`✅ Auto-loaded ${enhancedProducts.length} products for barcode scan`);
        } catch (err) {
          logger.error('Failed to auto-load products for barcode scan:', err);
          showErrorDebounced('Gagal memuat produk untuk scan');
          return;
        }
      }

      if (loading) {
        logger.debug('Barcode scanned but products still loading, retrying in 500ms...');
        setTimeout(() => handleBarcodeScan(barcode), 500);
        return;
      }

      // Clean the barcode input - remove non-printable characters and extra whitespace
      const cleanedBarcode = barcode
        .replace(/[\r\n\t]/g, '') // Remove carriage return, newline, tab
        .replace(/\0/g, '') // Remove null characters
        .trim();

      if (!cleanedBarcode) return;

      logger.debug('Barcode scanned (cleaned):', cleanedBarcode);

      // First, try to find product in currently loaded products by kode_produk only
      let product = products.find(p =>
        p.kode_produk && p.kode_produk.toLowerCase() === cleanedBarcode.toLowerCase()
      );

      if (product) {
        logger.debug('Product found in loaded products:', product.nama_produk, 'via kode_produk');
        // Clear search before adding to cart
        setSearchTerm('');
        setSelectedProductIndex(-1);
        handleAddToCart(product, true); // true = from barcode scan
        // Ensure barcode input gets focus immediately after successful scan
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
          }
        }, 50);
        return;
      }

      // If not found in loaded products, try to search via API or offline
      logger.debug('Product not found in loaded products, searching...');
      try {
        let searchResults = [];

        // If offline, use offline search
        if (!isOnline) {
          logger.debug('Offline mode: using offline search for barcode...');
           // Pass isBarcodeScan=true to search ALL products without 50-item limit
          const offlineResults = await searchOfflineProducts(cleanedBarcode, true, { id_cabang: idCabangPengguna, tipe_katalog: tipeKatalog });
          searchResults = offlineResults;
        } else {
          // Online: use API search
          const searchRes = await getProducts({
            limit: 10,
            page: 1,
            status: 'aktif',
            search: cleanedBarcode,
            sortBy: 'nama_produk',
            sortOrder: 'asc'
          });
          searchResults = searchRes.data?.data || [];
        }

        // Look for exact match in search results by kode_produk only
        product = searchResults.find(p =>
          p.kode_produk && p.kode_produk.toLowerCase() === cleanedBarcode.toLowerCase()
        );

        if (product) {
          logger.debug('Product found via search:', product.nama_produk, 'via kode_produk');

          // Add the found product to the loaded products array
          const enhancedProduct = {
            ...product,
            harga_jual: Number(product.harga_jual || 0),
            harga_beli: Number(product.harga_beli || 0),
            harga_grosir: Number(product.harga_grosir || 0),
            min_qty_grosir: Number(product.min_qty_grosir || 0),
            barcode: product.barcode || product.kode_produk,
            // Get stock from product or cached stock info
            stok: Number(product.stok || stockInfo[product.id_produk] || 0)
          };

          setProducts(prevProducts => {
            // Check if product already exists to avoid duplicates
            const exists = prevProducts.find(p => p.id_produk === product.id_produk);
            if (!exists) {
              return [...prevProducts, enhancedProduct];
            }
            return prevProducts;
          });

          // Clear search before adding to cart
          setSearchTerm('');
          setSelectedProductIndex(-1);
          handleAddToCart(enhancedProduct, true); // true = from barcode scan
          // Update last scan time only on successful scan
          lastScanTimeRef.current = Date.now();
          // Ensure barcode input gets focus immediately after successful scan
          setTimeout(() => {
            if (barcodeInputRef.current) {
              barcodeInputRef.current.focus();
            }
          }, 50);
          return;
        }
      } catch (searchError) {
        logger.error('Search failed:', searchError);
        // Continue to show error message
      }

      // If still not found, show error with more detailed information
      logger.debug('No product found for barcode:', cleanedBarcode);
      logger.debug('Available products count:', products.length);
      logger.debug('Sample products:', products.slice(0, 3).map(p => ({ kode: p.kode_produk, barcode: p.barcode })));
      showErrorDebounced(`Produk dengan kode ${cleanedBarcode} tidak ditemukan. Pastikan produk sudah dimuat dan aktif.`);
    }, 100);
  }, [products, loading, isOnline, searchOfflineProducts, handleAddToCart, showErrorDebounced, stockInfo]);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, [loading]);

  // Ensure barcode input is ALWAYS focused and ready for scanner input
  // This is critical for POS - barcode input must be ready to receive scanner data at all times
  useEffect(() => {
    // Focus barcode input periodically when no popups are open
    // This ensures scanner input doesn't get lost if user accidentally clicked elsewhere
    const focusInterval = setInterval(() => {
      if (
        !showPaymentModal &&
        !showCameraScanner &&
        !showShortcutsModal &&
        !showCustomerPopup &&
        barcodeInputRef.current &&
        document.activeElement !== barcodeInputRef.current
      ) {
        // Only refocus if active element is not an important input
        const activeEl = document.activeElement;
        const isImportantInput =
          (activeEl?.tagName === 'INPUT' && 
            (activeEl === paymentAmountInputRef.current || 
             activeEl === searchInputRef.current)) ||
          activeEl?.tagName === 'SELECT' ||
          paymentPanelRef.current?.contains(activeEl) ||
          paymentModalRef.current?.contains(activeEl) ||
          (activeEl?.type === 'number' && activeEl?.closest('[data-cart-item]')); // Only quantity inputs in cart items
        
        // Allow focus to stay on search, payment select/input, or cart quantity inputs during user interaction
        // Otherwise ensure barcode input is focused
        if (!isImportantInput) {
          // Add a small delay and check again to avoid interrupting typing
          setTimeout(() => {
            const currentActive = document.activeElement;
            const isStillImportant =
              (currentActive?.tagName === 'INPUT' && 
                (currentActive === paymentAmountInputRef.current || 
                 currentActive === searchInputRef.current)) ||
              currentActive?.tagName === 'SELECT' ||
              paymentPanelRef.current?.contains(currentActive) ||
              paymentModalRef.current?.contains(currentActive) ||
              (currentActive?.type === 'number' && currentActive?.closest('[data-cart-item]'));
            
            if (!isStillImportant) {
              barcodeInputRef.current.focus();
            }
          }, 100);
        }
      }
    }, 2000); // Increase interval to 2 seconds to reduce flickering

    return () => clearInterval(focusInterval);
  }, [showPaymentModal, showCameraScanner, showShortcutsModal, showCustomerPopup]);

  // Ensure barcode input gets focus when clicking on POS area (except inputs)
  useEffect(() => {
    const handlePointerDown = (e) => {
      if (
        paymentPanelRef.current?.contains(e.target) ||
        paymentModalRef.current?.contains(e.target) ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'OPTION' ||
        e.target.closest('select')
      ) {
        paymentInteractionRef.current = true;
      }
    };

    const handleClickOutside = (e) => {
      if (paymentInteractionRef.current) {
        paymentInteractionRef.current = false;
        return;
      }

      // Don't refocus if clicking on input fields, buttons, selects, or modals
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'OPTION' ||
        e.target.tagName === 'BUTTON' ||
        e.target.closest('select') ||
        paymentPanelRef.current?.contains(e.target) ||
        paymentModalRef.current?.contains(e.target) ||
        e.target.closest('[role="dialog"]') ||
        e.target.closest('.modal') ||
        e.target.closest('[contenteditable]') ||
        e.target.closest('.border.rounded-lg.p-3') || // Product cards
        e.target.closest('.flex.items-center.justify-between.p-3') || // Cart items
        e.target.closest('.bg-gray-200.rounded') // Quantity buttons
      ) {
        return;
      }

      // Only refocus barcode input if it's not already focused and no important payment/select input is active
      const activeElement = document.activeElement;
      if (
        activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          paymentPanelRef.current?.contains(activeElement) ||
          paymentModalRef.current?.contains(activeElement) ||
          (activeElement.type === 'number' && activeElement.closest('[data-cart-item]'))
        )
      ) {
        return;
      }

      // Small delay to prevent interference with normal input
      setTimeout(() => {
        if (!document.activeElement || document.activeElement === document.body) {
          barcodeInputRef.current?.focus();
        }
      }, 50);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const subtotal = useMemo(() =>
    cart.reduce((sum, item) => sum + Number(item.subtotal || 0), 0), [cart]);

  const discountAmount = useMemo(() => {
    return appliedVoucher ? Number(appliedVoucher.diskon || 0) : 0;
  }, [appliedVoucher]);

  const totalBeforeTax = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);

  const paymentFee = useMemo(() => {
    const tax = posSettings?.enablePPN ? taxAmount : 0;
    const base = totalBeforeTax + tax;
    const nominal = Number(selectedPaymentMethod?.biaya_tambahan_nominal ?? selectedPaymentMethod?.biaya_tambahan ?? selectedPaymentMethod?.konfigurasi?.biaya_admin ?? 0) || 0;
    const persen = Number(selectedPaymentMethod?.biaya_tambahan_persen ?? 0) || 0;
    if (nominal > 0) return nominal;
    if (persen > 0) return (base * persen) / 100;
    return 0;
  }, [totalBeforeTax, taxAmount, posSettings?.enablePPN, selectedPaymentMethod?.biaya_tambahan_nominal, selectedPaymentMethod?.biaya_tambahan_persen, selectedPaymentMethod?.biaya_tambahan, selectedPaymentMethod?.konfigurasi]);

  const finalTotal = useMemo(() => {
    return Math.max(0, totalBeforeTax + (posSettings?.enablePPN ? taxAmount : 0) + Number(paymentFee || 0));
  }, [totalBeforeTax, taxAmount, posSettings?.enablePPN, paymentFee]);

  const change = useMemo(() => {
    return paymentAmount > finalTotal ? paymentAmount - finalTotal : 0;
  }, [paymentAmount, finalTotal]);

  const handleUpdateQuantity = useCallback((productId, newQuantity) => {
    saveCartSnapshot();
    const currentStock = getProductStock(productId);

    if (newQuantity > currentStock) {
      const productInStock = products.find(p => p.id_produk === productId);
      const nama = productInStock ? productInStock.nama_produk : 'Unknown';
      showErrorDebounced(`Stok untuk produk ${nama} tidak mencukupi.`);
      return;
    }

    if (newQuantity <= 0) {
      // Remove item from cart
      setCart(prevCart => prevCart.filter(item => item.id_produk !== productId));
      return;
    }

    let shouldShowWholesaleMessage = false;
    let wholesaleProductName = '';
    let wholesalePrice = 0;

    setCart(prevCart => {
      const updatedCart = prevCart.map(item => {
        if (item.id_produk === productId) {
          const oldPricing = debugGetProductPricing(item, item.jumlah);
          const pricing = debugGetProductPricing(item, newQuantity);
          
          // Check if price changed to wholesale
          if (!oldPricing.isWholesale && pricing.isWholesale) {
            shouldShowWholesaleMessage = true;
            wholesaleProductName = item.nama_produk;
            wholesalePrice = pricing.price;
          }
          
          return { 
            ...item, 
            jumlah: newQuantity,
            harga_satuan: pricing.price,
            tipe_harga: pricing.priceType,
            subtotal: newQuantity * pricing.price 
          };
        }
        return item;
      });
      return updatedCart;
    });

    // Show wholesale message after state update
    if (shouldShowWholesaleMessage) {
      showSuccess(`Harga grosir aktif! ${wholesaleProductName} sekarang ${formatCurrency(wholesalePrice)} per item.`);
    }
  }, [getProductStock, products, showErrorDebounced, showSuccess, debugGetProductPricing, saveCartSnapshot]);

  const handleSetManualPricing = useCallback((productId, pricingType) => {
    // Calculate new override value
    const newOverride = pricingType === 'auto' ? undefined : pricingType;
    
    setManualPricingOverrides(prev => {
      const newOverrides = { ...prev };
      if (pricingType === 'auto') {
        // Remove override for auto mode
        delete newOverrides[productId];
      } else {
        // Set manual override
        newOverrides[productId] = pricingType;
      }
      return newOverrides;
    });

    // Update cart with new pricing using the new override value
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id_produk === productId) {
          // Create a temporary pricing function with the new override
          const tempPricingFunc = (product, quantity) => {
            const hargaJual = Number(product.harga_jual || 0);
            const hargaGrosir = Number(product.harga_grosir || 0);
            const minQtyGrosir = Number(product.min_qty_grosir || 0);
            const override = newOverride; // Use the new override value

            let price, priceType, isWholesale;

            if (override === 'eceran') {
              price = hargaJual;
              priceType = 'eceran';
              isWholesale = false;
            } else if (override === 'grosir') {
              price = hargaGrosir > 0 ? hargaGrosir : hargaJual;
              priceType = 'grosir';
              isWholesale = true;
            } else {
              // Auto mode - check if wholesale pricing applies
              isWholesale = hargaGrosir > 0 && minQtyGrosir > 0 && quantity >= minQtyGrosir;
              price = isWholesale ? hargaGrosir : hargaJual;
              priceType = isWholesale ? 'grosir' : 'eceran';
            }

            return { price, priceType, isWholesale };
          };
          
          const pricing = tempPricingFunc(item, item.jumlah);
          return {
            ...item,
            harga_satuan: pricing.price,
            tipe_harga: pricing.priceType,
            subtotal: item.jumlah * pricing.price
          };
        }
        return item;
      });
    });
  }, []);

  const handleRemoveFromCart = useCallback((productId) => {
    saveCartSnapshot();
    setCart(prevCart => prevCart.filter(item => item.id_produk !== productId));
    // Also remove manual pricing override for this product
    setManualPricingOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[productId];
      return newOverrides;
    });
  }, [saveCartSnapshot]);

  const validateStockAvailability = useCallback(async (retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
      // Refresh stock data before validation to ensure we have latest data
      if (getConnectionStatus().isOnline) {
        const stockReportRes = await getStockReport();
        const stockReportData = stockReportRes.data.data || [];
        const stockMap = {};
        stockReportData.forEach(productStock => {
          if (productStock.detail_lokasi?.cabang && Array.isArray(productStock.detail_lokasi.cabang)) {
            const cabangStock = productStock.detail_lokasi.cabang.find(c => c.id_cabang === idCabangPengguna);
            stockMap[productStock.id_produk] = cabangStock?.stok || 0;
          }
        });
        setStockInfo(stockMap);
      }

      // Real-time stock validation
      for (const item of cart) {
        const currentStock = getProductStock(item.id_produk);
        const requiredQuantity = item.jumlah;

        if (currentStock < requiredQuantity) {
          const errorMsg = `Stok ${item.nama_produk} tidak mencukupi. Tersedia: ${currentStock}, dibutuhkan: ${requiredQuantity}`;
          showError(errorMsg);
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error('Stock validation error:', error);

      // Retry logic for network errors
      if (retryCount < MAX_RETRIES && getConnectionStatus().isOnline) {
        logger.info(`Retrying stock validation (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return validateStockAvailability(retryCount + 1);
      }

      // If offline or max retries reached, use cached stock data
      logger.warn('Using cached stock data for validation');
      for (const item of cart) {
        const currentStock = getProductStock(item.id_produk);
        const requiredQuantity = item.jumlah;

        if (currentStock < requiredQuantity) {
          const errorMsg = `Stok ${item.nama_produk} tidak mencukupi (data cache). Tersedia: ${currentStock}, dibutuhkan: ${requiredQuantity}`;
          showError(errorMsg);
          return false;
        }
      }
      return true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, getProductStock, getConnectionStatus, idCabangPengguna]);

  const handleSubmit = useCallback(async () => {
    // Initialize performance monitoring for this transaction
    const perfMonitor = new PerformanceMonitor('Transaction');
    const progress = new SubmissionProgressHandler({ isOnline: getConnectionStatus().isOnline });
    perfMonitor.mark('start');

    // Block submissions while sync is active
    if (isSyncLocked()) {
      showError('Sinkronisasi sedang berlangsung. Tunggu sampai selesai sebelum membuat transaksi baru.');
      return;
    }

    // Check for offline mode and show warning
    const isOnlineMode = getConnectionStatus().isOnline;
    if (!isOnlineMode && cart.length > 0) {
      setShowOfflineWarning(true);
      return; // User must confirm offline transaction
    }

    // Basic validation with better error handling
    const validations = [
      { 
        condition: cart.length === 0,
        error: 'Keranjang masih kosong.',
        key: 'empty-cart'
      },
      {
        condition: !user || !user.id_user || !user.id_cabang,
        error: 'Data pengguna tidak lengkap.',
        key: 'incomplete-user'
      },
      {
        condition: !selectedPaymentMethod,
        error: 'Pilih metode pembayaran terlebih dahulu.',
        key: 'no-payment-method'
      },
      {
        condition: paymentAmount < 0,
        error: 'Jumlah pembayaran tidak boleh negatif.',
        key: 'negative-payment'
      },
      {
        condition: paymentAmount === 0 && !isPendingPayment && !pendingPaymentRef.current,
        error: 'Masukkan jumlah pembayaran atau centang "Tandai sebagai pembayaran pending" untuk pembayaran nanti.',
        key: 'zero-payment'
      },
      {
        condition: paymentAmount < finalTotal && paymentAmount > 0 && !isPendingPayment,
        error: 'Jumlah pembayaran kurang dari total yang harus dibayar. Centang "Tandai sebagai pembayaran pending" untuk melanjutkan.',
        key: 'insufficient-payment'
      }
    ];

    for (const validation of validations) {
      if (validation.condition) {
        const mapped = mapErrorToUserMessage(validation.error);
        showError(`${mapped.userMessage}\n${mapped.recovery}`);
        return;
      }
    }

    // Real-time stock validation
    if (!(await validateStockAvailability())) {
      return;
    }

    // Validate product existence on server (online only) + Stock validation combined
    if (isOnlineMode) {
      try {
        progress.show('VALIDATING');
        logger.debug('Validating product existence and stock on server...');
        const startTime = performance.now();
        
        // Parallel validation: validate all products at once instead of sequentially
        const validationPromises = cart.map(item =>
          getProductById(item.id_produk)
            .then(res => {
              const product = extractData(res);
              // Combined check: product exists AND has sufficient stock
              const availableStock = product?.stok || 0;
              if (availableStock < item.jumlah) {
                return { 
                  id: item.id_produk, 
                  name: item.nama_produk, 
                  valid: false, 
                  reason: 'insufficient_stock',
                  availableStock
                };
              }
              return { id: item.id_produk, name: item.nama_produk, valid: true };
            })
            .catch(err => ({ 
              id: item.id_produk, 
              name: item.nama_produk, 
              valid: false, 
              reason: 'not_found',
              error: err 
            }))
        );
        
        const results = await Promise.all(validationPromises);
        const validationTime = performance.now() - startTime;
        
        // Check for any validation failures
        const failures = results.filter(r => !r.valid);
        if (failures.length > 0) {
          const insufficientStock = failures.filter(f => f.reason === 'insufficient_stock');
          const notFound = failures.filter(f => f.reason === 'not_found');
          
          let errorMsg = [];
          if (insufficientStock.length > 0) {
            const items = insufficientStock.map(f => `${f.name} (tersedia: ${f.availableStock})`).slice(0, 2).join(', ');
            errorMsg.push(`Stok tidak cukup: ${items}`);
          }
          if (notFound.length > 0) {
            const items = notFound.map(f => `"${f.name}"`).slice(0, 2).join(', ');
            errorMsg.push(`Produk tidak ditemukan: ${items}`);
          }
          
          progress.error(`Validasi gagal: ${errorMsg.join('; ')}`);
          showError(`Validasi produk gagal:\n${errorMsg.join('\n')}\nSilakan periksa ulang produk dan stok.`);
          return;
        }
        
        logger.debug(`✅ Product validation completed successfully (${validationTime.toFixed(0)}ms)`);
        progress.show('CREATING_SALE');
      } catch (error) {
        const mapped = mapErrorToUserMessage(error);
        logger.error('Product validation error:', error);
        progress.error(`Validasi error: ${mapped.userMessage}`);
        // Don't block the sale for network errors, just log
      }
      
      perfMonitor.mark('afterValidation');
    }

    // Validate cart item data integrity
    for (const item of cart) {
      const idProduk = Number(item.id_produk);
      const quantity = Number(item.jumlah);
      const harga = Number(item.harga_satuan);

      if (isNaN(idProduk) || isNaN(quantity) || isNaN(harga) || idProduk <= 0 || quantity <= 0 || harga <= 0) {
        showError(`Item ${item.nama_produk || 'unknown'} memiliki data yang tidak valid.`);
        return;
      }
    }

    const saleData = {
      kode_transaksi: `POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      id_cabang: Number(user.id_cabang),
      id_user: Number(user.id_user),
      bayar: paymentAmount,
      items: cart.map(({ id_produk, harga_satuan, jumlah, tipe_harga }) => ({
        id_produk: Number(id_produk),
        jumlah: Number(jumlah),
        harga_jual: Number(harga_satuan),
        tipe_harga: tipe_harga || 'eceran'
      }))
    };

    // Only include optional fields if they have valid values
    if (selectedCustomer?.id_pelanggan) {
      saleData.id_pelanggan = Number(selectedCustomer.id_pelanggan);
      // Include loyalty tier - set to null if not available to prevent database error
      saleData.id_tier_loyalitas = selectedCustomer.id_tier_loyalitas ? Number(selectedCustomer.id_tier_loyalitas) : null;
    }
    if (discountAmount > 0) {
      saleData.diskon = Number(discountAmount);
    }
    if (posSettings?.enablePPN && taxAmount > 0) {
      saleData.pajak = Number(taxAmount);
    }
    if (selectedPaymentMethod?.biaya_tambahan > 0) {
      saleData.biaya_tambahan = Number(selectedPaymentMethod.biaya_tambahan);
    }

    try {
      setIsSubmitting(true);
      const isOnline = getConnectionStatus().isOnline;

      let saleId;
      let isOfflineTransaction = false;

      if (isOnline) {
        // Online mode: submit to server
        try {
          perfMonitor.mark('beforeCreateSale');
          const saleResponse = await createSale(saleData);
          perfMonitor.mark('afterCreateSale');
          const saleResult = extractData(saleResponse);
          
          // Validate response structure and extracted data
          if (!saleResult || typeof saleResult !== 'object') {
            throw new Error('Invalid sale response format received from server');
          }
          
          saleId = saleResult.id_penjualan || saleResult.id;

          if (!saleId) {
            throw new Error('Server did not return sale ID. Please contact support if this persists.');
          }
        } catch (saleErr) {
          logger.error('Failed to create sale:', saleErr);
          throw new Error(`Gagal membuat transaksi: ${saleErr.message || 'Unknown error'}`);
        }

        // Record payment - use pending if marked as such or if partial payment
        const paymentData = {
          id_metode_pembayaran: selectedPaymentMethod.id_metode_pembayaran || selectedPaymentMethod.id,
          jumlah_bayar: paymentAmount
        };

        try {
          perfMonitor.mark('beforePayment');
          if (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) {
            logger.debug('Calling createPaymentPending with paymentAmount:', paymentAmount);
            await createPaymentPending(saleId, paymentData);
            logger.debug('createPaymentPending completed successfully');
          } else {
            logger.debug('Calling recordPayment with paymentAmount:', paymentAmount);
            await recordPayment(saleId, paymentData);
            logger.debug('recordPayment completed successfully');
          }
          perfMonitor.mark('afterPayment');
        } catch (paymentErr) {
          logger.error('Payment recording failed:', paymentErr);
          throw new Error(`Penjualan tercatat tapi gagal merekam pembayaran: ${paymentErr.message || 'Unknown error'}`);
        }
      } else {
        // Offline mode: save to local database via IPC
        isOfflineTransaction = true;

        // Validate that all products exist in offline database before saving offline transaction
        try {
          for (const cartItem of cart) {
            const offlineProduct = await searchOfflineProducts(cartItem.kode_produk || cartItem.id_produk, true, { id_cabang: idCabangPengguna, tipe_katalog: tipeKatalog });
            if (!offlineProduct || offlineProduct.length === 0) {
              throw new Error(`Produk ${cartItem.nama_produk} tidak ditemukan dalam database offline. Transaksi tidak dapat disimpan.`);
            }
          }
          logger.debug('Offline products validation passed for', cart.length, 'items');
        } catch (validationErr) {
          logger.error('Offline product validation failed:', validationErr);
          throw validationErr;
        }

        // Generate a temporary ID for offline transaction
        const tempSaleId = createTemporarySaleId();

        // Prepare sale data
        const offlineSaleData = {
          id_penjualan: tempSaleId,
          kode_transaksi: saleData.kode_transaksi,
          id_cabang: saleData.id_cabang,
          id_user: saleData.id_user,
          id_pelanggan: saleData.id_pelanggan || null,
          tanggal: new Date().toISOString(),
          total: finalTotal,
          bayar: paymentAmount,
          kembalian: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 0 : paymentAmount - finalTotal,
          sisa_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? finalTotal - paymentAmount : 0,
          status_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 'pending' : 'lunas'
        };

        // Prepare items and payments
        const items = cart.map(item => ({
          id_produk: item.id_produk,
          jumlah: item.jumlah,
          harga_satuan: item.harga_satuan,
          tipe_harga: item.tipe_harga,
          subtotal: item.subtotal
        }));

        const payments = [{
          id_metode_pembayaran: selectedPaymentMethod.id_metode_pembayaran || selectedPaymentMethod.id,
          jumlah_bayar: paymentAmount
        }];

        // Save to offline database via IPC
        if (window.electronAPI && window.electronAPI.dbSaveSale) {
          await window.electronAPI.dbSaveSale({ saleData: offlineSaleData, items, payments });
        } else {
          throw new Error('Offline database not available');
        }

        saleId = tempSaleId;
      }

      // Log audit trail untuk transaksi penjualan (only if online)
      if (isOnline) {
        try {
          await createLogAktivitas({
            aktivitas: `Penjualan: ${saleData.kode_transaksi} - Total: Rp${finalTotal.toLocaleString('id-ID')} - Items: ${cart.length} produk`
          });
        } catch (auditError) {
          logger.warn('Failed to log sale audit:', auditError);
        }
      }

      // Prepare data for receipt printing
      const receiptData = {
        id: saleId,
        no_struk: `POS-${saleId}`,
        tanggal: new Date().toISOString(),
        kasir: user.nama || user.username,
        items: cart.map(item => ({
          id_produk: item.id_produk,
          nama_produk: item.nama_produk,
          jumlah: item.jumlah,
          harga_satuan: item.harga_satuan,
          tipe_harga: item.tipe_harga,
          subtotal: item.subtotal
        })),
        total: finalTotal,
        bayar: paymentAmount,
        kembali: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 0 : paymentAmount - finalTotal,
        sisa_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? finalTotal - paymentAmount : 0,
        status_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 'pending' : 'lunas',
        metode_pembayaran: selectedPaymentMethod,
        diskon: discountAmount,
        pajak: posSettings?.enablePPN ? taxAmount : 0,
        pelanggan: selectedCustomer
      };

      const successMessage = isOfflineTransaction
        ? `Transaksi berhasil disimpan offline! ID: ${saleId} (akan disinkronkan saat online)`
        : isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal
        ? `Transaksi berhasil dengan pembayaran pending! ID: ${saleId} - Sisa pembayaran: ${formatCurrency(Math.max(0, finalTotal - paymentAmount))}`
        : `Transaksi berhasil! ID: ${saleId}`;

      showSuccess(successMessage);
      
      // Batch all state updates together for better performance
      perfMonitor.mark('beforeStateUpdates');
      unstable_batchedUpdates(() => {
        setShowPaymentModal(false);
        setShowPrintModal(true);
        setSaleDataForPrint(receiptData);
        setLastTransaction(receiptData);
        setCart([]);
        setManualPricingOverrides({});
        setAppliedVoucher(null);
        setSelectedCustomer(null);
        setTaxAmount(0);
        setSelectedPaymentMethod(null);
        setPaymentAmount(0);
        setIsPendingPayment(false);
      });
      pendingPaymentRef.current = false;

      perfMonitor.mark('afterStateUpdates');

      // Open cash drawer if payment method is cash and payment is complete (not pending)
      const isCashPayment = selectedPaymentMethod && (
        (selectedPaymentMethod.tipe && selectedPaymentMethod.tipe.toLowerCase() === 'cash') ||
        (selectedPaymentMethod.nama_metode && selectedPaymentMethod.nama_metode.toLowerCase().includes('tunai')) ||
        (selectedPaymentMethod.nama_metode && selectedPaymentMethod.nama_metode.toLowerCase().includes('cash'))
      );
      
      const isPaymentComplete = !(isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal);
      
      if (isCashPayment && isPaymentComplete && window.electronAPI && window.electronAPI.openCashDrawer) {
        try {
          logger.info('Opening cash drawer for cash payment');
          await window.electronAPI.openCashDrawer();
        } catch (drawerError) {
          logger.warn('Failed to open cash drawer:', drawerError);
          // Don't show error to user as transaction was successful
        }
      }

      // Refresh stock data
      const stockReportRes = await getStockReport();
      const stockReportData = stockReportRes.data.data || [];
      const stockMap = {};
      stockReportData.forEach(productStock => {
        // Find stock for current user's cabang in the cabang array
        if (productStock.detail_lokasi?.cabang && Array.isArray(productStock.detail_lokasi.cabang)) {
          const cabangStock = productStock.detail_lokasi.cabang.find(c => c.id_cabang === idCabangPengguna);
          stockMap[productStock.id_produk] = cabangStock?.stok || 0;
        }
      });
      setStockInfo(stockMap);

    } catch (err) {
      logger.error('Error in handleSubmit:', err);
      console.error('DEBUG PosPage: Error response:', err?.response);
      console.error('DEBUG PosPage: Error message:', err?.response?.data?.message);
      
      // Map error to user-friendly message
      const mapped = mapErrorToUserMessage(err);
      
      // Show detailed error with recovery suggestion
      const recovery = getRecoverySuggestion(err);
      showError(`❌ ${mapped.userMessage}\n\n💡 ${recovery}`);
      
      progress.error(mapped.userMessage);
    } finally {
      // Record performance measurements
      perfMonitor.measure('ProductValidation', 'start', 'afterValidation');
      perfMonitor.measure('SaleCreation', 'beforeCreateSale', 'afterCreateSale');
      perfMonitor.measure('PaymentRecording', 'beforePayment', 'afterPayment');
      perfMonitor.measure('StateUpdates', 'beforeStateUpdates', 'afterStateUpdates');
      
      // Log performance metrics for monitoring
      perfMonitor.log();
      
      progress.dismiss();
      setIsSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, user, selectedPaymentMethod, paymentAmount, finalTotal, selectedCustomer, discountAmount, posSettings, taxAmount, isPendingPayment, getConnectionStatus, idCabangPengguna, tipeKatalog, validateStockAvailability, searchOfflineProducts]);

  // Handle offline transaction confirmation
  const handleOfflineConfirm = useCallback(async () => {
    setShowOfflineWarning(false);
    // Continue with handleSubmit logic for offline
    setIsSubmitting(true);
    const perfMonitor = new PerformanceMonitor('Transaction-Offline');
    perfMonitor.mark('start');
    
    try {
      // Offline transaction flow (simplified - no server validation)
      const tempSaleId = createTemporarySaleId();
      const offlineSaleData = {
        id_penjualan: tempSaleId,
        kode_transaksi: `POS-${tempSaleId}`,
        id_cabang: Number(user.id_cabang),
        id_user: Number(user.id_user),
        id_pelanggan: selectedCustomer?.id_pelanggan ? Number(selectedCustomer.id_pelanggan) : null,
        tanggal: new Date().toISOString(),
        total: finalTotal,
        bayar: paymentAmount,
        kembalian: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 0 : paymentAmount - finalTotal,
        sisa_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? finalTotal - paymentAmount : 0,
        status_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 'pending' : 'lunas'
      };

      const items = cart.map(item => ({
        id_produk: item.id_produk,
        jumlah: item.jumlah,
        harga_satuan: item.harga_satuan,
        tipe_harga: item.tipe_harga,
        subtotal: item.subtotal
      }));

      const payments = [{
        id_metode_pembayaran: selectedPaymentMethod.id_metode_pembayaran || selectedPaymentMethod.id,
        jumlah_bayar: paymentAmount
      }];

      // Save to offline database
      if (window.electronAPI && window.electronAPI.dbSaveSale) {
        await window.electronAPI.dbSaveSale({ saleData: offlineSaleData, items, payments });
        showSuccess(`✅ Transaksi disimpan offline! ID: ${tempSaleId}\n(akan disinkronkan saat online)`);
      } else {
        throw new Error('Offline database tidak tersedia');
      }

      // Prepare receipt data
      const receiptData = {
        id: tempSaleId,
        no_struk: `POS-${tempSaleId}`,
        tanggal: new Date().toISOString(),
        kasir: user.nama || user.username,
        items: cart,
        total: finalTotal,
        bayar: paymentAmount,
        kembali: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 0 : paymentAmount - finalTotal,
        sisa_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? finalTotal - paymentAmount : 0,
        status_pembayaran: (isPendingPayment || pendingPaymentRef.current || paymentAmount < finalTotal) ? 'pending' : 'lunas',
        metode_pembayaran: selectedPaymentMethod,
        diskon: discountAmount,
        pajak: posSettings?.enablePPN ? taxAmount : 0,
        pelanggan: selectedCustomer,
        offline: true
      };

      // Batch state updates
      unstable_batchedUpdates(() => {
        setShowPaymentModal(false);
        setShowPrintModal(true);
        setSaleDataForPrint(receiptData);
        setLastTransaction(receiptData);
        setCart([]);
        setAppliedVoucher(null);
        setSelectedCustomer(null);
        setTaxAmount(0);
        setPaymentAmount(0);
        setIsPendingPayment(false);
      });
      
      perfMonitor.mark('complete');
      perfMonitor.log();
    } catch (err) {
      const mapped = mapErrorToUserMessage(err);
      showError(`❌ Gagal menyimpan transaksi offline:\n${mapped.userMessage}`);
      logger.error('Offline transaction error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [cart, user, selectedCustomer, finalTotal, paymentAmount, selectedPaymentMethod, discountAmount, posSettings, taxAmount, isPendingPayment, showError, showSuccess, createTemporarySaleId]);

  // Handle discount dialog apply
  const handleDiscountApply = useCallback((discountAmount) => {
    setAppliedVoucher({ diskon: discountAmount });
    if (discountAmount > 0) {
      showSuccess(`Diskon Rp ${formatCurrency(discountAmount)} diterapkan`);
    } else {
      showSuccess('Diskon dihapus');
    }
  }, [showSuccess]);

  // Handle window focus/blur to ensure proper input handling
  useEffect(() => {
    // Only skip in specific Electron packaged environments that have click interference issues
    // Don't skip just because electronAPI exists or not localhost
    const isPackagedWithInterference = window.electronAPI && window.process?.env?.NODE_ENV === 'production';

    if (isPackagedWithInterference) {
      return;
    }

    const handleWindowFocus = () => {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          activeElement.focus();
        }
      }, 100);
    };

    const handleWindowBlur = () => {
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip most shortcuts if shortcut modal is open (allow Esc, F1, Alt+B only)
      if (showShortcutsModal && e.key !== 'Escape' && e.key !== 'F1' && !(e.key === 'b' && e.altKey)) {
        return;
      }
      
      const isSearchInput = e.target === searchInputRef.current;
      const isPaymentAmountInput = e.target === paymentAmountInputRef.current;
      
      // F1: HELP / Shortcuts Modal
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
        return;
      }

      // F2: SEARCH PRODUCTS (existing - keep same)
      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = searchInputRef.current;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          setFocusedSection('search');
          setSelectedProductIndex(-1);
          setCurrentKeyboardHint('Ketik untuk cari produk • ↓ untuk navigasi • ↵ untuk pilih');
        }
        return;
      }

      // F3: BARCODE SCANNER (standar untuk scan produk)
      if (e.key === 'F3') {
        e.preventDefault();
        setShowCameraScanner(true);
        setCurrentKeyboardHint('📷 Scanner barcode aktif • Esc untuk tutup');
        return;
      }

      // F4: Fokus ke nominal pembayaran
      if (e.key === 'F4' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (showPaymentModal || selectedPaymentMethod) {
          e.preventDefault();
          if (paymentAmountInputRef.current) {
            paymentAmountInputRef.current.focus();
            paymentAmountInputRef.current.select();
            setFocusedSection('payment-amount');
            setCurrentKeyboardHint('Masukkan nominal pembayaran • Ctrl+0 untuk total');
          }
          return;
        }
      }

      // F5: CUSTOMER SEARCH
      if (e.key === 'F5' && posSettings?.showCustomerSearch) {
        e.preventDefault();
        setShowCustomerPopup(prev => {
          const willOpen = !prev;
          if (willOpen) {
            setTimeout(() => {
              if (customerSearchRef.current) {
                customerSearchRef.current.focus();
                customerSearchRef.current.select();
              }
            }, 100);
            setCurrentKeyboardHint('Cari pelanggan • Ketik nama/nomor member • ↵ untuk pilih');
          }
          return willOpen;
        });
        return;
      }

      // F6: DISCOUNT
      if (e.key === 'F6' && cart.length > 0 && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
        setShowDiscountDialog(true);
        setCurrentKeyboardHint('Dialog Diskon • Masukkan nominal atau persentase • ↵ terapkan');
        return;
      }

      // F7: PAYMENT METHOD (focus to payment method selector)
      if (e.key === 'F7') {
        e.preventDefault();
        setFocusedSection('payment');
        const paymentMethodSelect = document.getElementById('payment-method-select');
        if (paymentMethodSelect) {
          paymentMethodSelect.focus();
          setCurrentKeyboardHint('💳 Pilih metode pembayaran • ↑↓ untuk pilih • ↵ untuk confirm');
        }
        return;
      }

      // F8: OPEN CASH DRAWER
      if (e.key === 'F8') {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.openCashDrawer) {
          setIsOpeningCashDrawer(true);
          window.electronAPI.openCashDrawer()
            .then(() => showSuccess('Cash drawer berhasil dibuka'))
            .catch((error) => {
              console.error('Failed to open cash drawer:', error);
              showError('Gagal membuka cash drawer');
            })
            .finally(() => setIsOpeningCashDrawer(false));
        } else {
          showError('Cash drawer tidak tersedia');
        }
        return;
      }

      // F12 / End: OPEN PAYMENT MODAL
      if (e.key === 'F12' || e.key === 'End') {
        e.preventDefault();
        if (cart.length === 0) {
          showError('Keranjang masih kosong. Tambahkan produk terlebih dahulu.');
          return;
        }
        setShowPaymentModal(true);
        setCurrentKeyboardHint('Modal Pembayaran • F4 untuk input nominal • Ctrl+0 untuk total');
        return;
      }

      // Alt+B: BARCODE SCANNER (alternative for F3)
      if (e.key === 'b' && e.altKey) {
        e.preventDefault();
        setShowCameraScanner(true);
        setCurrentKeyboardHint('📷 Barcode Scanner aktif • Arahkan ke barcode • Esc untuk tutup');
        return;
      }

      // ============ NEW SHORTCUTS FOR NAVIGATION AND PRINT ============

      // F10: NAVIGATE TO PURCHASE MANAGEMENT PAGE
      if (e.key === 'F10') {
        e.preventDefault();
        navigate('/pembelian');
        showSuccess('Navigasi ke halaman manajemen pembelian');
        return;
      }

      // F11: NAVIGATE TO SALES HISTORY PAGE
      if (e.key === 'F11') {
        e.preventDefault();
        navigate('/penjualan');
        showSuccess('Navigasi ke riwayat penjualan');
        return;
      }

      // Ctrl+P: REPRINT LAST TRANSACTION
      if (e.key === 'p' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (lastTransaction) {
          setSaleDataForPrint(lastTransaction);
          showSuccess('Menampilkan modal print ulang transaksi terakhir');
        } else {
          showError('Tidak ada transaksi terakhir untuk di-print ulang');
        }
        return;
      }

      // ============ CONTROL + NUMBER SHORTCUTS (Quick Payment Amounts) ============
      
      // Ctrl+1: Quick payment Rp 10.000
      if (e.key === '1' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(10000);
        showSuccess('Nominal Rp 10.000 diisi');
        return;
      }

      // Ctrl+2: Quick payment Rp 20.000
      if (e.key === '2' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(20000);
        showSuccess('Nominal Rp 20.000 diisi');
        return;
      }

      // Ctrl+3: Quick payment Rp 50.000
      if (e.key === '3' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(50000);
        showSuccess('Nominal Rp 50.000 diisi');
        return;
      }

      // Ctrl+4: Quick payment Rp 100.000
      if (e.key === '4' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(100000);
        showSuccess('Nominal Rp 100.000 diisi');
        return;
      }

      // Ctrl+0: Auto-fill payment to match total
      if (e.key === '0' && e.ctrlKey && !e.shiftKey && cart.length > 0) {
        e.preventDefault();
        setPaymentAmount(finalTotal);
        showSuccess(`Nominal Rp ${finalTotal.toLocaleString('id-ID')} (Total Tagihan) diisi`);
        return;
      }

      // Ctrl+Enter: CHECKOUT (Direct submit)
      if (e.key === 'Enter' && e.ctrlKey && cart.length > 0) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // Ctrl+Del / Ctrl+Backspace: QUICK CLEAR CART
      if ((e.key === 'Delete' || e.key === 'Backspace') && e.ctrlKey && cart.length > 0) {
        e.preventDefault();
        setConfirmDialog({
          isOpen: true,
          title: 'Kosongkan Keranjang',
          message: 'Apakah Anda yakin ingin menghapus semua item dari keranjang belanja?',
          confirmText: 'Ya, Kosongkan',
          onConfirm: () => {
            setCart([]);
            setManualPricingOverrides({});
            setSelectedCustomer(null);
            setAppliedVoucher(null);
            showSuccess('Keranjang dikosongkan');
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          },
          variant: 'danger'
        });
        return;
      }

      // ============ ALT + LETTER: QUICK SECTION NAVIGATION ============

      // Alt+P: Go to Products section (search)
      if (e.key === 'p' && e.altKey) {
        e.preventDefault();
        setFocusedSection('search');
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        setCurrentKeyboardHint('Navigasi ke Cari Produk • Ketik untuk cari');
        return;
      }

      // Alt+C: Go to Cart section
      if (e.key === 'c' && e.altKey) {
        e.preventDefault();
        if (cart.length > 0) {
          setFocusedSection('cart');
          setCartFocusedIndex(0);
          setCurrentKeyboardHint('Navigasi ke Keranjang • ↑↓ untuk pilih item • +/- untuk qty');
        } else {
          showError('Keranjang masih kosong');
        }
        return;
      }

      // Alt+M: Go to Payment section (Metode/Means)
      if (e.key === 'm' && e.altKey) {
        e.preventDefault();
        if (cart.length === 0) {
          showError('Tambahkan produk ke keranjang terlebih dahulu');
          return;
        }
        setFocusedSection('payment');
        const paymentMethodSelect = document.getElementById('payment-method-select');
        if (paymentMethodSelect) {
          paymentMethodSelect.focus();
        }
        setCurrentKeyboardHint('Navigasi ke Pembayaran • Pilih metode pembayaran');
        return;
      }

      // ============ NAVIGATION & MODAL BLOCKING ============
      
      // Allow Escape, F1, Alt+B anytime, block other shortcuts in modals
      if (
        (showCustomerPopup || showCameraScanner || showPrintModal) &&
        e.key !== 'Escape' &&
        !(e.key === 'F1') &&
        !(e.key === 'b' && e.altKey) &&
        !(e.key === 'Enter' && e.ctrlKey)
      ) {
        return;
      }

      // Escape: Close modals or clear search
      if (e.key === 'Escape') {
        if (showPaymentModal) {
          setShowPaymentModal(false);
          setCurrentKeyboardHint('Modal pembayaran ditutup');
          return;
        }
        if (showPrintModal) {
          setShowPrintModal(false);
          return;
        }
        if (showCustomerPopup) {
          setShowCustomerPopup(false);
          if (searchInputRef.current) searchInputRef.current.focus();
          return;
        }
        if (showCameraScanner) {
          setShowCameraScanner(false);
          if (searchInputRef.current) searchInputRef.current.focus();
          return;
        }
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
          return;
        }
        // Clear search
        setSearchTerm('');
        setFocusedSection('search');
        setSelectedProductIndex(-1);
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          setCurrentKeyboardHint('Pencarian dibersihkan • F2 untuk cari atau scan produk');
        }
        return;
      }

      // ============ ARROW KEY NAVIGATION ============
      
      // Arrow Up - Navigate upward through sections
      if (e.key === 'ArrowUp' && !(e.target.tagName === 'TEXTAREA') && (isSearchInput || e.target.tagName !== 'INPUT')) {
        e.preventDefault();
        
        if (focusedSection === 'search' || focusedSection === 'products') {
          if (filteredProducts.length > 0) {
            setFocusedSection('products');
            const nextIndex = getNextProductIndex('up', selectedProductIndex);
            if (nextIndex === -1) {
              setFocusedSection('search');
              setSelectedProductIndex(-1);
              if (searchInputRef.current) searchInputRef.current.focus();
            } else {
              setSelectedProductIndex(nextIndex);
            }
          }
          return;
        }
        
        if (focusedSection.startsWith('payment')) {
          if (focusedSection === 'payment-submit') {
            if (pendingCheckboxRef.current) {
              pendingCheckboxRef.current.focus();
              setFocusedSection('payment-pending');
            } else if (paymentAmountInputRef.current) {
              paymentAmountInputRef.current.focus();
              setFocusedSection('payment-amount');
            } else {
              setFocusedSection('payment');
              const paymentMethodSelect = document.getElementById('payment-method-select');
              if (paymentMethodSelect) paymentMethodSelect.focus();
            }
          } else if (focusedSection === 'payment-pending') {
            if (paymentAmountInputRef.current) {
              paymentAmountInputRef.current.focus();
              setFocusedSection('payment-amount');
            } else {
              setFocusedSection('payment');
            }
          } else if (focusedSection === 'payment-amount') {
            setFocusedSection('payment');
            const paymentMethodSelect = document.getElementById('payment-method-select');
            if (paymentMethodSelect) paymentMethodSelect.focus();
          } else if (focusedSection === 'payment') {
            const cartLastItem = document.querySelectorAll('[data-cart-item]');
            if (cartLastItem.length > 0) {
              cartLastItem[cartLastItem.length - 1].focus();
              setFocusedSection('cart');
              setCartFocusedIndex(cart.length - 1);
            }
          }
          return;
        }

        if (focusedSection === 'cart') {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            setFocusedSection('search');
            setCartFocusedIndex(-1);
          }
          return;
        }
      }

      // Arrow Down - Navigate downward through sections
      if (e.key === 'ArrowDown' && !(e.target.tagName === 'TEXTAREA') && (isSearchInput || e.target.tagName !== 'INPUT')) {
        e.preventDefault();
        
        if (focusedSection === 'search' || focusedSection === 'products') {
          if (filteredProducts.length > 0) {
            setFocusedSection('products');
            const nextIndex = getNextProductIndex('down', selectedProductIndex);
            if (nextIndex === -1) {
              const cartFirstItem = document.querySelector('[data-cart-item]');
              if (cartFirstItem) {
                cartFirstItem.focus();
                setFocusedSection('cart');
                setCartFocusedIndex(0);
              }
            } else {
              setSelectedProductIndex(nextIndex);
            }
          } else {
            const cartFirstItem = document.querySelector('[data-cart-item]');
            if (cartFirstItem) {
              cartFirstItem.focus();
              setFocusedSection('cart');
              setCartFocusedIndex(0);
            }
          }
          return;
        }

        if (focusedSection === 'cart') {
          setFocusedSection('payment');
          setCartFocusedIndex(-1);
          const paymentMethodSelect = document.getElementById('payment-method-select');
          if (paymentMethodSelect) paymentMethodSelect.focus();
          return;
        }

        if (focusedSection === 'payment') {
          if (paymentAmountInputRef.current) {
            paymentAmountInputRef.current.focus();
            setFocusedSection('payment-amount');
          } else if (submitButtonRef.current) {
            submitButtonRef.current.focus();
            setFocusedSection('payment-submit');
          }
          return;
        }

        if (focusedSection === 'payment-amount') {
          if (pendingCheckboxRef.current && (paymentAmount < finalTotal || paymentAmount === 0)) {
            pendingCheckboxRef.current.focus();
            setFocusedSection('payment-pending');
          } else if (submitButtonRef.current) {
            submitButtonRef.current.focus();
            setFocusedSection('payment-submit');
          }
          return;
        }

        if (focusedSection === 'payment-pending') {
          if (submitButtonRef.current) {
            submitButtonRef.current.focus();
            setFocusedSection('payment-submit');
          }
          return;
        }
      }

      // ============ PRODUCT GRID NAVIGATION ============
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(e.target.tagName === 'TEXTAREA') && (isSearchInput || e.target.tagName !== 'INPUT')) {
        if (focusedSection === 'search' || focusedSection === 'products') {
          e.preventDefault();
          if (filteredProducts.length > 0) {
            setFocusedSection('products');
            const nextIndex = getNextProductIndex(e.key === 'ArrowRight' ? 'right' : 'left', selectedProductIndex);
            if (nextIndex >= 0) {
              setSelectedProductIndex(nextIndex);
            }
          }
          return;
        }
      }

      // ============ CART ITEM MANAGEMENT ============
      
      // Left/Right arrow in cart
      if (e.key === 'ArrowLeft' && focusedSection === 'cart' && cart.length > 0 && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
        if (cartFocusedIndex > 0) {
          setCartFocusedIndex(cartFocusedIndex - 1);
        } else {
          setFocusedSection('search');
          setCartFocusedIndex(-1);
          if (searchInputRef.current) searchInputRef.current.focus();
        }
        return;
      }

      if (e.key === 'ArrowRight' && focusedSection === 'cart' && cart.length > 0 && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        e.preventDefault();
        if (cartFocusedIndex < cart.length - 1) {
          setCartFocusedIndex(cartFocusedIndex + 1);
        } else {
          setFocusedSection('payment');
          setCartFocusedIndex(-1);
          const paymentMethodSelect = document.getElementById('payment-method-select');
          if (paymentMethodSelect) paymentMethodSelect.focus();
        }
        return;
      }

      // Plus/Minus for quantity
      if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') && focusedSection === 'cart' && cart.length > 0 && cartFocusedIndex >= 0 && !(e.target.tagName === 'INPUT')) {
        e.preventDefault();
        const item = cart[cartFocusedIndex];
        if (item) {
          const currentStock = getProductStock(item.id_produk);
          if (e.key === '+' || e.key === '=') {
            if (item.jumlah < currentStock) {
              handleUpdateQuantity(item.id_produk, item.jumlah + 1);
            }
          } else {
            if (item.jumlah > 1) {
              handleUpdateQuantity(item.id_produk, item.jumlah - 1);
            } else {
              handleRemoveFromCart(item.id_produk);
              setCartFocusedIndex(-1);
            }
          }
        }
        return;
      }

      // Backspace: Delete focused cart item
      if (e.key === 'Backspace' && focusedSection === 'cart' && cart.length > 0 && cartFocusedIndex >= 0 && !(e.target.tagName === 'INPUT')) {
        e.preventDefault();
        const item = cart[cartFocusedIndex];
        if (item) {
          handleRemoveFromCart(item.id_produk);
          setCartFocusedIndex(Math.max(-1, cartFocusedIndex - 1));
        }
        return;
      }

      // Delete: Remove last cart item
      if (e.key === 'Delete' && cart.length > 0 && !(e.target.tagName === 'INPUT')) {
        e.preventDefault();
        setCart(prevCart => prevCart.slice(0, -1));
        return;
      }

      // ============ CTRL + SPECIAL KEYS (work even in inputs) ============

      // Ctrl+Z: Undo (always works, even in inputs)
      if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // ============ PRODUCT SELECTION & QUANTITY INPUT ============

      // Skip INPUT/TEXTAREA processing further except for search input or payment amount input
      if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && !isSearchInput && !isPaymentAmountInput) {
        return;
      }

      // Enter: Product selection or payment confirmation
      if (e.key === 'Enter') {
        e.preventDefault();

        // Add selected product to cart when search or product grid is active
        if ((focusedSection === 'products' || focusedSection === 'search') && filteredProducts.length > 0) {
          const indexToAdd = selectedProductIndex >= 0 ? selectedProductIndex : 0;
          const selectedProduct = filteredProducts[indexToAdd];
          if (selectedProduct) {
            handleAddToCart(selectedProduct, false, true);
            setSelectedProductIndex(-1);
            setCurrentKeyboardHint(`${selectedProduct.nama_produk} ditambahkan • F2 untuk cari lagi`);
            return;
          }
        }

        // Submit payment
        if (focusedSection === 'payment-submit') {
          handleSubmit();
          return;
        }
      }

      // Number keys: Quick quantity for last cart item
      const isNumericKey = () => {
        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
          if (e.key >= '1' && e.key <= '9') return true;
          if (/^Numpad[1-9]$/.test(e.code)) return true;
        }
        return false;
      };

      // Only numeric quantity shortcuts should work when cart navigation is active
      if (isNumericKey() && cart.length > 0 && focusedSection === 'cart' && !isSearchInput && !isPaymentAmountInput && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        let quantity = parseInt(e.key);
        if (isNaN(quantity) && /^Numpad[1-9]$/.test(e.code)) {
          quantity = parseInt(e.code.slice(6));
        }

        const lastItem = cart[cart.length - 1];
        const currentStock = getProductStock(lastItem.id_produk);

        if (quantity > currentStock) {
          showError(`Stok tidak cukup. Maksimal ${currentStock} item.`);
          return;
        }

        e.preventDefault();
        setCart(prevCart =>
          prevCart.map((item, index) => {
            if (index === prevCart.length - 1) {
              const pricing = debugGetProductPricing(item, quantity);
              return { 
                ...item, 
                jumlah: quantity, 
                harga_satuan: pricing.price,
                tipe_harga: pricing.priceType,
                subtotal: quantity * pricing.price 
              };
            }
            return item;
          })
        );
        return;
      }

      // Page Up/Down: Quick navigation
      if (e.key === 'PageUp') {
        e.preventDefault();
        if (focusedSection === 'cart' && cartFocusedIndex > 0) {
          setCartFocusedIndex(0);
        } else if (focusedSection === 'products' && selectedProductIndex > 0) {
          setSelectedProductIndex(Math.max(0, selectedProductIndex - 5));
        }
        return;
      }

      if (e.key === 'PageDown') {
        e.preventDefault();
        if (focusedSection === 'cart' && cartFocusedIndex < cart.length - 1) {
          setCartFocusedIndex(cart.length - 1);
        } else if (focusedSection === 'products' && selectedProductIndex < products.length - 1) {
          setSelectedProductIndex(Math.min(products.length - 1, selectedProductIndex + 5));
        }
        return;
      }

      // Space: Confirm in dropdown
      if (e.key === ' ') {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'BUTTON' || activeElement.tagName === 'SELECT')) {
          e.preventDefault();
          activeElement.click();
        }
      }

      // Handle payment modal shortcuts
      if (showPaymentModal) {
        // F4: Focus to payment amount input
        if (e.key === 'F4') {
          e.preventDefault();
          if (paymentAmountInputRef.current) {
            paymentAmountInputRef.current.focus();
            setCurrentKeyboardHint('Masukkan nominal pembayaran • Ctrl+0 untuk total');
          }
          return;
        }

        // Enter: Submit payment if payment amount input is focused
        if (e.key === 'Enter' && document.activeElement === paymentAmountInputRef.current) {
          e.preventDefault();
          if (selectedPaymentMethod && paymentAmount > 0) {
            handleSubmit();
            setShowPaymentModal(false);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPaymentMethod, cart, products, filteredProducts, handleAddToCart, handleSubmit, posSettings, taxAmount, appliedVoucher, finalTotal, paymentAmount, searchTerm, getProductStock, showError, showSuccess, debugGetProductPricing, showCustomerPopup, showCameraScanner, showShortcutsModal, showPaymentModal, showPrintModal, focusedSection, selectedProductIndex, cartFocusedIndex, handleRemoveFromCart, handleUpdateQuantity, handleUndo, getNextProductIndex, lastTransaction, navigate]);

  // Auto-focus to payment input when payment modal opens
  useEffect(() => {
    if (showPaymentModal && paymentAmountInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        if (paymentAmountInputRef.current) {
          paymentAmountInputRef.current.focus();
          paymentAmountInputRef.current.select();
          setCurrentKeyboardHint('Modal Pembayaran • Masukkan nominal • Ctrl+0 untuk total • Enter untuk bayar');
        }
      }, 100);
    }
  }, [showPaymentModal]);

  if (loading) return (
    <LoadingPage
      message="Memuat produk..."
      subtitle="Menyiapkan sistem Point of Sale"
    />
  );

  // Show error state if failed to load
  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-16 h-16 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Gagal Memuat POS</h2>
          <p className="text-gray-600 mb-6">{loadError}</p>
          {isOffline && (
            <p className="text-sm text-gray-700 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
              Anda sedang offline. Pastikan terhubung ke internet dan coba lagi.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setLoadError(null);
                setLoading(true);
                // Retry loading
                try {
                  const { safeReload } = await import('../utils/appRefresh');
                  safeReload('pos:after-action');
                } catch (_e) {
                  window.location.reload();
                }
              }}
              className="flex-1 bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => window.history.back()}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PosErrorBoundary>
      <div className="min-h-screen bg-gray-100 p-2 sm:p-4">
      {/* Status Bar */}
      <div className="mb-2 sm:mb-4 flex items-center justify-between bg-white rounded-lg shadow-sm p-2 sm:p-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div
            className="flex items-center space-x-1 sm:space-x-2"
            aria-label={getConnectionStatus().isOnline ? 'Online' : 'Offline'}
          >
            <div className={`w-2 h-2 rounded-full ${getConnectionStatus().isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="hidden sm:inline text-xs sm:text-sm font-medium">
              {getConnectionStatus().isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-gray-500">
            <span
              role="button"
              tabIndex={0}
              onClick={focusProductsSection}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  focusProductsSection();
                }
              }}
              className={`cursor-pointer px-2 py-1 rounded transition-colors flex items-center gap-1 ${focusedSection === 'products' ? 'bg-gray-200 text-gray-900 font-semibold' : 'text-gray-500'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m0 0l8 4m-8-4v10l8 4m0-10l8 4m-8-4v10M10 9l4 2m-4-2l4-2" />
              </svg>
              <span className="hidden sm:inline">Produk</span>
            </span>
            <span className="hidden sm:inline text-gray-400">›</span>
            <span
              role="button"
              tabIndex={0}
              onClick={focusCartSection}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  focusCartSection();
                }
              }}
              className={`cursor-pointer px-2 py-1 rounded transition-colors flex items-center gap-1 ${focusedSection === 'cart' ? 'bg-gray-200 text-gray-900 font-semibold' : 'text-gray-500'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l1.1 5H19M7 13h10m0 0v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8M7 13l-1.1 5M7 13h10m0 0v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8" />
              </svg>
              <span className="hidden sm:inline">Keranjang</span>
            </span>
            <span className="hidden sm:inline text-gray-400">›</span>
            <span
              role="button"
              tabIndex={0}
              onClick={focusPaymentSection}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  focusPaymentSection();
                }
              }}
              className={`cursor-pointer px-2 py-1 rounded transition-colors flex items-center gap-1 ${focusedSection.includes('payment') ? 'bg-gray-200 text-gray-900 font-semibold' : 'text-gray-500'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span className="hidden sm:inline">Bayar</span>
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-4 mt-2 sm:mt-0">
          <div className="text-xs sm:text-sm text-gray-600">
            Kasir: {user?.nama || user?.username || 'Tidak diketahui'}
          </div>
          <PrinterStatusIndicator />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 sm:gap-6">
      {/* Left Panel - Products */}
      <div className="flex-1">
        <div 
          className={`bg-white rounded-lg shadow-md p-3 sm:p-6 transition-all duration-300 cursor-pointer ${focusedSection === 'search' || focusedSection === 'products' ? 'ring-4 ring-blue-500 ring-opacity-75 border-2 border-blue-500 shadow-lg shadow-blue-500/25' : 'border border-gray-200 hover:border-gray-300 hover:shadow-md'}`}
          onClick={() => {
            setFocusedSection('search');
            if (searchInputRef.current) {
              searchInputRef.current.focus();
              searchInputRef.current.select();
            }
          }}
          tabIndex={0}
          title="Klik untuk fokus ke Produk (Alt+P)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFocusedSection('search');
              if (searchInputRef.current) {
                searchInputRef.current.focus();
                searchInputRef.current.select();
              }
            }
          }}
        >
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-gray-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m0 0l8 4m-8-4v10l8 4m0-10l8 4m-8-4v10M10 9l4 2m-4-2l4-2" />
              </svg>
              Produk
            </h2>
            <div className="flex gap-1 sm:gap-2">
              <button
                onClick={() => {
                  setShowCameraScanner(true);
                }}
                className="w-10 h-10 flex items-center justify-center bg-gray-700 text-white rounded hover:bg-gray-800 touch-manipulation"
                title="Scan (F3)"
                aria-label="Scan barcode dengan kamera (F3)"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <button
                onClick={() => setShowShortcutsModal(true)}
                className="w-10 h-10 flex items-center justify-center bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors touch-manipulation"
                title="Bantuan & Shortcut Keyboard"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-3 sm:mb-4 relative">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Cari produk berdasarkan nama atau kode..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedProductIndex(-1);
                }}
                onKeyDown={(e) => {
                  // Detect rapid input (likely scanner) and prevent it from being processed as search
                  // Scanner typically enters data within 50-100ms, manual typing is slower
                  const timeSinceLastInput = Date.now() - lastInputTimeRef.current;
                  lastInputTimeRef.current = Date.now();
                  
                  // If this looks like rapid scanner input, redirect focus to barcode input
                  // This prevents accidental filtering when scanner sends data to wrong field
                  // Only redirect if it's extremely rapid (less than 50ms) and not Enter key
                  if (e.key !== 'Enter' && timeSinceLastInput < 50 && timeSinceLastInput > 0) {
                    logger.debug('Rapid input detected in search field - likely scanner input, redirecting to barcode input');
                    if (barcodeInputRef.current) {
                      // Clear the erroneous search input
                      setSearchTerm('');
                      // Focus barcode input so scanner data goes there next
                      barcodeInputRef.current.focus();
                      return;
                    }
                  }
                }}
                className="w-full px-4 py-3 sm:py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all touch-manipulation text-sm sm:text-base"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {searchTerm ? (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedProductIndex(-1);
                    }}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none p-1 touch-manipulation"
                    title="Hapus pencarian"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Hidden barcode input - MUST ALWAYS BE FOCUSED for POS operation */}
          <input
            ref={barcodeInputRef}
            type="text"
            inputMode="none"
            autoComplete="off"
            spellCheck="false"
            className="absolute opacity-0 pointer-events-none"
            aria-hidden="true"
            inert={true}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const barcodeValue = e.target.value.trim();
                if (barcodeValue) {
                  handleBarcodeScan(barcodeValue);
                  e.target.value = '';
                  // Ensure focus stays on barcode input after scan
                  e.target.focus();
                }
              }
            }}
            onBlur={() => {
              // Prevent focus loss - barcode input should never lose focus
              // unless a modal/popup is open or user is actively typing in search/payment inputs
              if (
                !showPaymentModal &&
                !showCameraScanner &&
                !showShortcutsModal &&
                !showCustomerPopup
              ) {
                // Only refocus after a delay to allow for normal input switching
                setTimeout(() => {
                  const activeEl = document.activeElement;
                  const isTypingInInput = activeEl?.tagName === 'INPUT' && 
                                        (activeEl === searchInputRef.current || 
                                         activeEl === paymentAmountInputRef.current);
                  
                  if (!isTypingInInput && barcodeInputRef.current) {
                    barcodeInputRef.current.focus();
                  }
                }, 200); // Increased delay
              }
            }}
          />

          {/* Products Grid - Hidden on mobile, shown on desktop */}
          <div className="hidden lg:block max-h-96 overflow-y-auto border-t pt-4 px-2">
            <ProductGrid
              products={filteredProducts}
              stockInfo={stockInfo}
              onAddToCart={handleAddToCart}
              loading={loading}
              selectedProductIndex={selectedProductIndex}
            />
          </div>

          {/* Mobile Product Access - Search results or scan buttons */}
          <div className="lg:hidden border-t pt-4">
            {searchTerm ? (
              /* Show search results on mobile */
              <div className="max-h-64 overflow-y-auto px-2">
                <h3 className="text-lg font-medium mb-3 text-gray-900">Hasil Pencarian</h3>
                <ProductGrid
                  products={filteredProducts}
                  stockInfo={stockInfo}
                  onAddToCart={handleAddToCart}
                  loading={loading}
                  selectedProductIndex={selectedProductIndex}
                />
              </div>
            ) : (
              /* Show access instructions when no search */
              <div className="text-center py-4 sm:py-6 bg-blue-50 rounded-lg">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500 mx-auto mb-2 sm:mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <h3 className="text-base sm:text-lg font-medium text-blue-900 mb-1 sm:mb-2">Akses Produk</h3>
                <p className="text-sm text-blue-700 mb-3 sm:mb-4 px-2">
                  Gunakan pencarian atau scan barcode untuk menambah produk ke keranjang
                </p>
                <div className="flex justify-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowCameraScanner(true)}
                    className="flex items-center gap-2 bg-blue-500 text-white px-3 sm:px-4 py-2 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors touch-manipulation text-sm sm:text-base"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Scan Barcode
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Scanner Modal */}
      {showCameraScanner && (
        <LazyLoadErrorBoundary>
          <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white">Loading scanner...</div></div>}>
            <CameraBarcodeScanner
              onScan={(code) => {
                setShowCameraScanner(false);
                handleBarcodeScan(code);
              }}
              onClose={() => setShowCameraScanner(false)}
            />
          </Suspense>
        </LazyLoadErrorBoundary>
      )}

      {/* Right Panel - Cart & Payment (Split into 2 separate cards) */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-4">
        
        {/* CART CARD */}
        <div 
          className={`bg-white rounded-lg shadow-md p-3 sm:p-6 transition-all duration-300 cursor-pointer ${focusedSection === 'cart' ? 'ring-4 ring-blue-500 ring-opacity-75 border-2 border-blue-500 shadow-lg shadow-blue-500/25' : 'border border-gray-200 hover:border-gray-300 hover:shadow-md'}`}
          onClick={() => {
            setFocusedSection('cart');
            const firstCartItem = document.querySelector('[data-cart-item]');
            if (firstCartItem) {
              firstCartItem.focus();
              setCartFocusedIndex(0);
            }
          }}
          tabIndex={0}
          title="Klik untuk fokus ke Keranjang (Alt+C)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFocusedSection('cart');
              const firstCartItem = document.querySelector('[data-cart-item]');
              if (firstCartItem) {
                firstCartItem.focus();
                setCartFocusedIndex(0);
              }
            }
          }}
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5H19M7 13l-1.1 5M7 13h10m0 0v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8z" />
              </svg>
              <h2 className="text-lg sm:text-xl font-semibold">Keranjang</h2>
            </div>
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
              {cart.length} item{cart.length !== 1 ? 's' : ''}
            </span>
          </div>



          {/* Cart Items */}
          <div className="space-y-1 sm:space-y-2 max-h-48 sm:max-h-64 overflow-y-auto mb-3 sm:mb-4">
            {cart.length === 0 ? (
              <div className="text-center py-6 sm:py-8">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5H19M7 13l-1.1 5M7 13h10m0 0v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8z" />
                </svg>
                <p className="text-gray-500 text-sm">Keranjang kosong</p>
                <p className="text-gray-400 text-xs mt-1">Klik produk untuk menambah ke keranjang</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={item.id_produk} data-cart-item tabIndex={0} className="focus:outline-none rounded">
                  <CartItem
                    item={item}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemove={handleRemoveFromCart}
                    stock={stockInfo[item.id_produk] || 0}
                    onSetManualPricing={handleSetManualPricing}
                    manualPricingOverride={manualPricingOverrides[item.id_produk]}
                    isFocused={cartFocusedIndex === index}
                  />
                </div>
              ))
            )}
          </div>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="border-t pt-3 sm:pt-4">
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {posSettings?.showVoucherInput && discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Diskon Voucher:</span>
                    <span className="font-medium">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {posSettings?.enablePPN && taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pajak ({posSettings.ppnRate || 11}%):</span>
                    <span className="font-medium">{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                {paymentFee > 0 && selectedPaymentMethod && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Biaya {selectedPaymentMethod.nama_metode}:</span>
                    <span className="font-medium text-red-600">+{formatCurrency(paymentFee)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-lg font-bold text-gray-900">
                  <span>Total:</span>
                  <span>{formatCurrency(finalTotal)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tax Section */}
          {posSettings?.enablePPN && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <label className="text-sm font-medium">Pajak:</label>
                </div>
                <input
                  type="number"
                  placeholder="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(Number(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border rounded text-sm text-right"
                />
              </div>
            </div>
          )}
        </div>

        {!showPaymentModal && (
            <div 
              className={`bg-white rounded-lg shadow-md p-3 sm:p-6 transition-all duration-300 cursor-pointer ${focusedSection.includes('payment') ? 'ring-4 ring-blue-500 ring-opacity-75 border-2 border-blue-500 shadow-lg shadow-blue-500/25' : 'border border-gray-200 hover:border-gray-300 hover:shadow-md'}`}
              onClick={() => {
                setFocusedSection('payment');
                const paymentMethodSelect = document.getElementById('payment-method-select');
                if (paymentMethodSelect) {
                  paymentMethodSelect.focus();
                } else if (paymentAmountInputRef.current) {
                  paymentAmountInputRef.current.focus();
                }
              }}
              tabIndex={0}
              title="Klik untuk fokus ke Pembayaran (Alt+M)"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setFocusedSection('payment');
                  const paymentMethodSelect = document.getElementById('payment-method-select');
                  if (paymentMethodSelect) {
                    paymentMethodSelect.focus();
                  } else if (paymentAmountInputRef.current) {
                    paymentAmountInputRef.current.focus();
                  }
                }
              }}
            >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <h2 className="text-lg sm:text-xl font-semibold">Pembayaran</h2>
            </div>
          </div>



          {/* Customer Section */}
          {posSettings?.showCustomerSearch && (
            <div className="mb-3 pb-3 border-b">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Pelanggan:</span>
                  </div>
                  <button
                    onClick={() => setShowCustomerPopup(true)}
                    className="text-gray-600 hover:text-gray-800 text-xs font-medium"
                    title="F5 untuk membuka pencarian pelanggan"
                  >
                    {selectedCustomer ? 'Ubah' : 'Pilih'} (F5)
                  </button>
                </div>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between bg-white rounded p-2 border text-sm">
                    <div>
                      <p className="font-medium">{selectedCustomer.nama_pelanggan}</p>
                      {selectedCustomer.no_hp && (
                        <p className="text-xs text-gray-600">{selectedCustomer.no_hp}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-gray-600 hover:text-gray-800 p-1"
                      title="Hapus pelanggan"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">Belum ada pelanggan dipilih</p>
                )}
              </div>
            </div>
          )}

          {/* Voucher Section */}
          {posSettings?.showVoucherInput && (
            <div className="mb-3 pb-3 border-b">
              <LazyLoadErrorBoundary>
                <Suspense fallback={<div className="text-center py-2 text-gray-500 text-sm">Loading voucher...</div>}>
                  <InputVoucher
                    subtotal={subtotal}
                    onVoucherApplied={setAppliedVoucher}
                    appliedVoucher={appliedVoucher}
                    onRemoveVoucher={() => setAppliedVoucher(null)}
                  />
                </Suspense>
              </LazyLoadErrorBoundary>
            </div>
          )}

          {/* Payment Method Selection */}
            <div data-payment-area ref={paymentPanelRef} className="mb-3 pb-3 border-b">
              <div className="mb-2">
                <div className="flex items-center">
                </div>
              </div>
              <PaymentMethodSelector
                selectedMethodId={selectedPaymentMethod?.id_metode || selectedPaymentMethod?.id_metode_pembayaran || selectedPaymentMethod?.id}
                onMethodChange={setSelectedPaymentMethod}
                defaultToTunai={true}
                compact={true}
                showAll={false}
              />
            </div>

          {/* Payment Amount Input */}
          {selectedPaymentMethod && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="mb-2">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <label className="text-sm font-medium text-gray-700">Nominal Pembayaran</label>
                  </div>
                </div>
                <PaymentAmountInput
                  ref={paymentAmountInputRef}
                  amount={paymentAmount}
                  onChange={setPaymentAmount}
                  total={finalTotal}
                  placeholder="Masukkan jumlah pembayaran"
                  showChange={true}
                  autoFill={true}
                />

                {/* Payment Status Indicator */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="text-gray-600">Status:</span>
                    {paymentAmount === 0 ? (
                      <span className="text-gray-600">Belum dibayar</span>
                    ) : paymentAmount < finalTotal ? (
                      <span className="text-gray-700">Kurang: {formatCurrency(finalTotal - paymentAmount)}</span>
                    ) : paymentAmount === finalTotal ? (
                      <span className="text-gray-700">Pas</span>
                    ) : (
                      <span className="text-gray-800 font-semibold">Kembalian: {formatCurrency(change)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Payment Shortcuts */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling to parent onClick
                    setPaymentAmount(10000);
                  }}
                  className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                  title="Ctrl+1: Rp 10.000"
                >
                  Rp 10K
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling to parent onClick
                    setPaymentAmount(20000);
                  }}
                  className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                  title="Ctrl+2: Rp 20.000"
                >
                  Rp 20K
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling to parent onClick
                    setPaymentAmount(50000);
                  }}
                  className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                  title="Ctrl+3: Rp 50.000"
                >
                  Rp 50K
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling to parent onClick
                    setPaymentAmount(100000);
                  }}
                  className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                  title="Ctrl+4: Rp 100.000"
                >
                  Rp 100K
                </button>
              </div>

              {/* Pending Payment Option */}
              {(paymentAmount < finalTotal || paymentAmount === 0) && (
                <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border border-gray-300">
                  <label className="flex items-center space-x-2 cursor-pointer flex-1"
                    title="Tandai transaksi sebagai pembayaran pending. Pelanggan akan melunasi pembayaran nanti dan transaksi akan tetap tercatat.">
                    <input
                      ref={pendingCheckboxRef}
                      type="checkbox"
                      checked={isPendingPayment}
                      onChange={(e) => {
                        setIsPendingPayment(e.target.checked);
                        pendingPaymentRef.current = e.target.checked;
                      }}
                      className="w-4 h-4 text-gray-700 bg-white border-gray-300 rounded focus:ring-gray-500 cursor-pointer"
                    />
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-700">Pembayaran Nanti</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
        )}

          {/* Checkout & Utilities */}
          {!showPaymentModal && (
            <div className="mt-4 space-y-2">
            {/* Submit Button */}
            <button
              ref={submitButtonRef}
              onClick={handleSubmit}
              disabled={isSubmitting || cart.length === 0 || isSyncLocked()}
              className={`w-full py-3 sm:py-4 rounded-xl font-bold text-white text-base transition-all duration-200 shadow-md ${
                isSubmitting || isSyncLocked()
                  ? 'bg-slate-400 dark:bg-zinc-800 text-slate-200 dark:text-zinc-500 cursor-not-allowed' 
                  : cart.length === 0
                    ? 'bg-slate-300 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-500 cursor-not-allowed'
                    : paymentAmount === 0 && !isPendingPayment
                      ? 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 shadow-blue-500/20'
                      : paymentAmount < finalTotal && !isPendingPayment
                        ? 'bg-amber-600 dark:bg-amber-500 hover:bg-amber-700 dark:hover:bg-amber-600 shadow-amber-500/20'
                        : 'bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-emerald-500/20'
              } touch-manipulation`}
              title="F12/End: Selesaikan transaksi (Ctrl+Enter juga bekerja)"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memproses...
                </div>
              ) : cart.length === 0 ? (
                'Pilih produk terlebih dahulu'
              ) : paymentAmount === 0 && !isPendingPayment ? (
                'Masukkan jumlah pembayaran'
              ) : paymentAmount < finalTotal && !isPendingPayment ? (
                'Pembayaran kurang'
              ) : (
                `Selesaikan (Rp ${formatCurrency(finalTotal)})`
              )}
            </button>

            {/* Cash Drawer Button */}
            <button
              onClick={async () => {
                if (window.electronAPI && window.electronAPI.openCashDrawer) {
                  setIsOpeningCashDrawer(true);
                  try {
                    await window.electronAPI.openCashDrawer();
                    showSuccess('Cash drawer berhasil dibuka');
                  } catch (error) {
                    console.error('Failed to open cash drawer:', error);
                    showError('Gagal membuka cash drawer');
                  } finally {
                    setIsOpeningCashDrawer(false);
                  }
                } else {
                  showError('Cash drawer tidak tersedia');
                }
              }}
              disabled={isOpeningCashDrawer}
              className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 disabled:bg-gray-500 transition-colors touch-manipulation font-medium flex items-center justify-center space-x-2"
              title="Buka cash drawer secara manual (F8)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
              </svg>
              <span>{isOpeningCashDrawer ? 'Membuka...' : 'Cash Drawer'}</span>
            </button>
          </div>
          )}

      {showCustomerPopup && posSettings?.showCustomerSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Pilih Pelanggan</h3>
              <button
                onClick={() => setShowCustomerPopup(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>
            
            <LazyLoadErrorBoundary>
              <Suspense fallback={<div className="text-center py-8 text-gray-500">Loading customer search...</div>}>
                <PencarianPelanggan
                  ref={customerSearchRef}
                  onCustomerSelected={(customer) => {
                    setSelectedCustomer(customer);
                    setShowCustomerPopup(false);
                  }}
                  selectedCustomer={selectedCustomer}
                  onClearCustomer={() => setSelectedCustomer(null)}
                />
              </Suspense>
            </LazyLoadErrorBoundary>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCustomerPopup(false)}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {showShortcutsModal && (
        <ShortcutModal onClose={() => setShowShortcutsModal(false)} />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div data-payment-modal ref={paymentModalRef} className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
          <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto border border-gray-300 border-opacity-50 p-6">
            {/* Payment Method Selection */}
            <div className="mb-3 pb-3 border-b">
              <PaymentMethodSelector
                selectedMethodId={selectedPaymentMethod?.id_metode || selectedPaymentMethod?.id_metode_pembayaran || selectedPaymentMethod?.id}
                onMethodChange={setSelectedPaymentMethod}
                defaultToTunai={true}
                compact={true}
                showAll={false}
              />
            </div>

            {/* Payment Amount Input */}
            {selectedPaymentMethod && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="mb-2">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <label className="text-sm font-medium text-gray-700">Nominal Pembayaran</label>
                    </div>
                  </div>
                  <PaymentAmountInput
                    ref={paymentAmountInputRef}
                    amount={paymentAmount}
                    onChange={setPaymentAmount}
                    total={finalTotal}
                    placeholder="Masukkan jumlah pembayaran"
                    showChange={true}
                    autoFill={true}
                  />

                  {/* Payment Status Indicator */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="text-gray-600">Status:</span>
                      {paymentAmount === 0 ? (
                        <span className="text-gray-600">Belum dibayar</span>
                      ) : paymentAmount < finalTotal ? (
                        <span className="text-gray-700">Kurang: {formatCurrency(finalTotal - paymentAmount)}</span>
                      ) : paymentAmount === finalTotal ? (
                        <span className="text-gray-700">Pas</span>
                      ) : (
                        <span className="text-gray-800 font-semibold">Kembalian: {formatCurrency(change)}</span>
                      )}
                    </div>
                  </div>

                  {/* Quick Payment Shortcuts */}
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    <button
                      onClick={() => setPaymentAmount(10000)}
                      className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                      title="Ctrl+1: Rp 10.000"
                    >
                      Rp 10K
                    </button>
                    <button
                      onClick={() => setPaymentAmount(20000)}
                      className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                      title="Ctrl+2: Rp 20.000"
                    >
                      Rp 20K
                    </button>
                    <button
                      onClick={() => setPaymentAmount(50000)}
                      className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                      title="Ctrl+3: Rp 50.000"
                    >
                      Rp 50K
                    </button>
                    <button
                      onClick={() => setPaymentAmount(100000)}
                      className="px-2 py-2 bg-gray-100 text-gray-800 rounded text-xs font-medium hover:bg-gray-200 transition border border-gray-300"
                      title="Ctrl+4: Rp 100.000"
                    >
                      Rp 100K
                    </button>
                  </div>
                </div>

                {(paymentAmount < finalTotal || paymentAmount === 0) && (
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border border-gray-300">
                    <label className="flex items-center space-x-2 cursor-pointer flex-1" title="Tandai transaksi sebagai pembayaran pending. Pelanggan akan melunasi pembayaran nanti dan transaksi akan tetap tercatat.">
                      <input
                        ref={pendingCheckboxRef}
                        type="checkbox"
                        checked={isPendingPayment}
                        onChange={(e) => {
                          setIsPendingPayment(e.target.checked);
                          pendingPaymentRef.current = e.target.checked;
                        }}
                        className="w-4 h-4 text-gray-700 bg-white border-gray-300 rounded focus:ring-gray-500 cursor-pointer"
                      />
                      <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-medium text-gray-700">Pembayaran Nanti</span>
                    </label>
                  </div>
                )}

                  {/* Action Buttons - Same as main layout */}
                <div className="pt-4 space-y-2">
                  {/* Submit Button */}
                  <button
                    ref={submitButtonRef}
                    onClick={handleSubmit}
                    disabled={isSubmitting || cart.length === 0 || isSyncLocked()}
                    className={`w-full py-3 sm:py-4 rounded-lg font-bold text-white text-base transition-all duration-200 ${
                      isSubmitting || isSyncLocked()
                        ? 'bg-gray-500 cursor-not-allowed'
                        : cart.length === 0
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gray-800 hover:bg-gray-900 active:bg-black shadow-lg hover:shadow-xl'
                    } touch-manipulation`}
                    title="F12/End: Selesaikan transaksi (Ctrl+Enter juga bekerja)"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Memproses...
                      </div>
                    ) : cart.length === 0 ? (
                      'Pilih produk terlebih dahulu'
                    ) : paymentAmount === 0 && !isPendingPayment ? (
                      'Masukkan jumlah pembayaran'
                    ) : paymentAmount < finalTotal && !isPendingPayment ? (
                      'Pembayaran kurang'
                    ) : (
                      `Selesaikan (Rp ${formatCurrency(finalTotal)})`
                    )}
                  </button>

                  {/* Cash Drawer Button */}
                  <button
                    onClick={async () => {
                      if (window.electronAPI && window.electronAPI.openCashDrawer) {
                        setIsOpeningCashDrawer(true);
                        try {
                          await window.electronAPI.openCashDrawer();
                          showSuccess('Cash drawer berhasil dibuka');
                        } catch (error) {
                          console.error('Failed to open cash drawer:', error);
                          showError('Gagal membuka cash drawer');
                        } finally {
                          setIsOpeningCashDrawer(false);
                        }
                      } else {
                        showError('Cash drawer tidak tersedia');
                      }
                    }}
                    disabled={isOpeningCashDrawer}
                    className="w-full px-3 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 disabled:bg-gray-500 transition-colors touch-manipulation font-medium flex items-center justify-center space-x-2"
                    title="Buka cash drawer secara manual (F8)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                    </svg>
                    <span>{isOpeningCashDrawer ? 'Membuka...' : 'Cash Drawer'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction Success Modal */}
      {showPrintModal && (
        <LazyLoadErrorBoundary>
          <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white">Loading receipt...</div></div>}>
            <TransactionSuccessModal
              transactionData={saleDataForPrint}
              storeInfo={storeInfo}
              printerSettings={user}
              onDone={() => {
                setShowPrintModal(false);
              setSaleDataForPrint(null);
              // Reset form untuk transaksi baru
              setCart([]);
              setManualPricingOverrides({});
              setAppliedVoucher(null);
              setSelectedCustomer(null);
              setTaxAmount(0);
              setSelectedPaymentMethod(null);
              setPaymentAmount(0);
            }}
          />
          </Suspense>
        </LazyLoadErrorBoundary>
      )}

      {/* Discount Dialog */}
      <DiscountDialog
        isOpen={showDiscountDialog}
        onClose={() => setShowDiscountDialog(false)}
        onApply={handleDiscountApply}
        currentDiscount={discountAmount}
        totalAmount={finalTotal}
      />

      {/* Offline Warning Dialog */}
      <OfflineWarningDialog
        isOpen={showOfflineWarning}
        onConfirm={handleOfflineConfirm}
        onCancel={() => setShowOfflineWarning(false)}
        totalAmount={finalTotal}
        itemCount={cart.length}
      />

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
    </div>
  </div>
  </div>
  </PosErrorBoundary>
  );
};

export default React.memo(PosPage);