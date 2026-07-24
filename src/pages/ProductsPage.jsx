import React, { useState, useEffect, useCallback } from 'react';
import { getProducts, deleteProduct, updateProduct, getCategories, bulkImportProducts, bulkDeleteProducts } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { resolveUrl } from '../utils/resolveUrl';
import { generateBarcodeDataUrl } from '../utils/barcodeHelper';
import { UniversalPrintModal, PRINT_TYPES } from '../components/UniversalPrintModal';
import { useNotifications } from '../hooks/useNotifications';
import { handleError } from '../utils/errorHandler';
import { withErrorBoundary } from '../components/withErrorBoundary';
import { useSettings } from '../context/SettingsContext';
import ExcelJS from 'exceljs';
import { usePermissions } from '../hooks/usePermissions';
import CategoryInfoModal from '../components/CategoryInfoModal';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import HeaderActionButton from '../components/HeaderActionButton';
import { Edit, Trash2, Printer, Eye, Plus, Download, Upload, FileText, Info } from 'lucide-react';
import useProductOfflineDB from '../hooks/useProductOfflineDB';
import { usePagination } from '../hooks/usePagination';
import FileViewerModal from '../components/FileViewerModal';
import ConfirmDialog from '../components/common/ConfirmDialog';

const ProductsPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Hapus',
    onConfirm: null,
    variant: 'danger'
  });
  const { success: showSuccess, error: showError, warning: showWarning } = useNotifications();
  const { isSyncing, syncProgress, totalProducts: syncedProducts } = useProductOfflineDB();
  const { storeInfo } = useSettings();
  
  const [modalImage, setModalImage] = useState(null);
  const [modalAlt, setModalAlt] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingImageIds, setRemovingImageIds] = useState([]);

  const [categories, setCategories] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [showCategoryInfoModal, setShowCategoryInfoModal] = useState(false);
  const [isBarcodePrintModalOpen, setIsBarcodePrintModalOpen] = useState(false);
  const [productsToPrint, setProductsToPrint] = useState([]);

  // Server-side pagination and filter state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState({ status: '', kategori: '' });

  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [importProgress, setImportProgress] = useState({ active: false, current: 0, total: 0, successCount: 0, failCount: 0 });
  const [importOptions, setImportOptions] = useState({ ignoreDuplicates: true, updateDuplicates: false });
  const [showImportOptionsModal, setShowImportOptionsModal] = useState(false);
  const [excelDataToImport, setExcelDataToImport] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page,
        limit,
        search: searchQuery || undefined,
        status: filterValues.status && filterValues.status !== 'all' ? filterValues.status : undefined,
        kategori: filterValues.id_kategori || undefined
      };
      
      const response = await getProducts(params);
      let productsData = [];
      let total = 0;
      
      if (response.data && response.data.success) {
        productsData = response.data.data || [];
        total = response.data.pagination?.total || productsData.length;
      } else if (Array.isArray(response.data)) {
        productsData = response.data;
        total = productsData.length;
      }
      
      setAllProducts(productsData);
      setTotalItems(total);
    } catch (_apiError) {
      try {
        if (window.electronAPI?.dbSelect) {
          let whereClause = '1=1';
          const whereValues = [];
          
          if (searchQuery) {
            whereClause += ` AND (nama_produk LIKE ? OR kode_produk LIKE ? OR merek LIKE ?)`;
            const term = `%${searchQuery}%`;
            whereValues.push(term, term, term);
          }
          if (filterValues.status && filterValues.status !== 'all') {
            whereClause += ` AND status = ?`;
            whereValues.push(filterValues.status);
          }
          if (filterValues.id_kategori) {
            whereClause += ` AND id_kategori = ?`;
            whereValues.push(Number(filterValues.id_kategori));
          }

          let localProducts = await window.electronAPI.dbSelect({
            table: 'products',
            whereClause,
            whereValues
          });
          
          if (localProducts && Array.isArray(localProducts)) {
            setTotalItems(localProducts.length);
            const offset = (page - 1) * limit;
            const paginatedLocal = localProducts.slice(offset, offset + limit);
            setAllProducts(paginatedLocal);
          }
        }
      } catch (_localError) {
        setError('Gagal memuat data produk. Silakan coba lagi nanti.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, filterValues]);

  const fetchCategoriesAndUnits = useCallback(async () => {
    try {
      const categoriesRes = await getCategories();
      setCategories(categoriesRes.data?.data || categoriesRes.data || []);
    } catch (_err) {
      showError('Gagal mengambil kategori');
    }
  }, [showError]);

  const handleEditCategory = (product) => {
    setEditingCategory(product);
    setSelectedCategoryId(product.id_kategori ? String(product.id_kategori) : '');
  };

  const handleSaveCategory = async () => {
    if (!editingCategory || !selectedCategoryId) return;
    try {
      const formData = new FormData();
      formData.append('nama_produk', editingCategory.nama_produk);
      formData.append('harga_jual', editingCategory.harga_jual);
      if (selectedCategoryId && selectedCategoryId !== '') {
        formData.append('id_kategori', selectedCategoryId);
      }
      const _response = await updateProduct(editingCategory.id_produk, formData);
      setAllProducts(prev => prev.map(p =>
        p.id_produk === editingCategory.id_produk
          ? { ...p, id_kategori: parseInt(selectedCategoryId, 10) }
          : p
      ));
      setEditingCategory(null);
      setSelectedCategoryId('');
      showSuccess('Kategori berhasil diperbarui');
    } catch (updateError) {
      handleError(updateError, 'ProductsPage:updateCategory', 'Gagal memperbarui kategori');
    }
  };

  const handleCloseEditCategory = () => {
    setEditingCategory(null);
    setSelectedCategoryId('');
  };

  const generatePrintHtml = (product) => {
    const priceDisplay = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(product.harga_jual || 0);
    const scriptTag = '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js">' + '</script>';
    const barcodeScript = '<script>JsBarcode("#barcode", "' + product.kode_produk + '", { format: "CODE128", height: 50, displayValue: true, fontSize: 12, margin: 5 });' + '</script>';
    return `<!DOCTYPE html><html><head><style>@media print { body { margin: 0; padding: 10mm; } .label { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 80mm; height: 60mm; border: 1px solid #ccc; padding: 4mm; box-sizing: border-box; page-break-inside: avoid; font-family: Arial; text-align: center; } .label-name { font-size: 10px; font-weight: bold; margin-bottom: 2mm; max-height: 12mm; overflow: hidden; } .label-code { font-size: 9px; margin-top: 1mm; } .label-price { font-size: 8px; font-weight: bold; margin-top: 1mm; } svg { max-width: 100%; max-height: 50px; } }</style></head><body><div class="label"><div class="label-name">${product.nama_produk}</div><svg id="barcode" style="width: 100%; height: 50px; margin: 1mm 0;"></svg><div class="label-code">${product.kode_produk}</div><div class="label-price">${priceDisplay}</div></div>${scriptTag}${barcodeScript}</body></html>`;
  };

  useEffect(() => {
    setIsBarcodePrintModalOpen(false);
    setProductsToPrint([]);
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategoriesAndUnits();
  }, [fetchCategoriesAndUnits]);

  useEffect(() => {
    const handleResetState = () => {
      setIsBarcodePrintModalOpen(false);
      setProductsToPrint([]);
    };
    window.addEventListener('resetProductsPageState', handleResetState);
    return () => window.removeEventListener('resetProductsPageState', handleResetState);
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, allProducts]);

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Produk');
      worksheet.columns = [
        { header: 'Kode Produk', key: 'kode_produk', width: 15 },
        { header: 'Nama Produk', key: 'nama_produk', width: 30 },
        { header: 'Merek', key: 'merek', width: 20 },
        { header: 'Harga Beli', key: 'harga_beli', width: 15 },
        { header: 'Harga Jual', key: 'harga_jual', width: 15 },
        { header: 'Harga Grosir', key: 'harga_grosir', width: 15 },
        { header: 'Min Qty Grosir', key: 'min_qty_grosir', width: 15 },
        { header: 'ID Supplier', key: 'id_supplier', width: 15 },
        { header: 'Stok Minimum', key: 'stok_minimum', width: 15 },
        { header: 'ID Kategori', key: 'id_kategori', width: 15 },
        { header: 'ID Satuan', key: 'id_satuan', width: 15 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Path Gambar', key: 'gambar', width: 30 },
      ];
      allProducts.forEach(product => {
        worksheet.addRow({
          kode_produk: product.kode_produk,
          nama_produk: product.nama_produk,
          merek: product.merek || '',
          harga_beli: product.harga_beli,
          harga_jual: product.harga_jual,
          harga_grosir: product.harga_grosir || 0,
          min_qty_grosir: product.min_qty_grosir || 0,
          id_supplier: product.id_supplier || '',
          stok_minimum: product.stok_minimum,
          id_kategori: product.id_kategori,
          id_satuan: product.id_satuan,
          status: product.status,
          gambar: product.gambar || '',
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'produk.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      handleError(exportError);
      showError('Gagal export Excel');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Template Produk');
      worksheet.columns = [
        { header: 'Kode Produk', key: 'kode_produk', width: 15 },
        { header: 'Nama Produk', key: 'nama_produk', width: 30 },
        { header: 'Merek', key: 'merek', width: 20 },
        { header: 'Harga Beli', key: 'harga_beli', width: 15 },
        { header: 'Harga Jual', key: 'harga_jual', width: 15 },
        { header: 'Harga Grosir', key: 'harga_grosir', width: 15 },
        { header: 'Min Qty Grosir', key: 'min_qty_grosir', width: 15 },
        { header: 'ID Supplier', key: 'id_supplier', width: 15 },
        { header: 'Stok Minimum', key: 'stok_minimum', width: 15 },
        { header: 'ID Kategori', key: 'id_kategori', width: 15 },
        { header: 'ID Satuan', key: 'id_satuan', width: 15 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Path Gambar', key: 'gambar', width: 30 },
      ];
      worksheet.addRow({
        kode_produk: 'PRD001',
        nama_produk: 'Contoh Produk',
        merek: 'Contoh Merek',
        harga_beli: 10000,
        harga_jual: 15000,
        harga_grosir: 12000,
        min_qty_grosir: 10,
        id_supplier: 1,
        stok_minimum: 5,
        id_kategori: 1,
        id_satuan: 1,
        status: 'aktif',
        gambar: 'uploads/produk/prd001.jpg',
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_produk.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      handleError(downloadError);
      showError('Gagal download template');
    }
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.getWorksheet(1);

      const importedProducts = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const getCellString = (colIndex) => {
          const val = row.getCell(colIndex).value;
          if (val && typeof val === 'object' && 'result' in val) {
            return val.result != null ? val.result.toString().trim() : '';
          }
          return val != null ? val.toString().trim() : '';
        };

        const getCellFloat = (colIndex) => {
          const val = row.getCell(colIndex).value;
          if (val && typeof val === 'object' && 'result' in val) {
            const parsed = parseFloat(val.result);
            return isNaN(parsed) ? 0 : parsed;
          }
          const parsed = parseFloat(val);
          return isNaN(parsed) ? 0 : parsed;
        };

        const getCellInt = (colIndex) => {
          const val = row.getCell(colIndex).value;
          if (val && typeof val === 'object' && 'result' in val) {
            const parsed = parseInt(val.result, 10);
            return isNaN(parsed) ? 0 : parsed;
          }
          const parsed = parseInt(val, 10);
          return isNaN(parsed) ? 0 : parsed;
        };

        const product = {
          kode_produk: getCellString(1),
          nama_produk: getCellString(2),
          merek: getCellString(3),
          harga_beli: getCellFloat(4),
          harga_jual: getCellFloat(5),
          harga_grosir: getCellFloat(6),
          min_qty_grosir: getCellInt(7),
          id_supplier: getCellInt(8) || null,
          stok_minimum: getCellInt(9),
          id_kategori: getCellInt(10) || null,
          id_satuan: getCellInt(11) || null,
          status: getCellString(12) || 'aktif',
          gambar: getCellString(13) || null,
        };

        if (product.kode_produk && product.nama_produk) {
          importedProducts.push(product);
        }
      });

      if (importedProducts.length === 0) {
        showWarning('Tidak ada data produk yang valid di file Excel');
        setLoading(false);
        return;
      }

      setExcelDataToImport(importedProducts);
      setShowImportOptionsModal(true);
    } catch (error) {
      handleError(error);
      showError('Gagal memproses file Excel. Pastikan file format benar');
    } finally {
      setLoading(false);
      event.target.value = ''; // Reset input
    }
  };

  const processBulkImport = async (products, options) => {
    setShowImportOptionsModal(false);
    setImportProgress({ active: true, current: 0, total: products.length, successCount: 0, failCount: 0 });

    const chunkSize = 500; // Optimal client-side chunk size
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      try {
        const response = await bulkImportProducts(chunk, {
          ignoreDuplicates: options.ignoreDuplicates,
          updateDuplicates: options.updateDuplicates
        });
        
        if (response.data?.success) {
          // stats contains info about chunks processed
          successCount += response.data.stats?.totalProcessed || chunk.length;
        } else {
          failCount += chunk.length;
        }
      } catch (err) {
        failCount += chunk.length;
      }
      
      setImportProgress(prev => ({
        ...prev,
        current: Math.min(i + chunkSize, products.length),
        successCount,
        failCount
      }));
      
      // Delay to avoid UI blocking and allow progress rendering
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    await fetchProducts();
    showSuccess(`Import selesai! Berhasil: ${successCount}, Gagal: ${failCount}`);
    
    setTimeout(() => {
      setImportProgress(prev => ({ ...prev, active: false }));
      setExcelDataToImport(null);
    }, 5000);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Massal Produk',
      message: `Apakah Anda yakin ingin menghapus ${selectedIds.length} produk terpilih?`,
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setIsDeletingBulk(true);
          const response = await bulkDeleteProducts(selectedIds);
          if (response.data?.success) {
            showSuccess(`Berhasil menghapus ${selectedIds.length} produk`);
            setSelectedIds([]);
            fetchProducts();
          } else {
            showError(`Gagal menghapus produk: ${response.data?.message || 'Unknown error'}`);
          }
        } catch (err) {
          handleError(err);
          showError('Gagal melakukan hapus massal');
        } finally {
          setIsDeletingBulk(false);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDelete = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Produk',
      message: 'Apakah Anda yakin ingin menghapus produk ini?',
      confirmText: 'Ya, Hapus',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteProduct(id);
          setAllProducts(allProducts.filter(p => p.id_produk !== id));
        } catch (_err) {
          setError('Gagal menghapus produk.');
          showError('Gagal menghapus produk');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (loading) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  if (error) {
    return <div className="text-center mt-10 text-red-500">{error}</div>;
  }

  return (
    <PageLayout>
      <PageHeader
        title="Manajemen Produk"
        actions={
          <div className="flex gap-2">
            {selectedIds.length > 0 && hasPermission('MANAGE_PRODUCTS') && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isDeletingBulk}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded shadow transition"
              >
                <Trash2 className="h-4 w-4" />
                Hapus ({selectedIds.length})
              </button>
            )}
            {hasPermission('MANAGE_PRODUCTS') && (
              <HeaderActionButton
                icon={Plus}
                label="Tambah"
                variant="slate"
                to="/produk/tambah"
                isLink
                hideLabel={true}
              />
            )}
            <HeaderActionButton
              icon={Download}
              label="Export"
              variant="emerald"
              onClick={handleExportExcel}
              hideLabel={true}
            />
            <HeaderActionButton
              icon={Upload}
              label="Import"
              variant="yellow"
              onClick={() => document.getElementById('import-excel').click()}
              hideLabel={true}
            />
            <HeaderActionButton
              icon={FileText}
              label="Template"
              variant="gray"
              onClick={handleDownloadTemplate}
              hideLabel={true}
            />
            <HeaderActionButton
              icon={Info}
              label="Info"
              variant="indigo"
              onClick={() => setShowCategoryInfoModal(true)}
              hideLabel={true}
            />
          </div>
        }
      />

      <PageContainer>
        <input
          type="file"
          id="import-excel"
          accept=".xlsx,.xls"
          onChange={handleImportExcel}
          style={{ display: 'none' }}
        />

        {importProgress.active && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-amber-900">Mengimpor Data Produk...</span>
              <span className="text-xs text-amber-700 font-semibold">
                {importProgress.current} / {importProgress.total} ({Math.round((importProgress.current / importProgress.total) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-amber-200 rounded-full h-3">
              <div
                className="bg-amber-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-amber-700 mt-2 font-medium">
              <span>Berhasil: <span className="text-emerald-700">{importProgress.successCount}</span></span>
              <span>Gagal: <span className="text-red-700">{importProgress.failCount}</span></span>
            </div>
          </div>
        )}

        {isSyncing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900"> Syncing offline products...</span>
              <span className="text-xs text-blue-700 font-semibold">{syncProgress} / {syncedProducts || '?'} products</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3">
              <div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: syncedProducts > 0 ? `${Math.min(100, (syncProgress / syncedProducts) * 100)}%` : '0%' }} />
            </div>
            <p className="text-xs text-blue-700 mt-2">This syncs all products for full offline search capability. Can be used offline once complete.</p>
          </div>
        )}
        {!isSyncing && syncedProducts > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-800">✅ {syncedProducts.toLocaleString()} products ready for offline use</p>
          </div>
        )}

        <DataTable
          data={allProducts}
          loading={loading}
          error={error}
          showPagination={true}
          selectable={true}
          selectedRows={selectedIds}
          onSelectedRowsChange={setSelectedIds}
          serverSide={true}
          totalItems={totalItems}
          currentPage={page}
          onPageChange={setPage}
          onItemsPerPageChange={setLimit}
          onSearchChange={setSearchQuery}
          onFilterValueChange={(values) => { setFilterValues(values); setPage(1); }}
          columns={[
            {
              key: 'gambar',
              header: 'Gambar',
              render: (product) => (
                <div className="relative inline-block">
                  <ProductThumb
                    gambarPath={product.gambar}
                    altText={product.nama_produk}
                    onClick={() => {
                      const imageUrl = resolveUrl(product.gambar);
                      if (imageUrl) {
                        setModalImage(imageUrl);
                        setModalAlt(product.nama_produk);
                      }
                    }}
                  />
                  {product.gambar && (
                    <button
                      type="button"
                      disabled={removingImageIds.includes(product.id_produk)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Hapus Gambar Produk',
                          message: 'Hapus gambar produk ini?',
                          confirmText: 'Ya, Hapus',
                          variant: 'danger',
                          onConfirm: async () => {
                            try {
                              setRemovingImageIds(prev => [...prev, product.id_produk]);
                              const formData = new FormData();
                              formData.append('remove_gambar', '1');
                              await updateProduct(product.id_produk, formData);
                              setAllProducts(prev => prev.map(p => p.id_produk === product.id_produk ? { ...p, gambar: null } : p));
                            } catch (__err) {
                              showError('Gagal menghapus gambar');
                            } finally {
                              setRemovingImageIds(prev => prev.filter(id => id !== product.id_produk));
                              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                            }
                          }
                        });
                      }}
                      className="absolute -top-1 -right-1 bg-white border rounded-full p-1 text-xs text-red-600 hover:bg-red-50"
                      title="Hapus gambar"
                    >
                      {removingImageIds.includes(product.id_produk) ? '' : ''}
                    </button>
                  )}
                </div>
              )
            },
            {
              key: 'kode_produk',
              header: 'Kode Produk',
              render: (product) => product.kode_produk
            },
            {
              key: 'nama_produk',
              header: 'Nama Produk',
              render: (product) => product.nama_produk
            },
            {
              key: 'kategori',
              header: 'Kategori',
              render: (product) => (
                <button
                  onClick={() => handleEditCategory(product)}
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                  title="Klik untuk edit kategori"
                >
                  {product.Kategori?.nama_kategori || categories.find(cat => cat.id_kategori === product.id_kategori)?.nama_kategori || 'N/A'}
                </button>
              )
            },
            {
              key: 'merek',
              header: 'Merek',
              render: (product) => product.merek || '-'
            },
            {
              key: 'barcode',
              header: 'Barcode',
              render: (product) => (
                <button
                  onClick={async () => {
                    const barcodeUrl = await generateBarcodeDataUrl(product.kode_produk);
                    const previewWindow = window.open('', '_blank', 'width=400,height=300');
                    if (previewWindow) {
                      previewWindow.document.write(`<html><head><title>Barcode: ${product.nama_produk}</title><style>body { font-family: Arial, sans-serif; text-align: center; padding: 20px; } img { max-width: 100%; height: auto; } .info { margin: 20px 0; }</style></head><body><h2>${product.nama_produk}</h2><div class="info"><p><strong>Kode:</strong> ${product.kode_produk}</p><p><strong>Harga:</strong> ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(product.harga_jual)}</p></div><img src="${barcodeUrl}" alt="Barcode ${product.kode_produk}" /><br><br><button onclick="window.print()">Cetak</button><button onclick="window.close()">Tutup</button></body></html>`);
                      previewWindow.document.close();
                    }
                  }}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Lihat
                </button>
              )
            },
            {
              key: 'harga_jual',
              header: 'Harga Jual',
              render: (product) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(product.harga_jual)
            }
          ]}
          actions={[
            {
              icon: Edit,
              title: 'Edit',
              onClick: (product) => {
                // Navigate to edit page
                navigate(`/produk/edit/${product.id_produk}`);
              },
              variant: 'primary',
              size: 'sm',
              disabled: (_product) => !hasPermission('MANAGE_PRODUCTS')
            },
            {
              icon: Printer,
              title: 'Cetak',
              onClick: (product) => {
                const printWindow = window.open('', '_blank');
                const html = generatePrintHtml(product);
                printWindow.document.write(html);
                printWindow.document.close();
                setTimeout(() => printWindow.print(), 250);
              },
              variant: 'success',
              size: 'sm'
            },
            {
              icon: Trash2,
              title: 'Hapus',
              onClick: (product) => handleDelete(product.id_produk),
              variant: 'danger',
              size: 'sm',
              disabled: (_product) => !hasPermission('MANAGE_PRODUCTS')
            }
          ]}
          filters={[
            {
              key: 'id_kategori',
              label: 'Kategori',
              type: 'select',
              options: [
                { value: '', label: 'Semua Kategori' },
                ...categories.map(cat => ({
                  value: cat.id_kategori,
                  label: `${cat.nama_kategori}${cat.deskripsi ? ` - ${cat.deskripsi}` : ''}`
                }))
              ]
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { value: 'all', label: 'Semua Status' },
                { value: 'aktif', label: 'Aktif' },
                { value: 'nonaktif', label: 'Nonaktif' }
              ]
            }
          ]}
          searchPlaceholder="Cari produk berdasarkan nama, kode, merek, atau deskripsi..."
          emptyMessage="Belum ada produk yang ditambahkan."
          loadingMessage="Memuat produk..."
        />

        {!hasPermission('MANAGE_PRODUCTS') && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Catatan:</strong> Hanya Admin dan Owner yang dapat menghapus produk.
            </p>
          </div>
        )}
      </PageContainer>

      <FileViewerModal
        isOpen={!!modalImage}
        onClose={() => setModalImage(null)}
        fileUrl={modalImage}
        fileName={modalAlt || 'Pratinjau Gambar'}
      />
      {isBarcodePrintModalOpen && (<UniversalPrintModal isOpen={isBarcodePrintModalOpen} onClose={() => { setIsBarcodePrintModalOpen(false); setProductsToPrint([]); }} printType={PRINT_TYPES.BARCODE_LABELS} data={productsToPrint} storeInfo={storeInfo} />)}
      {editingCategory && (<EditCategoryModal product={editingCategory} categories={categories} selectedCategoryId={selectedCategoryId} setSelectedCategoryId={setSelectedCategoryId} onClose={handleCloseEditCategory} onSave={handleSaveCategory} />)}
      <CategoryInfoModal isOpen={showCategoryInfoModal} onClose={() => setShowCategoryInfoModal(false)} />
      {showImportOptionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Pengaturan Impor Excel</h2>
            <p className="text-sm text-slate-500 mb-4">
              File Excel memiliki <strong className="text-slate-800">{excelDataToImport?.length}</strong> baris produk yang valid.
            </p>
            
            <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="importOption"
                  checked={importOptions.ignoreDuplicates}
                  onChange={() => setImportOptions({ ignoreDuplicates: true, updateDuplicates: false })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Abaikan duplikat</span>
                  <p className="text-xs text-slate-500">Lewati baris jika kode produk sudah ada di database.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer pt-3 border-t border-slate-200">
                <input
                  type="radio"
                  name="importOption"
                  checked={importOptions.updateDuplicates}
                  onChange={() => setImportOptions({ ignoreDuplicates: false, updateDuplicates: true })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <span className="text-sm font-medium text-slate-800">Perbarui duplikat</span>
                  <p className="text-xs text-slate-500">Perbarui data produk di database jika kode produk cocok.</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowImportOptionsModal(false); setExcelDataToImport(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => processBulkImport(excelDataToImport, importOptions)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition"
              >
                Mulai Impor
              </button>
            </div>
          </div>
        </div>
      )}

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
        </PageLayout>
      );
    };

const EditCategoryModal = ({ product, categories, selectedCategoryId, setSelectedCategoryId, onClose, onSave }) => {
  return (<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"><div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md"><h2 className="text-2xl font-bold mb-4">Edit Kategori Produk</h2><p className="mb-2"><strong>Produk:</strong> {product.nama_produk}</p><p className="mb-4"><strong>Kode:</strong> {product.kode_produk}</p><div className="mb-4"><label className="block font-medium mb-2">Kategori</label><select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className="w-full p-2 border rounded"><option value="">Pilih Kategori</option>{categories.map(cat => (<option key={cat.id_kategori} value={cat.id_kategori}>{cat.nama_kategori}</option>))}</select></div><div className="flex justify-end gap-4"><button type="button" onClick={onClose} className="bg-gray-300 px-4 py-2 rounded">Batal</button><button type="button" onClick={onSave} className="bg-blue-500 text-white px-4 py-2 rounded">Simpan</button></div></div></div>);
};

const ProductThumb = ({ gambarPath, altText, onClick }) => {
  const [imageError, setImageError] = useState(false);
  if (!gambarPath || imageError) {
    return (<button type="button" onClick={onClick} className="p-0 m-0 border-0 bg-transparent cursor-pointer"><div className="h-12 w-12 flex items-center justify-center bg-gray-100 border rounded text-xs text-gray-500">N/A</div></button>);
  }
  const src = resolveUrl(gambarPath);
  return (<button type="button" onClick={onClick} className="p-0 m-0 border-0 bg-transparent cursor-pointer"><img src={src} alt={altText || 'product'} className="h-12 w-12 object-cover rounded" onError={() => setImageError(true)} /></button>);
};

const ProductsPageWithErrorBoundary = withErrorBoundary(ProductsPage, 'ProductsPage');

export default ProductsPageWithErrorBoundary;
