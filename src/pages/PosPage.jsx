import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Check, Flame, History, ShoppingCart } from 'lucide-react';
import Drawer from '../components/common/Drawer';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { getCategories, getBranchById, getStockReport } from '../services/api';
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
import { usePosCartActions } from '../features/pos/hooks/usePosCartActions';

// Fallback components for when dynamic imports fail
import { TransactionSuccessModal, PencarianPelanggan, CameraBarcodeScanner, InputVoucher } from '../features/pos/lazyComponents';
import PaymentModal from '../features/pos/components/PaymentModal';
import CustomerPopup from '../features/pos/components/CustomerPopup';
import CartPanel from '../features/pos/components/CartPanel';
import ProductPanel from '../features/pos/components/ProductPanel';

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

  const { debugGetProductPricing, getProductStock, handleAddToCart, handleBarcodeScan, handleUndo, saveCartSnapshot } = usePosCartActions({ MAX_SNAPSHOTS, barcodeInputRef, belongsToCatalog, cart, idCabangPengguna, isOnline, lastScanTimeRef, loading, manualPricingOverrides, products, recordUsage, searchInputRef, searchOfflineProducts, setCart, setProducts, setSearchTerm, setSelectedProductIndex, showError, showErrorDebounced, showSuccess, snapshotStackRef, stockInfo, timeoutManager, tipeKatalog });

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
      <ProductPanel activeCategory={activeCategory} barcodeInputRef={barcodeInputRef} browseError={browseError} browseLoading={browseLoading} cart={cart} cartQtyMap={cartQtyMap} categories={categories} changeDensity={changeDensity} filteredProducts={filteredProducts} focusedSection={focusedSection} gridDensity={gridDensity} handleAddToCart={handleAddToCart} handleBarcodeScan={handleBarcodeScan} isScannerLikeInput={isScannerLikeInput} loading={loading} paymentAmountInputRef={paymentAmountInputRef} searchInputRef={searchInputRef} searchKeyTimesRef={searchKeyTimesRef} searchTerm={searchTerm} selectedProductIndex={selectedProductIndex} setActiveCategory={setActiveCategory} setBrowseRetry={setBrowseRetry} setCartOpen={setCartOpen} setFocusedSection={setFocusedSection} setSearchTerm={setSearchTerm} setSelectedProductIndex={setSelectedProductIndex} setShowCameraScanner={setShowCameraScanner} setShowShortcutsModal={setShowShortcutsModal} showCameraScanner={showCameraScanner} showCustomerPopup={showCustomerPopup} showPaymentModal={showPaymentModal} showShortcutsModal={showShortcutsModal} stockInfo={stockInfo} />

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
        <CartPanel appliedVoucher={appliedVoucher} cart={cart} cartFocusedIndex={cartFocusedIndex} change={change} discountAmount={discountAmount} finalTotal={finalTotal} focusedSection={focusedSection} handleRemoveFromCart={handleRemoveFromCart} handleSetManualPricing={handleSetManualPricing} handleSubmit={handleSubmit} handleUpdateQuantity={handleUpdateQuantity} isOpeningCashDrawer={isOpeningCashDrawer} isPendingPayment={isPendingPayment} isSubmitting={isSubmitting} isSyncLocked={isSyncLocked} manualPricingOverrides={manualPricingOverrides} paymentAmount={paymentAmount} paymentAmountInputRef={paymentAmountInputRef} paymentFee={paymentFee} paymentPanelRef={paymentPanelRef} pendingCheckboxRef={pendingCheckboxRef} pendingPaymentRef={pendingPaymentRef} posSettings={posSettings} selectedCustomer={selectedCustomer} selectedPaymentMethod={selectedPaymentMethod} setAppliedVoucher={setAppliedVoucher} setCartFocusedIndex={setCartFocusedIndex} setFocusedSection={setFocusedSection} setIsOpeningCashDrawer={setIsOpeningCashDrawer} setIsPendingPayment={setIsPendingPayment} setPaymentAmount={setPaymentAmount} setSelectedCustomer={setSelectedCustomer} setSelectedPaymentMethod={setSelectedPaymentMethod} setShowCustomerPopup={setShowCustomerPopup} setTaxAmount={setTaxAmount} showError={showError} showPaymentModal={showPaymentModal} showSuccess={showSuccess} stockInfo={stockInfo} submitButtonRef={submitButtonRef} subtotal={subtotal} taxAmount={taxAmount} />

      {showCustomerPopup && posSettings?.showCustomerSearch && (
        <CustomerPopup customerSearchRef={customerSearchRef} selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer} setShowCustomerPopup={setShowCustomerPopup} />
      )}

      {showShortcutsModal && (
        <ShortcutModal onClose={() => setShowShortcutsModal(false)} />
      )}

      {/* Payment Modal */}
      <PaymentModal cart={cart} change={change} finalTotal={finalTotal} handleSubmit={handleSubmit} isOpeningCashDrawer={isOpeningCashDrawer} isPendingPayment={isPendingPayment} isSubmitting={isSubmitting} isSyncLocked={isSyncLocked} paymentAmount={paymentAmount} paymentAmountInputRef={paymentAmountInputRef} paymentModalRef={paymentModalRef} pendingCheckboxRef={pendingCheckboxRef} pendingPaymentRef={pendingPaymentRef} selectedPaymentMethod={selectedPaymentMethod} setIsOpeningCashDrawer={setIsOpeningCashDrawer} setIsPendingPayment={setIsPendingPayment} setPaymentAmount={setPaymentAmount} setSelectedPaymentMethod={setSelectedPaymentMethod} showError={showError} showPaymentModal={showPaymentModal} showSuccess={showSuccess} submitButtonRef={submitButtonRef} />

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