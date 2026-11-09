import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Check, Flame, History, ShoppingCart } from 'lucide-react';
import Drawer from '../components/common/Drawer';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { getProducts, getCategories, getBranchById, getStockReport } from '../services/api';
import APIWithOfflineSupport from '../services/apiWithOfflineSupport';
import { formatCurrency } from '../utils/formatHelper';
import TimeoutManager from '../utils/TimeoutManager';
import PerformanceMonitor from '../utils/PerformanceMonitor';
import SubmissionProgressHandler from '../utils/SubmissionProgressHandler';
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
import { usePosKeyboardShortcuts } from '../features/pos/hooks/usePosKeyboardShortcuts';
import { usePosCheckout } from '../features/pos/hooks/usePosCheckout';
import { useProductBrowse } from '../features/pos/hooks/useProductBrowse';

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
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | id_kategori (string)
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(false);
  const [browseRetry, setBrowseRetry] = useState(0);
  // Di bawah breakpoint lg, keranjang + pembayaran tampil sebagai drawer dari kanan; di lg menjadi panel tetap.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [cartOpen, setCartOpen] = useState(false);
  const [gridDensity, setGridDensity] = useState(() => {
    try { return localStorage.getItem('pos_grid_density') || 'normal'; } catch (_e) { return 'normal'; }
  });
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

  const readUsage = () => {
    try { return JSON.parse(localStorage.getItem('pos_product_usage') || '{}'); } catch (_e) { return {}; }
  };
  const recordUsage = useCallback((product) => {
    try {
      const usage = readUsage();
      const key = String(product.id_produk);
      usage[key] = { count: (usage[key]?.count || 0) + 1, last: Date.now(), product };
      const keys = Object.keys(usage);
      if (keys.length > 60) {
        keys.sort((a, b) => usage[a].last - usage[b].last).slice(0, keys.length - 60).forEach(k => delete usage[k]);
      }
      localStorage.setItem('pos_product_usage', JSON.stringify(usage));
    } catch (_e) { /* storage tidak tersedia */ }
  }, []);
  const changeDensity = useCallback((d) => {
    setGridDensity(d);
    try { localStorage.setItem('pos_grid_density', d); } catch (_e) { /* abaikan */ }
  }, []);

  // Keranjang kosong (mis. setelah transaksi selesai) atau layar melebar ke desktop: tutup drawer.
  useEffect(() => {
    if (cart.length === 0 || isDesktop) setCartOpen(false);
  }, [cart.length, isDesktop]);

  const closeCart = useCallback(() => setCartOpen(false), []);

  const cartQtyMap = useMemo(() => {
    const m = {};
    cart.forEach(i => { m[i.id_produk] = i.jumlah; });
    return m;
  }, [cart]);

  const idCabangPengguna = user?.id_cabang;
  const [tipeKatalog, setTipeKatalog] = useState('global');
  const [tipeKatalogKnown, setTipeKatalogKnown] = useState(false);

  // Penjaga katalog (defensif; server tetap penentu). Produk tanpa info pemilik dianggap sah.
  const belongsToCatalog = useCallback((p) => {
    // Selama tipe katalog cabang belum diketahui, jangan menyaring (hindari menyembunyikan produk sah).
    if (!tipeKatalogKnown || !p || p.id_cabang_pemilik === undefined) return true;
    const pemilik = p.id_cabang_pemilik === null || p.id_cabang_pemilik === '' ? null : Number(p.id_cabang_pemilik);
    return tipeKatalog === 'terpisah' ? pemilik === Number(idCabangPengguna) : pemilik === null;
  }, [tipeKatalog, tipeKatalogKnown, idCabangPengguna]);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    if (loading) return products;

    const term = String(searchTerm || '').trim().toLowerCase();
    const inCatalog = products.filter(belongsToCatalog);
    const byCategory = (activeCategory === 'all' || activeCategory === 'recent' || activeCategory === 'fav')
      ? inCatalog
      : inCatalog.filter((p) => String(p?.id_kategori ?? '') === String(activeCategory));
    if (!term) return byCategory;

    return byCategory.filter((product) => {
      const name = String(product?.nama_produk || '').toLowerCase();
      const kode = String(product?.kode_produk || '').toLowerCase();
      return name.includes(term) || (kode && kode.includes(term));
    });
  }, [products, searchTerm, loading, activeCategory, belongsToCatalog]);

  // Riwayat pencarian lama sudah dihapus dari UI: bersihkan data tersimpan sekali.
  useEffect(() => {
    try { localStorage.removeItem('pos_recent_searches'); localStorage.removeItem('pos_search_history'); } catch (_e) { /* abaikan */ }
  }, []);

  // Deteksi input scanner di kolom pencarian: rata-rata antar-karakter < 60 ms.
  // Manusia tidak bisa mengetik >= 6 karakter secepat itu; scanner Bluetooth biasanya 10-50 ms.
  const searchKeyTimesRef = useRef([]);
  const isScannerLikeInput = useCallback((value) => {
    const t = searchKeyTimesRef.current;
    if (!value || value.length < 6 || t.length < value.length) return false;
    const recent = t.slice(-value.length);
    const avg = (recent[recent.length - 1] - recent[0]) / Math.max(1, recent.length - 1);
    return avg < 60;
  }, []);

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
  // Stable transaction code across retries of the same checkout attempt.
  // kode_transaksi has a UNIQUE constraint in the backend DB — as long as
  // this stays the same across a retry, a request that actually succeeded
  // server-side but whose response was lost (network blip) makes the retry
  // fail with a duplicate-key error instead of silently creating a second
  // sale. Previously this was regenerated with Date.now() on every
  // handleSubmit call, defeating that protection entirely. Cleared on
  // successful submit and whenever the cart is rebuilt from empty.
  const pendingTransactionCodeRef = useRef(null);
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


  useEffect(() => {
    const cacheKey = `branchTipeKatalog:${idCabangPengguna}`;
    const apply = (tipe) => {
      if (tipe !== 'global' && tipe !== 'terpisah') return false;
      setTipeKatalog(tipe);
      setTipeKatalogKnown(true);
      try { localStorage.setItem(cacheKey, tipe); } catch (_e) { /* abaikan */ }
      return true;
    };
    const loadBranchTipeKatalog = async () => {
      if (!idCabangPengguna) return;
      // 1) Database lokal Electron
      try {
        if (window.electronAPI?.dbSelect) {
          const res = await window.electronAPI.dbSelect({
            table: 'branches',
            whereClause: 'id_cabang = ?',
            whereValues: [idCabangPengguna]
          });
          if (res && res.length > 0 && apply(res[0].tipe_katalog || 'global')) return;
        }
      } catch (err) {
        console.warn('Failed to load branch tipe_katalog offline:', err);
      }
      // 2) API (versi web, atau tabel lokal belum terisi)
      try {
        const res = await getBranchById(idCabangPengguna);
        const row = res?.data?.data || res?.data;
        if (apply(row?.tipe_katalog || 'global')) return;
      } catch (_apiErr) { /* lanjut ke cadangan */ }
      // 3) Cadangan terakhir yang tersimpan (offline di web)
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) apply(cached);
      } catch (_e) { /* abaikan */ }
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
        console.warn('No stock data to cache');
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
        console.warn('No stocks extracted from stock report');
        return;
      }

      // Save ke offline database
      if (!window.electronAPI?.productDB_bulkUpsertStocks) {
        console.warn('No IPC for saving stocks');
        return;
      }

      const result = await window.electronAPI.productDB_bulkUpsertStocks(stocks);
      if (result.success) { /* intentionally empty */ 
      } else {
        console.warn('Failed to cache stocks:', result.error);
      }
    } catch (err) {
      console.error('Error caching stock data:', err);
    }
  }, []);

  /**
   * Load stock data dari offline cache
   * Gunakan saat API gagal dan user offline
   */
  const loadStockFromCache = useCallback(async () => {
    try {
      if (!idCabangPengguna) {
        console.warn('No cabang info to load stocks');
        return [];
      }

      // Load stock dari offline database
      if (!window.electronAPI?.productDB_getStocksByCabang) {
        console.warn('No IPC for offline stocks');
        return [];
      }

      const stocks = await window.electronAPI.productDB_getStocksByCabang(idCabangPengguna);

      if (!Array.isArray(stocks) || stocks.length === 0) {
        console.warn('No stocks in offline database for cabang', idCabangPengguna);
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
      console.error('Error loading stock from cache:', err);
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
              logger.info(`Stock report loaded from API (${stockReportData.length} records)`);
              
              // Cache stock data for offline use
              try {
                await cacheStockReportData(stockReportData);
              } catch (cacheErr) {
                console.warn('Failed to cache stock data:', cacheErr);
                // Non-critical, continue
              }
            } else {
              logger.warn('API returned empty stock data, trying offline cache...');
              // Empty API result - try cache as fallback
              try {
                stockReportData = await loadStockFromCache() || [];
                if (stockReportData.length > 0) {
                  logger.info(`Loaded ${stockReportData.length} stock records from offline cache`);
                } else {
                  logger.warn('No stock data in offline cache either');
                }
              } catch (cacheErr) {
                console.warn('Failed to load from cache:', cacheErr);
              }
            }
          } catch (_apiError) {
            logger.warn('API fetch failed for stock report, trying offline cache...');
            // API error - try cache
            try {
              stockReportData = await loadStockFromCache() || [];
              if (stockReportData.length > 0) {
                logger.info(`Loaded ${stockReportData.length} stock records from offline cache`);
              } else {
                logger.warn('No stock data in offline cache');
              }
            } catch (cacheLoadErr) {
              console.error('Failed to load stock from cache:', cacheLoadErr);
            }
          }
        } else {
          // Offline mode - go directly to cache (no API attempt)
          logger.info('Offline mode detected, loading stock from offline cache...');
          try {
            stockReportData = await loadStockFromCache() || [];
            if (stockReportData.length > 0) {
              logger.info(`Loaded ${stockReportData.length} stock records from offline cache`);
            } else {
              logger.warn('No stock data in offline cache');
              stockReportData = [];
            }
          } catch (cacheLoadErr) {
            console.error('Error loading stock from offline cache:', cacheLoadErr);
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

  // Load kategori untuk chips filter
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getCategories();
        const list = res?.data?.data || res?.data || [];
        if (!cancelled && Array.isArray(list)) setCategories(list);
      } catch (_e) { /* chips opsional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useProductBrowse({ activeCategory, browseRetry, getConnectionStatus, idCabangPengguna, isOnline, readUsage, searchIdRef, searchOfflineProducts, searchTerm, setBrowseError, setBrowseLoading, setProducts, showError, stockInfo, tipeKatalog });

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
      if (!belongsToCatalog(product)) {
        showErrorDebounced(`Produk ${product.nama_produk} bukan bagian dari katalog cabang ini.`);
        return;
      }
      recordUsage(product);

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
      const isTouchPrimary = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
      if (!fromBarcodeScan && !skipSearchFocus && !isTouchPrimary) {
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
      // Umpan balik singkat: badge jumlah di kartu produk sudah menunjukkan hasilnya, jadi toast tidak perlu lama.
      showSuccess(`+ ${product.nama_produk}`, { autoClose: 1000, hideProgressBar: true, toastId: `cart-add-${product.id_produk}` });
    } finally {
      // Release lock after a short delay to prevent too rapid clicks
      setTimeout(() => {
        cartLockRef.current = false;
      }, 100);
    }
  }, [getProductStock, showErrorDebounced, showSuccess, debugGetProductPricing, saveCartSnapshot, recordUsage, belongsToCatalog]);

  // Track input timing to detect rapid scanner input vs manual typing
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
            sortOrder: 'asc',
            katalog_filter: tipeKatalog,
            id_cabang: tipeKatalog === 'terpisah' ? idCabangPengguna : undefined
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
          logger.info(`Auto-loaded ${enhancedProducts.length} products for barcode scan`);
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
            sortOrder: 'asc',
            katalog_filter: tipeKatalog,
            id_cabang: tipeKatalog === 'terpisah' ? idCabangPengguna : undefined
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
  }, [products, loading, isOnline, idCabangPengguna, tipeKatalog, searchOfflineProducts, handleAddToCart, showErrorDebounced, stockInfo]);

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

  const { handleOfflineConfirm, handleSubmit } = usePosCheckout({ cart, createTemporarySaleId, discountAmount, finalTotal, getConnectionStatus, getProductStock, idCabangPengguna, isPendingPayment, isSyncLocked, paymentAmount, pendingPaymentRef, pendingTransactionCodeRef, posSettings, searchOfflineProducts, selectedCustomer, selectedPaymentMethod, setAppliedVoucher, setCart, setIsPendingPayment, setIsSubmitting, setLastTransaction, setManualPricingOverrides, setPaymentAmount, setSaleDataForPrint, setSelectedCustomer, setSelectedPaymentMethod, setShowOfflineWarning, setShowPaymentModal, setShowPrintModal, setStockInfo, setTaxAmount, showError, showSuccess, taxAmount, tipeKatalog, user });

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

  usePosKeyboardShortcuts({ appliedVoucher, cart, cartFocusedIndex, customerSearchRef, debugGetProductPricing, filteredProducts, finalTotal, focusedSection, getNextProductIndex, getProductStock, handleAddToCart, handleRemoveFromCart, handleSubmit, handleUndo, handleUpdateQuantity, lastTransaction, navigate, paymentAmount, paymentAmountInputRef, pendingCheckboxRef, posSettings, products, searchInputRef, searchTerm, selectedPaymentMethod, selectedProductIndex, setAppliedVoucher, setCart, setCartFocusedIndex, setConfirmDialog, setCurrentKeyboardHint, setFocusedSection, setIsOpeningCashDrawer, setManualPricingOverrides, setPaymentAmount, setSaleDataForPrint, setSearchTerm, setSelectedCustomer, setSelectedProductIndex, setShowCameraScanner, setShowCustomerPopup, setShowDiscountDialog, setShowPaymentModal, setShowPrintModal, setShowShortcutsModal, showCameraScanner, showCustomerPopup, showError, showPaymentModal, showPrintModal, showShortcutsModal, showSuccess, submitButtonRef, taxAmount });

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
      <div className="min-h-screen bg-gray-100 p-2 sm:p-4 pb-24 lg:pb-4">
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
          <div className="hidden lg:flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-gray-500">
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
      <div className="flex-1 min-w-0">
        <div 
          className={`bg-white rounded-lg shadow-md p-3 sm:p-6 transition-all duration-300 cursor-pointer ${focusedSection === 'search' || focusedSection === 'products' ? 'ring-2 ring-blue-500/50 border border-blue-300' : 'border border-gray-200'}`}
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
            <h2 className="text-base sm:text-lg font-semibold tracking-tight flex items-center gap-2 text-gray-900">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m0 0l8 4m-8-4v10l8 4m0-10l8 4m-8-4v10M10 9l4 2m-4-2l4-2" />
              </svg>
              Produk
            </h2>
            <div className="flex gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="btn-icon btn-tonal relative lg:hidden"
                aria-label={`Buka keranjang (${cart.length} item)`}
              >
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                {cart.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-bold tabular-nums text-white">
                    {cart.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCameraScanner(true);
                }}
                className="btn-icon btn-tonal"
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
                className="btn-icon btn-tonal"
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
                placeholder="Cari produk atau scan barcode"
                value={searchTerm}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value;
                  const now = Date.now();
                  const times = searchKeyTimesRef.current;
                  // Isi/hapus riwayat waktu sesuai panjang teks (paste atau hapus = reset)
                  if (v.length <= 1 || v.length < times.length) searchKeyTimesRef.current = [now];
                  else { times.push(now); if (times.length > 64) times.splice(0, times.length - 64); }
                  setSearchTerm(v);
                  setSelectedProductIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchTerm('');
                    searchKeyTimesRef.current = [];
                    return;
                  }
                  if (e.key !== 'Enter') return;
                  const value = e.currentTarget.value.trim();
                  if (!value) return;
                  e.preventDefault();

                  // 1) Scanner fisik yang mengetik ke kolom ini: proses sebagai barcode
                  if (isScannerLikeInput(value)) {
                    searchKeyTimesRef.current = [];
                    handleBarcodeScan(value);
                    return;
                  }

                  // 2) Ketik manual: kode persis cocok atau hasil tunggal langsung masuk keranjang
                  const lower = value.toLowerCase();
                  const exact = filteredProducts.find(p =>
                    String(p.kode_produk || '').toLowerCase() === lower ||
                    String(p.barcode || '').toLowerCase() === lower);
                  const target = exact || (filteredProducts.length === 1 ? filteredProducts[0] : null);
                  if (target) {
                    searchKeyTimesRef.current = [];
                    handleAddToCart(target);
                  } else if (/^\S{6,}$/.test(value) && filteredProducts.length === 0) {
                    // Kode yang ditempel (paste) atau hasil belum termuat: cari persis ke sumber data
                    searchKeyTimesRef.current = [];
                    handleBarcodeScan(value);
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

          {/* Category chips - filter cepat */}
          {(
            <div
              className="mb-3 sm:mb-4 flex gap-2 overflow-x-auto max-w-full pb-2 snap-x [scrollbar-width:thin] overscroll-x-contain"
              role="tablist"
              aria-label="Filter kategori produk"
              onClick={(e) => e.stopPropagation()}
            >
              {[{ id_kategori: 'all', nama_kategori: 'Semua' }, { id_kategori: 'fav', nama_kategori: 'Terlaris', Icon: Flame }, { id_kategori: 'recent', nama_kategori: 'Terakhir', Icon: History }, ...categories].map((cat) => {
                const id = String(cat.id_kategori);
                const active = String(activeCategory) === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setActiveCategory(id); setSelectedProductIndex(-1); }}
                    className={`snap-start shrink-0 min-h-[40px] px-4 rounded-lg text-sm font-medium border transition-all duration-150 touch-manipulation whitespace-nowrap flex items-center gap-1.5 active:scale-95 ${
                      active
                        ? 'bg-blue-100 text-blue-900 border-blue-200 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {active ? <Check className="w-4 h-4" aria-hidden="true" /> : (cat.Icon && <cat.Icon className="w-4 h-4" aria-hidden="true" />)}
                    {cat.nama_kategori}
                  </button>
                );
              })}
            </div>
          )}

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

          {/* Products Grid - tampil di semua ukuran layar */}
          <div className="border-t pt-3 sm:pt-4 max-h-[55vh] lg:max-h-[60vh] overflow-y-auto overflow-x-hidden min-w-0 px-1 sm:px-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-2 text-xs sm:text-sm text-gray-500">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Ukuran kartu produk">
                {[['compact','S'],['normal','M'],['large','L']].map(([d,l]) => (
                  <button key={d} type="button" onClick={() => changeDensity(d)} aria-pressed={gridDensity === d}
                    className={`w-9 min-h-[36px] text-xs font-semibold ${gridDensity === d ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{l}</button>
                ))}
              </div>
              <span className="flex-1 truncate">
                {searchTerm ? `Hasil untuk "${searchTerm}"` : (activeCategory === 'all' ? 'Semua produk' : 'Kategori terpilih')}
              </span>
              <span>{filteredProducts.length} produk</span>
            </div>
            {browseError && !searchTerm && filteredProducts.length === 0 && !browseLoading && (
              <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-gray-600">Daftar produk gagal dimuat. Anda tetap bisa mencari atau scan barcode.</p>
                <button
                  type="button"
                  onClick={() => setBrowseRetry(n => n + 1)}
                  className="btn-primary"
                >
                  Coba lagi
                </button>
              </div>
            )}
            <ProductGrid
              products={filteredProducts}
              stockInfo={stockInfo}
              onAddToCart={handleAddToCart}
              loading={loading || browseLoading}
              density={gridDensity}
              cartQty={cartQtyMap}
              selectedProductIndex={selectedProductIndex}
            />
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
      <Drawer
        open={cartOpen}
        onClose={closeCart}
        title="Keranjang"
        docked={isDesktop}
        dockedClassName="flex w-80 xl:w-96 shrink-0 min-w-0 flex-col gap-4"
      >
        
        {/* CART CARD */}
        <div 
          id="pos-cart-card"
          className={`bg-white rounded-lg shadow-md p-3 sm:p-6 transition-all duration-300 cursor-pointer ${focusedSection === 'cart' ? 'ring-2 ring-blue-500/50 border border-blue-300' : 'border border-gray-200'}`}
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
              className={`bg-white rounded-lg shadow-md p-3 sm:p-6 transition-all duration-300 cursor-pointer ${focusedSection.includes('payment') ? 'ring-2 ring-blue-500/50 border border-blue-300' : 'border border-gray-200'}`}
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
              <div>
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
                      <X className="w-4 h-4" />
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
              <div>
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
                <X className="w-5 h-5" />
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
                <div>
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
    </Drawer>
  </div>
  </div>
  {/* Bilah bawah (< lg): akses cepat ke keranjang dengan total, dekat jempol */}
  {cart.length > 0 && !isDesktop && (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="btn-primary btn-lg btn-block justify-between font-semibold"
        aria-haspopup="dialog"
      >
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm tabular-nums">{cart.length}</span>
          Lihat Keranjang
        </span>
        <span className="text-lg tabular-nums">{formatCurrency(finalTotal)}</span>
      </button>
    </div>
  )}
  </PosErrorBoundary>
  );
};

export default React.memo(PosPage);