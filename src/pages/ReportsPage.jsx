import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, BarChart3 } from 'lucide-react';
import HeaderActionButton from '../components/HeaderActionButton';
import DataTable from '../components/DataTable';
import { getSales, getStockReport, getStock, getBranches, getProducts, getSalesReport, getPaymentMethodStats, getPaymentHistory, getSalesReturns } from '../services/api';
import { extractArray, extractData } from '../utils/apiResponseHelper';
import { SearchFilterBar, FilterPanel } from '../components/SearchFilterBar';
import useSearchAndFilter from '../hooks/useSearchAndFilter';
import Pagination from '../components/Pagination';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import { AlertTriangle, CheckCircle, CreditCard, Trophy, Star, Package } from 'lucide-react';

import { exportToExcel } from '../utils/exportHelper';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const ReportsPage = () => {
  const location = useLocation();
  const [sales, setSales] = useState([]);
  const [serverReport, setServerReport] = useState(null);
  const [serverPaymentStats, setServerPaymentStats] = useState(null);
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [priceTypeFilter, setPriceTypeFilter] = useState('all'); // 'all' | 'eceran' | 'grosir'
  const [granularity, setGranularity] = useState('all'); // 'all' | 'daily' | 'monthly' | 'yearly'
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let salesData = [];
        let stockData = [];
        let productsData = [];
        let returnsData = [];

        // Try API first for all report data (excluding loading 90,000+ products to avoid browser freeze)
        try {
          const [salesRes, stockRes, returnsRes] = await Promise.all([
            getSales({ include: 'detail_pembayaran', page: 1, limit: 1000 }), // Large limit for reports
            getStock().catch(() => getStockReport()), // Try /stok first, fallback to /laporan/stok
            getSalesReturns()
          ]);
          salesData = extractArray(salesRes);
          stockData = extractArray(stockRes);
          productsData = []; // Skip loading huge catalog into memory
          returnsData = extractArray(returnsRes);
        } catch (_apiError) {

          // Skip fallback to local products database for performance integrity

          // For stock data, try local database fallback
          if (window.electronAPI?.dbSelect) {
            try {
              const localStock = await window.electronAPI.dbSelect({
                table: 'products',
                whereClause: '1=1',
                whereValues: []
              });
              if (localStock && Array.isArray(localStock)) {
                stockData = localStock.map(product => ({
                  ...product,
                  total_stok: product.stok || 0,
                  total_nilai_inventory: (product.stok || 0) * (product.harga_jual || 0)
                }));
              }
            } catch (_localStockError) {
              if (import.meta.env.DEV) {

              }
            }
          }

          // If still no stock data, try to use products data as fallback
          if ((!stockData || stockData.length === 0) && productsData && productsData.length > 0) {
            stockData = productsData.map(product => ({
              id_produk: product.id_produk,
              nama_produk: product.nama_produk,
              total_stok: product.stok || 0,
              harga_jual: product.harga_jual || 0,
              total_nilai_inventory: (product.stok || 0) * (product.harga_jual || 0),
              detail_lokasi: {
                gudang: product.stok || 0,
                cabang: []
              }
            }));
          }

          // For other data, use empty arrays since reports can work with partial data
          salesData = [];
          returnsData = [];
        }

        setProducts(productsData);
        setReturns(returnsData);

        // Use apiResponseHelper untuk ekstraksi yang konsisten
        // Normalize numeric fields to ensure calculations work correctly in the UI
        const normalizedStock = (stockData || []).map(item => {
          const total_stok = Number(item.total_stok || item.stok || 0);
          let total_nilai_inventory = Number(item.total_nilai_inventory || 0);

          // If backend value missing or zero, compute from detail_lokasi
          if (!total_nilai_inventory) {
            const cabangSum = (item.detail_lokasi?.cabang || []).reduce((s, c) => s + Number(c.nilai_inventori || 0), 0);
            const gudangQty = Number(item.detail_lokasi?.gudang || 0);
            const gudangPrice = Number(item.harga_jual || item.Produk?.harga_jual || 0);
            total_nilai_inventory = cabangSum + (gudangQty * gudangPrice);
          }

          return { ...item, total_stok, total_nilai_inventory };
        });


        setStock(normalizedStock);
        
        // Enrich sales data with payment details if not already included
        const enrichedSalesData = await Promise.all(
          salesData.map(async (sale) => {
            // If sale already has detail_pembayaran, use it
            if (sale.detail_pembayaran && Array.isArray(sale.detail_pembayaran) && sale.detail_pembayaran.length > 0) {
              return sale;
            }
            
            // Otherwise, fetch payment history separately
            try {
              const paymentResponse = await getPaymentHistory(sale.id_penjualan);
              const paymentData = extractArray(paymentResponse);
              
              // Transform payment history to match expected detail_pembayaran structure
              const detail_pembayaran = paymentData.map(payment => ({
                id_detail_pembayaran: payment.id_detail_pembayaran || payment.id,
                id_metode_pembayaran: payment.id_metode_pembayaran,
                jumlah_bayar: payment.jumlah_bayar,
                metodePembayaran: {
                  nama_metode: payment.MetodePembayaran?.nama_metode || payment.metode_pembayaran || 'Tunai'
                }
              }));
              
              return {
                ...sale,
                detail_pembayaran: detail_pembayaran.length > 0 ? detail_pembayaran : null
              };
            } catch (paymentErr) {
              console.warn(`Failed to fetch payment details for sale ${sale.id_penjualan}:`, paymentErr);
              return sale; // Return sale without payment details
            }
          })
        );
        
        setSales(enrichedSalesData);
        
        // Fetch branches for filter
        try {
          const branchesRes = await getBranches();
          setBranches(extractArray(branchesRes));
        } catch (bErr) {
          console.warn('Gagal memuat daftar cabang:', bErr);
        }
      } catch (err) {
        setError('Gagal memuat data untuk laporan.');
        console.error("Failed to fetch report data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch server-side aggregated report and payment stats when filters change
  useEffect(() => {
    const fetchServerReports = async () => {
      try {
        const params = {
          dari: startDate || undefined,
          sampai: endDate || undefined,
          tipe_penjualan: undefined,
          id_cabang: selectedBranch || undefined,
        };
        const [salesRes, statsRes] = await Promise.all([
          getSalesReport(params).catch(() => null),
          getPaymentMethodStats({ dari: startDate || undefined, sampai: endDate || undefined }).catch(() => null)
        ]);

        if (salesRes && (salesRes.data?.data || salesRes.data)) {
          setServerReport(extractData(salesRes));
        }
        if (statsRes && (statsRes.data?.data || statsRes.data)) {
          setServerPaymentStats(extractData(statsRes));
        }
      } catch (err) {
        console.warn('Server report fetch error', err);
      }
    };

    // Only fetch when dates are set or when user explicitly wants server data
    if (startDate || endDate || selectedBranch) {
      fetchServerReports();
    }
  }, [startDate, endDate, selectedBranch]);

  // Auto-set date range based on granularity
  useEffect(() => {
    const now = new Date();
    let start, end;
    
    if (granularity === 'daily') {
      // Today
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (granularity === 'monthly') {
      // Current month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (granularity === 'yearly') {
      // Current year
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    } else if (granularity === 'all') {
      // Clear dates for all data
      setStartDate('');
      setEndDate('');
      return;
    }
    
    if (start && end) {
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [granularity]);

  const groupKey = useCallback((dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    if (granularity === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    if (granularity === 'yearly') return `${d.getFullYear()}`; // YYYY
    return d.toLocaleDateString('id-ID'); // daily
  }, [granularity]);

  const filteredSales = useMemo(() => {
    // If granularity is 'all' and no manual date filters, return all sales
    if (granularity === 'all' && !startDate && !endDate && !selectedBranch && priceTypeFilter === 'all') return sales;
    
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    const filtered = (sales || []).filter(s => {
      if (!s.tanggal) return false;
      const d = new Date(s.tanggal);
      if (isNaN(d)) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      // Apply branch filter if selected
      if (selectedBranch) {
        const idCabang = s.cabang?.id_cabang || s.Cabang?.id_cabang || s.id_cabang || s.branch_id || '';
        if (!idCabang) return false;
        // selectedBranch stored as string; compare as string
        if (String(idCabang) != String(selectedBranch)) return false;
      }
      // Apply price type filter if selected
      if (priceTypeFilter !== 'all') {
        const hasMatchingPriceType = s.PenjualanDetails?.some(detail => 
          detail.tipe_harga === priceTypeFilter
        );
        if (!hasMatchingPriceType) return false;
      }
      return true;
    });
    return filtered;
  }, [sales, startDate, endDate, selectedBranch, priceTypeFilter, granularity]);

  const { filteredItems: searchedSales } = useSearchAndFilter(filteredSales, {
    searchTerm: searchQuery,
    searchKeys: ['no_struk', 'kode_transaksi', 'user.nama_lengkap', 'User.nama_lengkap', 'cabang.nama_cabang', 'Cabang.nama_cabang'],
    debounceDelay: 300,
  });

  const salesSummary = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const totalTransactions = filteredSales.length;
    return { totalRevenue, totalTransactions };
  }, [filteredSales]);

  // Helper functions for return-adjusted calculations
  const getAdjustedSalesData = useMemo(() => {
    // Create a map of returns by sale ID for quick lookup
    const returnsBySale = returns.reduce((acc, retur) => {
      if (!acc[retur.id_penjualan]) {
        acc[retur.id_penjualan] = [];
      }
      acc[retur.id_penjualan].push(retur);
      return acc;
    }, {});

    // Adjust sales data by subtracting returns
    const adjustedSales = searchedSales.map(sale => {
      const saleReturns = returnsBySale[sale.id_penjualan] || [];
      const totalReturnedValue = saleReturns.reduce((sum, retur) => {
        // Find the product in the sale to get the unit price
        const saleItems = sale.items || sale.detail || [];
        const returnedItem = saleItems.find(item => 
          String(item.id_produk) === String(retur.id_produk)
        );
        const unitPrice = returnedItem ? Number(returnedItem.harga_jual || returnedItem.subtotal / returnedItem.jumlah || 0) : 0;
        return sum + (Number(retur.jumlah) * unitPrice);
      }, 0);

      return {
        ...sale,
        adjustedTotal: Number(sale.total) - totalReturnedValue,
        returns: saleReturns,
        totalReturnedValue
      };
    });

    return adjustedSales;
  }, [searchedSales, returns]);

  // Adjusted sales summary (accounting for returns)
  const adjustedSalesSummary = useMemo(() => {
    const totalRevenue = getAdjustedSalesData.reduce((sum, sale) => sum + Number(sale.adjustedTotal), 0);
    const totalTransactions = getAdjustedSalesData.length;
    const totalReturns = returns.length;
    const totalReturnedValue = getAdjustedSalesData.reduce((sum, sale) => sum + Number(sale.totalReturnedValue), 0);
    const totalGross = getAdjustedSalesData.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const totalKekurangan = getAdjustedSalesData.reduce((sum, sale) => {
      const total = Number(sale.total || 0);
      const bayar = Number(sale.bayar || 0);
      return sum + Math.max(0, total - bayar);
    }, 0);
    
    return { 
      totalRevenue, 
      totalTransactions, 
      totalReturns, 
      totalReturnedValue,
      netRevenue: totalRevenue,
      totalGross,
      totalKekurangan
    };
  }, [getAdjustedSalesData, returns]);

  useEffect(() => {
  }, [startDate, endDate, selectedBranch, priceTypeFilter, searchQuery, granularity]);

  // Payment method revenue breakdown (define before paymentMethodChartData)
  const paymentMethodRevenue = useMemo(() => {
    const methodMap = {};
    (filteredSales || []).forEach(s => {
      // Handle new structure: detail_pembayaran array with nested metodePembayaran
      let paymentMethods = [];

      if (Array.isArray(s.detail_pembayaran) && s.detail_pembayaran.length > 0) {
        paymentMethods = s.detail_pembayaran.map(p => ({
          nama_metode: p.metodePembayaran?.nama_metode || p.metode_pembayaran || 'Tunai',
          jumlah: Number(p.jumlah_bayar || 0)
        }));
      } else {
        // Fallback: old structure
        const methodName = s.MetodePembayaran?.nama_metode || s.metode_pembayaran || 'Tunai';
        paymentMethods = [{ nama_metode: methodName, jumlah: Number(s.total || 0) }];
      }

      // Group by method name (not ID) to avoid duplicates
      paymentMethods.forEach(method => {
        const methodKey = method.nama_metode; // Use name as key instead of ID
        if (!methodMap[methodKey]) {
          methodMap[methodKey] = {
            nama_metode: method.nama_metode,
            totalRevenue: 0,
            transactionCount: 0
          };
        }
        methodMap[methodKey].totalRevenue += method.jumlah;
      });

      // Count this sale as one transaction for each unique method used
      const uniqueMethods = [...new Set(paymentMethods.map(m => m.nama_metode))];
      uniqueMethods.forEach(methodName => {
        if (methodMap[methodName]) {
          methodMap[methodName].transactionCount += 1;
        }
      });
    });

    return Object.values(methodMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredSales]);

  // Chart data for payment method distribution (prefers server stats)
  const paymentMethodChartData = useMemo(() => {
    const source = (serverPaymentStats && serverPaymentStats.length > 0) ? serverPaymentStats : paymentMethodRevenue || [];
    const labels = source.map(m => m.nama_metode || m.nama_metode || m.method || 'Lainnya');
    const data = source.map(m => Number(m.total_nominal ?? m.totalRevenue ?? m.total ?? 0));
    const background = [
      'rgba(75, 192, 192, 0.6)',
      'rgba(255, 99, 132, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(153, 102, 255, 0.6)'
    ];
    return { labels, datasets: [{ data, backgroundColor: background.slice(0, Math.max(3, labels.length)) }] };
  }, [paymentMethodRevenue, serverPaymentStats]);

  // Branch-wise breakdown for sales (adjusted for returns)
  const branchRevenueSummary = useMemo(() => {
    const branchMap = {};
    (getAdjustedSalesData || []).forEach(s => {
      const branchName = s.cabang?.nama_cabang || s.Cabang?.nama_cabang || 'Unknown';
      const branchId = s.cabang?.id_cabang || s.Cabang?.id_cabang || s.id_cabang || 'unknown';
      if (!branchMap[branchId]) {
        branchMap[branchId] = { nama_cabang: branchName, totalRevenue: 0, totalTransactions: 0, totalReturns: 0, totalReturnedValue: 0 };
      }
      branchMap[branchId].totalRevenue += Number(s.adjustedTotal || 0);
      branchMap[branchId].totalTransactions += 1;
      branchMap[branchId].totalReturns += s.returns?.length || 0;
      branchMap[branchId].totalReturnedValue += Number(s.totalReturnedValue || 0);
    });
    return Object.values(branchMap);
  }, [getAdjustedSalesData]);

  // Stock decision summary: low stock items per branch
  const stockDecisionSummary = useMemo(() => {
    const branchStockMap = {};
    (stock || []).forEach(item => {
      const branchName = item.Cabang?.nama_cabang || 'Unknown';
      const branchId = item.Cabang?.id_cabang || 'unknown';
      if (!branchStockMap[branchId]) {
        branchStockMap[branchId] = { nama_cabang: branchName, lowStockItems: [], totalStok: 0 };
      }
      branchStockMap[branchId].totalStok += Number(item.stok || 0);
      // Flag items with stock < 10 as low stock
      if (Number(item.stok || 0) < 10) {
        branchStockMap[branchId].lowStockItems.push({
          id_produk: item.id_produk,
          nama_produk: item.Produk?.nama_produk || 'Unknown',
          stok: Number(item.stok || 0),
        });
      }
    });
    return Object.values(branchStockMap).sort((a, b) => b.lowStockItems.length - a.lowStockItems.length);
  }, [stock]);

  const salesByDateChartData = useMemo(() => {
    // Prefer server-provided series when available (flexible shapes)
    if (serverReport && (serverReport.series || serverReport.rows || serverReport.data)) {
      // serverReport.series expected as [{ label, value }] or [{ periode, total }]
      const series = serverReport.series || serverReport.rows || serverReport.data;
      const labels = series.map(s => s.label ?? s.periode ?? (s.tanggal || ''));
      const data = series.map(s => Number(s.value ?? s.total ?? s.nominal ?? s.jumlah ?? 0));
      const labelText = granularity === 'monthly' ? 'Pendapatan per Bulan' : granularity === 'yearly' ? 'Pendapatan per Tahun' : 'Pendapatan per Periode';
      return {
        labels,
        datasets: [{ label: labelText, data, backgroundColor: 'rgba(54, 162, 235, 0.6)' }],
      };
    }

    // Fallback: Group adjusted sales data by selected granularity
    const salesByPeriod = (getAdjustedSalesData || []).reduce((acc, sale) => {
      const key = groupKey(sale.tanggal);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + Number(sale.adjustedTotal || 0);
      return acc;
    }, {});

    const labels = Object.keys(salesByPeriod).sort();
    const data = labels.map(l => salesByPeriod[l]);

    const labelText = granularity === 'monthly' ? 'Pendapatan Bersih per Bulan' : granularity === 'yearly' ? 'Pendapatan Bersih per Tahun' : 'Pendapatan Bersih per Hari';

    return {
      labels,
      datasets: [{
        label: labelText,
        data,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
      }],
    };
  }, [getAdjustedSalesData, groupKey, granularity, serverReport]);

  const stockByBranchChartData = useMemo(() => {
    const stockByBranch = stock.reduce((acc, item) => {
      const branchName = item.Cabang?.nama_cabang || 'N/A';
      acc[branchName] = (acc[branchName] || 0) + item.stok;
      return acc;
    }, {});

    return {
      labels: Object.keys(stockByBranch),
      datasets: [{
        label: 'Jumlah Stok per Cabang',
        data: Object.values(stockByBranch),
        backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(255, 206, 86, 0.6)'],
      }],
    };
  }, [stock]);

  // Additional analytics helpers
  
  // Average transaction value (adjusted for returns)
  const avgTransactionValue = useMemo(() => {
    if (getAdjustedSalesData.length === 0) return 0;
    return getAdjustedSalesData.reduce((sum, s) => sum + Number(s.adjustedTotal || 0), 0) / getAdjustedSalesData.length;
  }, [getAdjustedSalesData]);

  // Top 5 products by quantity sold (adjusted for returns)
  const topProductsBySales = useMemo(() => {
    const productMap = {};
    
    // First, add all sales quantities and calculate revenue properly
    (filteredSales || []).forEach(sale => {
      const items = sale.items || sale.detail || sale.line_item || [];
      const itemsArray = Array.isArray(items) ? items : (items && Object.values(items)) || [];
      
      itemsArray.forEach(item => {
        if (!item) return;
        
        const prodId = item.id_produk || item.product_id || item.productId || '';
        if (!prodId) return;
        
        const prodName = item.nama_produk || item.Produk?.nama_produk || item.nama || `Produk ${prodId}`;
        
        const qty = Number(item.jumlah || item.qty || item.quantity || 0);
        const unitPrice = Number(item.harga_jual || item.price || item.harga || 0);

        if (!productMap[prodId]) {
          productMap[prodId] = { 
            nama_produk: prodName, 
            id_produk: prodId, 
            qty: 0, 
            totalRevenue: 0, 
            returnedQty: 0,
            originalUnitPrice: unitPrice, // Store first encountered unit price
            totalWeightedPrice: 0, // For calculating weighted average price
            totalWeightedQty: 0
          };
        }
        
        // Force calculation as unitPrice * qty to ensure consistency
        // Only use item.subtotal/item.total if unitPrice is not available
        let lineTotal;
        if (unitPrice > 0) {
          lineTotal = unitPrice * qty;
          
          // Safeguard: If calculated total seems unrealistic (> 100M per transaction), use subtotal instead
          if (lineTotal > 100000000 && Number(item.subtotal || item.total || 0) > 0 && Number(item.subtotal || item.total || 0) < lineTotal) {
            console.warn('DEBUG: Using subtotal instead of calculated total for potentially incorrect data:', {
              prodName,
              calculatedTotal: lineTotal,
              subtotal: item.subtotal,
              unitPrice,
              qty
            });
            lineTotal = Number(item.subtotal || item.total || 0);
          }
        } else {
          lineTotal = Number(item.subtotal || item.total || 0);
        }
        
        if (qty > 0) {
          productMap[prodId].qty += qty;
          productMap[prodId].totalRevenue += lineTotal;
        }
      });
    });
    
    // Then subtract returned quantities and adjust revenue
    returns.forEach(retur => {
      const prodId = retur.id_produk;
      if (productMap[prodId]) {
        const returnQty = Number(retur.jumlah);
        productMap[prodId].returnedQty += returnQty;
        productMap[prodId].qty -= returnQty;
        
        // Use the original unit price for return calculation, not the changing average
        const unitPrice = productMap[prodId].originalUnitPrice || 0;
        const returnValue = returnQty * unitPrice;
        
        // Subtract the returned value from revenue
        productMap[prodId].totalRevenue -= returnValue;
      }
    });
    
    const finalResults = Object.values(productMap)
      .filter(p => p.qty > 0) // Only include items with net positive sales
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map(product => {
        return product;
      });
    
    return finalResults;
  }, [filteredSales, products, returns]);

  // Top 5 kasir by revenue (adjusted for returns)
  const topKasirByRevenue = useMemo(() => {
    const kasirMap = {};
    (getAdjustedSalesData || []).forEach(s => {
      // Kasir name comes from user.nama_lengkap or user.nama field
      let kasirName = s.user?.nama_lengkap || s.User?.nama_lengkap || s.user?.nama || s.User?.nama || s.user?.username || s.User?.username || '';
      kasirName = kasirName.trim();
      
      if (kasirName) {
        if (!kasirMap[kasirName]) {
          kasirMap[kasirName] = { kasir: kasirName, totalRevenue: 0, transactionCount: 0, totalReturns: 0 };
        }
        kasirMap[kasirName].totalRevenue += Number(s.adjustedTotal || 0);
        kasirMap[kasirName].transactionCount += 1;
        kasirMap[kasirName].totalReturns += s.returns?.length || 0;
      }
    });
    return Object.values(kasirMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);
  }, [getAdjustedSalesData]);

  // Stock value summary
  const stockValueSummary = useMemo(() => {
    let totalValue = 0;
    let totalItems = 0;
    let criticalStockCount = 0; // stok < 5
    let lowStockCount = 0; // stok 5-10

    (stock || []).forEach(item => {
      // Prefer backend-provided aggregated fields when available
      const itemStok = Number(item.total_stok || item.stok || 0);
      let itemValue = Number(item.total_nilai_inventory || 0);

      // If backend didn't supply a precomputed inventory value, compute from detail_lokasi
      if (!itemValue || itemValue === 0) {
        // Sum cabang nilai_inventori
        const cabangSum = (item.detail_lokasi?.cabang || []).reduce((s, c) => s + Number(c.nilai_inventori || 0), 0);
        // Gudang value: approximate by gudang qty * harga_jual (if available)
        const gudangQty = Number(item.detail_lokasi?.gudang || 0);
        const gudangPrice = Number(item.harga_jual || item.Produk?.harga_jual || 0);
        const gudangVal = gudangQty * (gudangPrice || 0);

        itemValue = cabangSum + gudangVal;
      }

      totalItems += itemStok;
      totalValue += itemValue;

      // For critical/low stock count, check the detail_lokasi if available
      // Otherwise fall back to item stok count
      const stokNum = itemStok;
      if (stokNum < 5) criticalStockCount += 1;
      else if (stokNum < 10) lowStockCount += 1;
    });

    return { totalValue, totalItems, criticalStockCount, lowStockCount };
  }, [stock]);

  // Helper untuk format angka rupiah untuk tampilan
  const formatRupiah = (n) => {
    // Default: tampilkan tanpa desimal (format Rupiah umum)
    return Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Helper untuk format metode pembayaran dengan grouping
  const formatPaymentMethods = (sale) => {
    let paymentMethods = [];

    // Handle new structure: detail_pembayaran with nested metodePembayaran
    if (Array.isArray(sale.detail_pembayaran) && sale.detail_pembayaran.length > 0) {
      paymentMethods = sale.detail_pembayaran.map(p => p.metodePembayaran?.nama_metode || 'Tunai');
    } else {
      // Fallback: old structure
      const methodName = sale.MetodePembayaran?.nama_metode ||
                        (typeof sale.metode_pembayaran === 'string' ? sale.metode_pembayaran :
                         sale.metode_pembayaran?.nama_metode || 'Tunai');
      paymentMethods = [methodName];
    }

    // Group by method name and count occurrences
    const methodCount = {};
    paymentMethods.forEach(method => {
      methodCount[method] = (methodCount[method] || 0) + 1;
    });

    // Format as "Method (count)x" for multiples, just "Method" for singles
    const formatted = Object.entries(methodCount)
      .map(([method, count]) => count > 1 ? `${method} (${count}x)` : method)
      .join(', ');

    return formatted;
  };

  // Helper untuk menampilkan status pembayaran / kekurangan
  const formatPaymentStatus = (sale) => {
    const total = Number(sale.total || 0);
    const bayar = Number(sale.bayar || 0);
    const kekurangan = total - bayar;
    if (kekurangan > 0) {
      return `Kurang (Rp ${formatRupiah(kekurangan)})`;
    }
    return 'Lunas';
  };

  // Handler untuk export data penjualan ke Excel (menggunakan data yang terfilter)
  const handleExportSales = () => {
    try {
      const rows = (searchedSales || []).map(s => {
        const total = Number(s.total || 0);
        const bayar = Number(s.bayar || 0);
        const kekurangan = Math.max(0, total - bayar);
        return {
          Tanggal: s.tanggal ? new Date(s.tanggal).toLocaleString('id-ID') : '',
          NoStruk: s.no_struk || s.kode_transaksi || s.id || '',
          Kasir: s.user?.nama_lengkap || s.User?.nama_lengkap || s.user?.nama || s.User?.nama || '',
          Cabang: s.cabang?.nama_cabang || s.Cabang?.nama_cabang || '',
          MetodePembayaran: formatPaymentMethods(s),
          StatusPembayaran: formatPaymentStatus(s),
          Kekurangan: kekurangan,
          Items: (s.items || s.detail || []).length || 0,
          Total: total,
          Bayar: bayar,
          Kembali: Number(s.kembali || s.kembalian || 0),
        };
      });
      exportToExcel(rows, `Laporan_Penjualan_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengekspor data ke Excel. Cek console untuk detail.');
    }
  };

  // Build aggregated rows according to granularity for export
  const getAggregatedRows = () => {
    const groupKey = (dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d)) return '';
      if (granularity === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (granularity === 'yearly') return `${d.getFullYear()}`;
      return d.toLocaleDateString('id-ID');
    };
    const map = (filteredSales || []).reduce((acc, s) => {
      const key = groupKey(s.tanggal);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + Number(s.total || 0);
      return acc;
    }, {});
    return Object.keys(map).sort().map(k => ({ Periode: k, Total: map[k] }));
  };

  const handleExportSummary = () => {
    try {
      const rows = getAggregatedRows();
      exportToExcel(rows, `Laporan_Ringkasan_${granularity}_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      console.error('Export ringkasan error:', err);
      alert('Gagal mengekspor ringkasan. Lihat console untuk detail.');
    }
  };

  const handleExportServerReport = () => {
    try {
      const serverRows = serverReport?.rows || serverReport?.data || serverReport?.series || null;
      if (!serverRows || (Array.isArray(serverRows) && serverRows.length === 0)) {
        alert('Tidak ada data laporan server untuk diekspor.');
        return;
      }

      // If server provided a simple series [{label, value}] convert to rows
      if (serverReport?.series && Array.isArray(serverReport.series)) {
        const mapped = serverReport.series.map(s => ({ Periode: s.label ?? s.periode, Total: Number(s.value ?? s.total ?? 0) }));
        exportToExcel(mapped, `Laporan_Server_${new Date().toISOString().slice(0,10)}.xlsx`);
        return;
      }

      // Otherwise export the rows/data directly
      exportToExcel(serverRows, `Laporan_Server_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      console.error('Export server report error:', err);
      alert('Gagal mengekspor laporan server. Lihat console untuk detail.');
    }
  };

  const chartTitle = granularity === 'all' ? 'Pendapatan Bersih Keseluruhan' : granularity === 'monthly' ? 'Pendapatan Bersih per Bulan' : granularity === 'yearly' ? 'Pendapatan Bersih per Tahun' : 'Pendapatan Bersih per Hari';

  if (loading) return <div className="text-center mt-10">Memuat data laporan...</div>;
  if (error) return <div className="text-center mt-10 text-red-500">{error}</div>;

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Laporan & Monitoring"
          subtitle="Pantau performa penjualan, stok, dan analisis bisnis"
          actions={
            <>
              <HeaderActionButton
                icon={Download}
                label="Export Detail"
                onClick={handleExportSales}
                variant="success"
              />
              <HeaderActionButton
                icon={BarChart3}
                label="Export Ringkasan"
                onClick={handleExportSummary}
                variant="success"
              />
              <HeaderActionButton
                icon={Download}
                label="Export Server Report"
                onClick={handleExportServerReport}
                variant="secondary"
              />
            </>
          }
        />

        {/* Filter Controls */}
        <SearchFilterBar
          searchTerm={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          onFilterToggle={() => setShowFilterPanel(prev => !prev)}
          isFilterActive={showFilterPanel}
          hasActiveFilters={Boolean(searchQuery) || selectedBranch || priceTypeFilter !== 'all' || startDate || endDate || granularity !== 'all'}
          onClearFilters={() => {
            setStartDate('');
            setEndDate('');
            setSelectedBranch('');
            setPriceTypeFilter('all');
            setGranularity('all');
            setShowFilterPanel(false);
          }}
          searchPlaceholder="Cari no. struk, nama kasir, atau cabang"
          className="mb-4"
        />
        <FilterPanel visible={showFilterPanel} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold">Dari</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold">Sampai</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold">Cabang</label>
              <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="p-2 border rounded flex-1">
                <option value="">Semua</option>
                {(branches || []).map(b => (
                  <option key={b.id_cabang || b.id || b.value} value={b.id_cabang || b.id || b.value}>{b.nama_cabang || b.nama || b.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold">Tipe Harga</label>
              <select value={priceTypeFilter} onChange={e => setPriceTypeFilter(e.target.value)} className="p-2 border rounded flex-1">
                <option value="all">Semua</option>
                <option value="eceran">Eceran</option>
                <option value="grosir">Grosir</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold">Periode</label>
              <select value={granularity} onChange={e => setGranularity(e.target.value)} className="p-2 border rounded flex-1">
                <option value="all">Semua</option>
                <option value="daily">Harian</option>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>
          </div>
        </FilterPanel>
        <div className="mt-6">
          <h4 className="text-sm font-semibold mb-2">Grafik Metode Pembayaran</h4>
          <div className="max-w-xs mx-auto">
            <Pie data={paymentMethodChartData} options={{ responsive: true, plugins: { title: { display: true, text: 'Distribusi Metode Pembayaran' } } }} />
          </div>
        </div>

      {/* Debug panel when ?debug=1 is present in URL */}
      {new URLSearchParams(location.search).get('debug') === '1' && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-800">
          <div className="font-semibold mb-2">Debug: stock and computed summary</div>
          <pre style={{ maxHeight: 300, overflow: 'auto' }}>
            {JSON.stringify({ stockSummary: stockValueSummary, stockSample: stock.slice(0,10) }, null, 2)}
          </pre>
        </div>
      )}

      {/* Kartu Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600">Total Pendapatan Bersih</h3>
          <p className="text-2xl font-bold text-green-600">Rp {formatRupiah(adjustedSalesSummary.netRevenue)}</p>
          <p className="text-xs text-gray-500">Setelah retur: -Rp {formatRupiah(adjustedSalesSummary.totalReturnedValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600">Total Transaksi</h3>
          <p className="text-2xl font-bold">{adjustedSalesSummary.totalTransactions}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600">Total Retur</h3>
          <p className="text-2xl font-bold text-red-600">{adjustedSalesSummary.totalReturns}</p>
          <p className="text-xs text-gray-500">Nilai: Rp {formatRupiah(adjustedSalesSummary.totalReturnedValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600">Avg Transaksi Bersih</h3>
          <p className="text-2xl font-bold">Rp {formatRupiah(avgTransactionValue)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600">Total Kekurangan</h3>
          <p className="text-2xl font-bold text-red-600">Rp {formatRupiah(adjustedSalesSummary.totalKekurangan)}</p>
          <p className="text-xs text-gray-500">Kurang bayar: {getAdjustedSalesData.filter(s => (Number(s.total || 0) - Number(s.bayar || 0)) > 0).length} transaksi</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600">Total Penjualan (Gross)</h3>
          <p className="text-2xl font-bold text-blue-600">Rp {formatRupiah(adjustedSalesSummary.totalGross)}</p>
          <p className="text-xs text-gray-500">Sebelum retur dan penyesuaian</p>
        </div>
      </div>

      {/* Branch-wise Revenue Summary */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-7">
        <h3 className="text-base font-bold mb-3">Ringkasan Pendapatan per Cabang</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(branchRevenueSummary || []).map((br, idx) => (
            <div key={idx} className="border rounded-lg p-3 bg-gradient-to-br from-blue-50 to-blue-100">
              <h4 className="font-semibold text-gray-700 text-sm">{br.nama_cabang}</h4>
              <p className="text-xs text-gray-600 mt-1">Pendapatan: <span className="font-bold text-green-600">Rp {formatRupiah(br.totalRevenue)}</span></p>
              <p className="text-xs text-gray-600">Transaksi: <span className="font-bold">{br.totalTransactions}</span></p>
              <p className="text-xs text-gray-600">Retur: <span className="font-bold text-red-600">{br.totalReturns}</span> (Rp {formatRupiah(br.totalReturnedValue)})</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Decision Summary for Owner/Admin */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-7">
        <h3 className="text-base font-bold mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-slate-500" />Ringkasan Stok</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(stockDecisionSummary || []).map((branchStock, idx) => (
            <div key={idx} className={`border-l-4 rounded-lg p-3 ${branchStock.lowStockItems.length > 0 ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-800 text-sm">{branchStock.nama_cabang}</h4>
                <span className="text-[11px] px-2 py-1 rounded bg-gray-200">Total {branchStock.totalStok}</span>
              </div>
              {branchStock.lowStockItems.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{branchStock.lowStockItems.length} produk stok rendah</p>
                  <ul className="text-xs space-y-1">
                    {branchStock.lowStockItems.map((item, iidx) => (
                      <li key={iidx} className="text-gray-700">• {item.nama_produk} ({item.stok})</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-green-700 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" />Semua stok normal</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment Method Revenue Breakdown */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-7">
        <h3 className="text-base font-bold mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-slate-500" />Distribusi Metode Pembayaran</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {((serverPaymentStats && serverPaymentStats.length > 0) ? serverPaymentStats : paymentMethodRevenue || []).map((method, idx) => (
            <div key={idx} className="border rounded-lg p-3 bg-gradient-to-br from-purple-50 to-purple-100">
              <h4 className="font-semibold text-gray-700 text-sm truncate" title={method.nama_metode || method.nama_metode}>{method.nama_metode || method.nama_metode}</h4>
              <p className="text-xs text-gray-600 mt-1">Transaksi: <span className="font-bold">{method.total_transaksi ?? method.transactionCount}</span></p>
              <p className="text-xs text-gray-600">Pendapatan: <span className="font-bold">Rp {formatRupiah(method.total_nominal ?? method.totalRevenue)}</span></p>
              <div className="mt-2 bg-gray-200 rounded-full h-1">
                <div 
                  className="bg-purple-500 h-1 rounded-full" 
                  style={{ width: `${((method.total_nominal ?? method.totalRevenue) / (serverReport?.total_penjualan || salesSummary.totalRevenue || 1)) * 100}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">{(((method.total_nominal ?? method.totalRevenue) / (serverReport?.total_penjualan || salesSummary.totalRevenue || 1)) * 100).toFixed(1)}% dari total</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Products & Top Kasir */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
        {/* Top Products by Sales */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-base font-bold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-slate-500" />Top 5 Produk (Bersih)</h3>
          <div className="space-y-2">
            {(topProductsBySales || []).map((prod, idx) => (
              <div key={idx} className="border-b pb-2 last:border-b-0">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-semibold text-gray-800 text-sm truncate" title={prod.nama_produk}>{idx + 1}. {prod.nama_produk}</p>
                    <p className="font-bold text-green-600 text-sm whitespace-nowrap">Rp {formatRupiah(prod.totalRevenue)}</p>
                  </div>
                  <p className="text-xs text-gray-600">Terjual Bersih: {prod.qty} item</p>
                  {prod.returnedQty > 0 && (
                    <p className="text-xs text-red-600">Retur: {prod.returnedQty} item</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Kasir by Revenue */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-base font-bold mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-slate-500" />Top 5 Kasir (Bersih)</h3>
          <div className="space-y-2">
            {(topKasirByRevenue || []).map((kasir, idx) => (
              <div key={idx} className="border-b pb-2 last:border-b-0">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-semibold text-gray-800 text-sm truncate" title={kasir.kasir}>{idx + 1}. {kasir.kasir}</p>
                    <p className="font-bold text-blue-600 text-sm whitespace-nowrap">Rp {formatRupiah(kasir.totalRevenue)}</p>
                  </div>
                  <p className="text-xs text-gray-600">Transaksi: {kasir.transactionCount}</p>
                  {kasir.totalReturns > 0 && (
                    <p className="text-xs text-red-600">Retur: {kasir.totalReturns}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stock Status Overview */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-7">
        <h3 className="text-base font-bold mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-slate-500" />Ringkasan Status Stok</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-500">
            <p className="text-xs text-gray-600">Total Item Stok</p>
            <p className="text-xl font-bold text-blue-600">{stockValueSummary.totalItems}</p>
          </div>
          <div className="bg-green-50 p-3 rounded border-l-4 border-green-500">
            <p className="text-xs text-gray-600">Nilai Stok</p>
            <p className="text-xl font-bold text-green-600">Rp {formatRupiah(stockValueSummary.totalValue)}</p>
          </div>
          <div className="bg-orange-50 p-3 rounded border-l-4 border-orange-500">
            <p className="text-xs text-gray-600">Stok Rendah (5-10)</p>
            <p className="text-xl font-bold text-orange-600">{stockValueSummary.lowStockCount}</p>
          </div>
          <div className="bg-red-50 p-3 rounded border-l-4 border-red-500">
            <p className="text-xs text-gray-600">Stok Kritis (&lt;5)</p>
            <p className="text-xl font-bold text-red-600">{stockValueSummary.criticalStockCount}</p>
          </div>
        </div>
      </div>

      {/* Area Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-base font-bold mb-3">{chartTitle}</h3>
          <Bar data={salesByDateChartData} options={{ responsive: true, plugins: { title: { display: true, text: chartTitle } } }} />
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h3 className="text-base font-bold mb-3">Distribusi Stok per Cabang</h3>
          <div className="max-w-xs mx-auto">
            <Pie data={stockByBranchChartData} options={{ responsive: true, plugins: { title: { display: true, text: 'Stok per Cabang' } } }} />
          </div>
        </div>
      </div>

      {/* Tabel detail penjualan */}
      <div className="bg-white p-4 rounded-xl shadow-sm mt-7">
        <h3 className="text-base font-bold mb-3">Daftar Transaksi</h3>
        <DataTable
          data={getAdjustedSalesData}
          columns={[
            {
              key: 'tanggal',
              header: 'Tanggal',
              render: (row) => row.tanggal ? new Date(row.tanggal).toLocaleString('id-ID') : ''
            },
            {
              key: 'no_struk',
              header: 'No. Struk',
              render: (row) => row.no_struk || row.kode_transaksi || row.id || ''
            },
            {
              key: 'user',
              header: 'Kasir',
              render: (row) => {
                return row.user?.nama_lengkap || row.User?.nama_lengkap || row.user?.nama || row.User?.nama || '';
              }
            },
            {
              key: 'cabang',
              header: 'Cabang',
              render: (row) => {
                return row.cabang?.nama_cabang || row.Cabang?.nama_cabang || '';
              }
            },
            {
              key: 'metode_pembayaran',
              header: 'Metode',
              render: (row) => {
                return formatPaymentMethods(row);
              }
            },
            {
              key: 'status_bayar',
              header: 'Status Bayar',
              render: (row) => `${formatPaymentStatus(row)}`
            },
            {
              key: 'items',
              header: 'Items',
              render: (row) => `${(row.items || row.detail || []).length || 0}`
            },
            {
              key: 'total',
              header: 'Total Asli',
              render: (row) => `Rp ${formatRupiah(row.total)}`
            },
            {
              key: 'adjustedTotal',
              header: 'Total Bersih',
              render: (row) => `Rp ${formatRupiah(row.adjustedTotal)}`
            },
            {
              key: 'returns',
              header: 'Retur',
              render: (row) => {
                if (row.returns && row.returns.length > 0) {
                  return `${row.returns.length} item (Rp ${formatRupiah(row.totalReturnedValue)})`;
                }
                return '-';
              }
            }
          ]}
          searchKeys={['tanggal', 'no_struk', 'kode_transaksi', 'user.nama_lengkap', 'User.nama_lengkap', 'cabang.nama_cabang', 'Cabang.nama_cabang']}
          filters={[
            {
              key: 'cabang.nama_cabang',
              label: 'Cabang',
              type: 'select',
              options: Array.from(new Set((getAdjustedSalesData || []).map(s => s.cabang?.nama_cabang || s.Cabang?.nama_cabang).filter(Boolean))).map(name => ({ label: name, value: name })),
              defaultValue: ''
            }
          ]}
          itemsPerPage={20}
          showPagination={true}
        />
      </div>
    </PageContainer>
    </PageLayout>
  );
};

export default React.memo(ReportsPage);