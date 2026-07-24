import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProductById, updateProduct, getCategories, getUnits, getSuppliers } from '../services/api';
import { resolveUrl } from '../utils/resolveUrl';
import { generateBarcodeDataUrl } from '../utils/barcodeHelper';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import SearchableSelect from '../components/SearchableSelect';
import { ArrowLeft, Save, X } from 'lucide-react';
import ImageUploader from '../components/ImageUploader';
import { useNotifications } from '../hooks/useNotifications';
import { formatRupiahNumber, parseRupiahNumber } from '../utils/numberFormat';

const EditProductPage = () => {
  const { success: showSuccess, error: showError } = useNotifications();
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [product, setProduct] = useState({
    kode_produk: '',
    nama_produk: '',
    merek: '',
    harga_jual: 0,
    harga_beli: 0,
    harga_grosir: 0,
    min_qty_grosir: 0,
    id_supplier: '',
    id_kategori: '',
    id_satuan: '',
    stok_minimum: 0,
    status: 'aktif',
    gambar: null,
    barcode: '',
    lokasi_rak: '',
  });
  const [gambar, setGambar] = useState(null);
  const [removeGambar, setRemoveGambar] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let prod = null;

        // First try to get product from API (prioritize fresh data)
        try {
          const productRes = await getProductById(id);
          prod = productRes.data.data || {};
        } catch (_apiError) {
          if (import.meta.env.DEV) console.warn('getProductById failed:', _apiError);
        }

        // If API failed, try local database as fallback
        if (!prod) {
          if (window.electronAPI?.dbSelect) {
            try {
              const localProducts = await window.electronAPI.dbSelect({
                table: 'products',
                whereClause: 'id_produk = ?',
                whereValues: [parseInt(id)]
              });
              if (localProducts && localProducts.length > 0) {
                prod = localProducts[0];
              }
            } catch (_localError) {
              if (import.meta.env.DEV) console.warn('localProducts fetch failed:', _localError);
            }
          }
        }

        // If still no product data, show error
        if (!prod) {
          setError('Produk tidak ditemukan');
          setLoading(false);
          return;
        }

        // Get categories, units, and suppliers from API (these are usually small datasets)
        const [catRes, unitRes, supplierRes] = await Promise.all([
          getCategories(),
          getUnits(),
          getSuppliers()
        ]);

        const categoriesData = catRes.data.data || [];
        const unitsData = unitRes.data.data || [];
        const suppliersData = supplierRes.data.data || [];

        // Ensure all fields have proper default values to prevent controlled/uncontrolled input issues
        const sanitizedProduct = {
          kode_produk: prod.kode_produk || '',
          nama_produk: prod.nama_produk || '',
          merek: prod.merek || '',
          harga_jual: prod.harga_jual ? parseFloat(prod.harga_jual) || 0 : 0,
          harga_beli: prod.harga_beli ? parseFloat(prod.harga_beli) || 0 : 0,
          harga_grosir: prod.harga_grosir ? parseFloat(prod.harga_grosir) || 0 : 0,
          min_qty_grosir: prod.min_qty_grosir ? parseInt(prod.min_qty_grosir) || 0 : 0,
          id_supplier: prod.id_supplier != null && prod.id_supplier !== undefined ? String(prod.id_supplier) : '',
          id_kategori: prod.id_kategori != null && prod.id_kategori !== undefined ? String(prod.id_kategori) : '',
          id_satuan: prod.id_satuan != null && prod.id_satuan !== undefined ? String(prod.id_satuan) : '',
          stok_minimum: prod.stok_minimum ? parseInt(prod.stok_minimum) || 0 : 0,
          status: prod.status || 'aktif',
          gambar: prod.gambar || null,
          barcode: prod.barcode || '',
          lokasi_rak: prod.lokasi_rak || '',
        };
        
        // Validate that id_kategori, id_satuan, and id_supplier exist in available options
        const availableCategoryIds = categoriesData.map(cat => String(cat.id_kategori));
        const availableUnitIds = unitsData.map(unit => String(unit.id_satuan));
        const availableSupplierIds = suppliersData.map(supplier => String(supplier.id_supplier));
        
        if (sanitizedProduct.id_kategori && !availableCategoryIds.includes(sanitizedProduct.id_kategori)) {
          console.warn(`Product has invalid id_kategori: ${sanitizedProduct.id_kategori}. Resetting to empty.`);
          sanitizedProduct.id_kategori = '';
        }
        
        if (sanitizedProduct.id_satuan && !availableUnitIds.includes(sanitizedProduct.id_satuan)) {
          console.warn(`Product has invalid id_satuan: ${sanitizedProduct.id_satuan}. Resetting to empty.`);
          sanitizedProduct.id_satuan = '';
        }

        if (sanitizedProduct.id_supplier && !availableSupplierIds.includes(sanitizedProduct.id_supplier)) {
          console.warn(`Product has invalid id_supplier: ${sanitizedProduct.id_supplier}. Resetting to empty.`);
          sanitizedProduct.id_supplier = '';
        }
        
        setProduct(sanitizedProduct);
        
        setCategories(categoriesData);
        setUnits(unitsData);
        setSuppliers(suppliersData);
        
        // Set image preview if product has existing image
        if (sanitizedProduct.gambar) {
          setGambar(resolveUrl(sanitizedProduct.gambar));
        } else {
          setGambar(null);
        }
        setRemoveGambar(false);
        
        setLoading(false);
      } catch (err) {
        setError("Gagal memuat data produk.");
        console.error("Failed to fetch product data:", err);
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let parsedValue;

    if (['harga_jual', 'harga_beli', 'harga_grosir'].includes(name)) {
      parsedValue = value === '' ? 0 : parseRupiahNumber(value);
    } else if (['stok_minimum', 'min_qty_grosir'].includes(name)) {
      parsedValue = value === '' ? 0 : parseInt(value, 10) || 0;
    } else if (['id_kategori', 'id_satuan', 'id_supplier'].includes(name)) {
      const num = parseInt(value, 10);
      parsedValue = isNaN(num) ? '' : String(num);
    } else {
      parsedValue = value;
    }

    setProduct(prev => ({ ...prev, [name]: parsedValue }));
    
    // Update barcode preview if kode_produk changed
    if (name === 'kode_produk' && value) {
      generateBarcodeDataUrl(value).then(setBarcodePreview);
    }
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    
    try {
      // Validate required fields
      if (!product.id_kategori || product.id_kategori === '') {
        showError('Kategori produk harus dipilih.');
        setIsSubmitting(false);
        return;
      }
      
      if (!product.id_satuan || product.id_satuan === '') {
        showError('Satuan produk harus dipilih.');
        setIsSubmitting(false);
        return;
      }
      
      // Validate that selected category and unit exist
      if (product.id_kategori && !categories.find(cat => String(cat.id_kategori) === String(product.id_kategori))) {
        showError('Kategori yang dipilih tidak valid. Silakan pilih kategori yang tersedia.');
        setIsSubmitting(false);
        return;
      }
      
      if (product.id_satuan && !units.find(unit => String(unit.id_satuan) === String(product.id_satuan))) {
        showError('Satuan yang dipilih tidak valid. Silakan pilih satuan yang tersedia.');
        setIsSubmitting(false);
        return;
      }
      
      // Always use FormData for product updates as required by API
      const formData = new FormData();
      formData.append('kode_produk', product.kode_produk);
      formData.append('nama_produk', product.nama_produk);
      formData.append('merek', product.merek || '');
      formData.append('harga_jual', product.harga_jual);
      formData.append('harga_beli', product.harga_beli || 0);
      formData.append('harga_grosir', product.harga_grosir || 0);
      formData.append('min_qty_grosir', product.min_qty_grosir || 0);
      formData.append('stok_minimum', product.stok_minimum || 0);
      formData.append('status', product.status);
      
      // Only append foreign keys if they have valid values
      if (product.id_kategori && product.id_kategori !== '') {
        formData.append('id_kategori', product.id_kategori);
      }
      if (product.id_satuan && product.id_satuan !== '') {
        formData.append('id_satuan', product.id_satuan);
      }
      if (product.id_supplier && product.id_supplier !== '') {
        formData.append('id_supplier', product.id_supplier);
      }
      
      if (gambar instanceof File) {
        formData.append('gambar', gambar);
      }
      if (removeGambar && !(gambar instanceof File)) {
        // Inform backend to remove existing image
        formData.append('remove_gambar', '1');
      }
      
      await updateProduct(id, formData);
      showSuccess('Produk berhasil diperbarui!');
      setTimeout(() => navigate('/produk'), 1500);
    } catch (err) {
      const message = err.response?.data?.message || 'Gagal memperbarui produk.';
      showError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="text-center mt-10 text-gray-600">Loading data produk...</div>;

  return (
    <PageLayout>
      {/* Page Header */}
      <PageHeader
        title="Edit Produk"
        subtitle="Perbarui informasi produk"
        actions={
          <div className="flex gap-2">
            <Link
              to="/produk"
              className="inline-flex items-center justify-center rounded-full bg-slate-500 text-white text-xs sm:text-sm font-semibold px-3 py-2 hover:bg-slate-600 transition"
              title="Kembali ke daftar produk"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Kembali</span>
            </Link>
          </div>
        }
      />

      {/* Content Container */}
      <PageContainer>
        {/* Form */}
        <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-6">
          {/* Basic Information Section */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Dasar</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Kode Produk *</label>
                <input
                  type="text"
                  name="kode_produk"
                  value={product.kode_produk}
                  onChange={handleChange}
                  required
                  className="input w-full"
                />
                {barcodePreview && (
                  <div className="mt-3 p-2 border border-gray-200 rounded bg-gray-50">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Barcode:</p>
                    <img src={barcodePreview} alt="Barcode Preview" className="max-w-full max-h-16" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Nama Produk *</label>
                <input
                  type="text"
                  name="nama_produk"
                  value={product.nama_produk}
                  onChange={handleChange}
                  required
                  className="input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Merek</label>
              <input
                type="text"
                name="merek"
                value={product.merek}
                onChange={handleChange}
                className="input w-full"
              />
            </div>
          </div>

          {/* Classification Section */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Klasifikasi</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Kategori *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Pilih Kategori' },
                    ...categories.map(cat => ({
                      value: String(cat.id_kategori),
                      label: cat.nama_kategori
                    }))
                  ]}
                  value={product.id_kategori}
                  onChange={handleChange}
                  name="id_kategori"
                  placeholder="Pilih Kategori"
                  searchPlaceholder="Cari kategori..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Satuan *</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Pilih Satuan' },
                    ...units.map(unit => ({
                      value: String(unit.id_satuan),
                      label: unit.nama_satuan
                    }))
                  ]}
                  value={product.id_satuan}
                  onChange={handleChange}
                  name="id_satuan"
                  placeholder="Pilih Satuan"
                  searchPlaceholder="Cari satuan..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Supplier</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Tidak ada supplier' },
                  ...suppliers.map(supplier => ({
                    value: String(supplier.id_supplier),
                    label: supplier.nama_supplier
                  }))
                ]}
                value={product.id_supplier}
                onChange={handleChange}
                name="id_supplier"
                placeholder="Pilih Supplier"
                searchPlaceholder="Cari supplier..."
              />
              <p className="text-xs text-gray-500 mt-1">(Opsional) Pilih supplier untuk produk ini.</p>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Harga</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Harga Jual *</label>
                <input
                  type="text"
                  name="harga_jual"
                  value={formatRupiahNumber(product.harga_jual)}
                  onChange={handleChange}
                  required
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Harga Beli *</label>
                <input
                  type="text"
                  name="harga_beli"
                  value={formatRupiahNumber(product.harga_beli)}
                  onChange={handleChange}
                  required
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Harga Grosir</label>
                <input
                  type="text"
                  name="harga_grosir"
                  value={formatRupiahNumber(product.harga_grosir)}
                  onChange={handleChange}
                  className="input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Minimum Qty Grosir</label>
              <input
                type="number"
                name="min_qty_grosir"
                value={product.min_qty_grosir}
                onChange={handleChange}
                className="input w-full"
              />
              <p className="text-xs text-gray-500 mt-1">(Opsional) Jumlah minimum untuk harga grosir.</p>
            </div>
          </div>

          {/* Inventory Section */}
          <div className="pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventori</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Stok Minimum *</label>
                <input
                  type="number"
                  name="stok_minimum"
                  value={product.stok_minimum}
                  onChange={handleChange}
                  required
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Status</label>
                <SearchableSelect
                  options={[
                    { value: 'aktif', label: 'Aktif' },
                    { value: 'nonaktif', label: 'Nonaktif' }
                  ]}
                  value={product.status}
                  onChange={handleChange}
                  name="status"
                  placeholder="Pilih Status"
                  searchPlaceholder="Cari status..."
                />
              </div>
            </div>
          </div>

          {/* Image Section */}
          <div className="pt-6 border-t">
            <ImageUploader
              value={gambar}
              onChange={(fileOrUrl) => {
                setGambar(fileOrUrl);
                if (fileOrUrl === null) {
                  setRemoveGambar(true);
                } else if (fileOrUrl instanceof File) {
                  setRemoveGambar(false);
                }
              }}
              label="Gambar Produk"
              maxSizeMB={5}
              compressQuality={0.75}
            />
          </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <Link
            to="/produk"
            className="inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 text-xs sm:text-sm font-semibold px-6 py-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
            title="Batal dan kembali ke daftar produk"
          >
            <X className="w-4 h-4 mr-2" />
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500 text-white text-xs sm:text-sm font-semibold px-6 py-2 hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:bg-gray-400 transition"
            title="Simpan perubahan produk"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
      </PageContainer>
    </PageLayout>
  );
};

export default EditProductPage;