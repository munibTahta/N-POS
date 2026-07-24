import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Camera, Image as ImageIcon, Save, ChevronLeft, Info } from 'lucide-react';
import HeaderActionButton from '../components/HeaderActionButton';
import SearchableSelect from '../components/SearchableSelect';
import { addProduct, getCategories, getUnits, getSuppliers, createLogAktivitas } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import CategoryInfoModal from '../components/CategoryInfoModal';
import ImageUploader from '../components/ImageUploader';

// Lazy load barcode scanner
const CameraBarcodeScanner = lazy(() => import('../components/CameraBarcodeScanner'));

const AddProductPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [product, setProduct] = useState({
    kode_produk: '',
    nama_produk: '',
    merek: '',
    harga_jual: '',
    harga_beli: '',
    harga_grosir: '',
    min_qty_grosir: 10,
    id_kategori: '',
    id_satuan: '',
    id_supplier: '',
    stok_minimum: 0,
    status: 'aktif',
  });
  const [gambar, setGambar] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showCategoryInfoModal, setShowCategoryInfoModal] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Pastikan nilai numerik disimpan dengan benar
    let parsedValue;
    if (['harga_jual', 'harga_beli', 'harga_grosir'].includes(name)) {
      // Untuk field harga, gunakan parseFloat untuk mendukung desimal
      parsedValue = value === '' ? '' : (isNaN(parseFloat(value)) ? 0 : parseFloat(value));
    } else if (['min_qty_grosir', 'stok_minimum', 'id_kategori', 'id_satuan', 'id_supplier'].includes(name)) {
      // Untuk field numerik lainnya, gunakan parseInt
      parsedValue = value === '' ? '' : (isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10));
    } else {
      parsedValue = value;
    }
    setProduct(prev => ({ ...prev, [name]: parsedValue }));
  };

  const handleBarcodeScanned = (barcode) => {
    // Isi field kode_produk dengan barcode yang di-scan
    setProduct(prev => ({ ...prev, kode_produk: barcode }));
    setShowCameraScanner(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catResponse, unitResponse, supplierResponse] = await Promise.all([
          getCategories(),
          getUnits(),
          getSuppliers()
        ]);
        setCategories(catResponse.data.data || []);
        setUnits(unitResponse.data.data || []);
        setSuppliers(supplierResponse.data.data || []);
      } catch (err) {
        toast.error("Gagal memuat data master untuk form.");
        console.error("Error fetching master data:", err); // Log error untuk debugging
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Buat FormData untuk support file upload
      const formData = new FormData();
      formData.append('kode_produk', product.kode_produk);
      formData.append('nama_produk', product.nama_produk);
      formData.append('merek', product.merek);
      formData.append('harga_jual', product.harga_jual);
      formData.append('harga_beli', product.harga_beli);
      formData.append('harga_grosir', product.harga_grosir || 0);
      formData.append('min_qty_grosir', product.min_qty_grosir || 0);
      formData.append('id_kategori', product.id_kategori);
      formData.append('id_satuan', product.id_satuan);
      formData.append('id_supplier', product.id_supplier || '');
      formData.append('stok_minimum', product.stok_minimum);
      formData.append('status', product.status);
      
      if (gambar) {
        formData.append('gambar', gambar);
      }

      await addProduct(formData);
      
      // Log audit trail untuk pembuatan produk
      try {
        await createLogAktivitas({
          aktivitas: `Tambah produk: ${product.kode_produk} - ${product.nama_produk} - Harga: Rp${product.harga_jual?.toLocaleString('id-ID') || 'N/A'}`
        });
      } catch (auditError) {
        console.warn('Failed to log product creation audit:', auditError);
      }
      
      toast.success('Produk berhasil ditambahkan!', { autoClose: 3000 });
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('resetProductsPageState'));
        navigate('/produk');
      }, 1500);
    } catch (err) {
      let errorMessage = "Gagal menambahkan produk. Terjadi kesalahan pada server.";
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      } else if (err.request) {
        errorMessage = "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Tambah Produk Baru"
          subtitle="Tambahkan produk baru ke katalog"
          actions={
            <>
              <HeaderActionButton
                icon={Info}
                label="Info Kategori"
                variant="indigo"
                onClick={() => setShowCategoryInfoModal(true)}
                hideLabel={true}
                title="Info Kategori Produk"
              />
              <HeaderActionButton
                icon={ChevronLeft}
                label="Kembali"
                variant="secondary"
                to="/produk"
                isLink
                hideLabel={true}
                title="Kembali ke Manajemen Produk"
              />
            </>
          }
        />

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
            {/* Row 1: Identitas Produk */}
            <div>
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kode Produk *</label>
                  <input 
                    type="text" 
                    name="kode_produk" 
                    value={product.kode_produk} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-xs sm:text-sm font-semibold px-3 py-2 hover:bg-blue-700 transition"
                    title="Scan barcode dari kamera"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2">Scan</span>
                  </button>
                </div>
              </div>

              {showCameraScanner && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">Scan Barcode Produk</h3>
                      <button 
                        onClick={() => setShowCameraScanner(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                    <Suspense fallback={<div className="p-4 text-center">Memuat scanner...</div>}>
                      <CameraBarcodeScanner 
                        onScan={handleBarcodeScanned}
                        onClose={() => setShowCameraScanner(false)}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nama Produk *</label>
                  <input 
                    type="text" 
                    name="nama_produk" 
                    value={product.nama_produk} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Merek</label>
                  <input 
                    type="text" 
                    name="merek" 
                    value={product.merek} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Kategori, Satuan, Supplier */}
            <div className="pt-6 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Kategori *</label>
                  <SearchableSelect
                    name="id_kategori"
                    value={product.id_kategori}
                    onChange={handleChange}
                    placeholder="Pilih Kategori"
                    searchPlaceholder="Cari kategori..."
                    options={categories.map(cat => ({
                      label: `${cat.nama_kategori}${cat.deskripsi ? ` - ${cat.deskripsi}` : ''}`,
                      value: cat.id_kategori
                    }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Satuan *</label>
                  <SearchableSelect
                    name="id_satuan"
                    value={product.id_satuan}
                    onChange={handleChange}
                    placeholder="Pilih Satuan"
                    searchPlaceholder="Cari satuan..."
                    options={units.map(unit => ({
                      label: unit.nama_satuan,
                      value: unit.id_satuan
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier</label>
                  <SearchableSelect
                    name="id_supplier"
                    value={product.id_supplier}
                    onChange={handleChange}
                    placeholder="Tidak ada supplier"
                    searchPlaceholder="Cari supplier..."
                    options={suppliers.map(supplier => ({
                      label: supplier.nama_supplier,
                      value: supplier.id_supplier
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Harga & Stok */}
            <div className="pt-6 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Harga Jual (Rp) *</label>
                  <input 
                    type="number" 
                    name="harga_jual" 
                    value={product.harga_jual} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Harga Beli (Rp) *</label>
                  <input 
                    type="number" 
                    name="harga_beli" 
                    value={product.harga_beli} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Harga Grosir (Rp)</label>
                  <input 
                    type="number" 
                    name="harga_grosir" 
                    value={product.harga_grosir} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Min Qty Grosir</label>
                  <input 
                    type="number" 
                    name="min_qty_grosir" 
                    value={product.min_qty_grosir} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Stok Minimum *</label>
                  <input 
                    type="number" 
                    name="stok_minimum" 
                    value={product.stok_minimum} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                  <select 
                    name="status" 
                    value={product.status} 
                    onChange={handleChange} 
                    className="w-full px-3 py-2 text-sm border border-gray-300 bg-white rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Row 4: Gambar Produk */}
            <div className="pt-6 border-t">
              <ImageUploader
                value={gambar}
                onChange={setGambar}
                label="Gambar Produk"
                maxSizeMB={5}
                compressQuality={0.75}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Link 
                to="/produk" 
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-full hover:bg-gray-400 transition text-sm font-semibold"
              >
                Batal
              </Link>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan Produk'}
              </button>
            </div>
          </form>
        </div>

        {/* Category Info Modal */}
        <CategoryInfoModal
          isOpen={showCategoryInfoModal}
          onClose={() => setShowCategoryInfoModal(false)}
        />
      </PageContainer>
    </PageLayout>
  );
};

export default AddProductPage;