import React, { useState, useMemo } from 'react';
import { apiClient } from '../services/api';

// Daftar endpoint berdasarkan kategori
const endpoints = {
  Authentication: [
    { method: 'POST', path: '/auth/login', description: 'Login user', body: { username: '', password: '' } },
    { method: 'GET', path: '/auth/my-settings', description: 'Get current user settings' }
  ],
  Products: [
    { method: 'GET', path: '/produk', description: 'Get products with pagination', query: { page: 1, limit: 20, search: '', status: '' } },
    { method: 'GET', path: '/produk/:id', description: 'Get product by ID', params: { id: '' } },
    { method: 'POST', path: '/produk', description: 'Create new product', body: { nama: '', sku: '', harga_beli: 0, harga_jual: 0, id_kategori: 0, stok_awal: 0, deskripsi: '' } },
    { method: 'PUT', path: '/produk/:id', description: 'Update product', params: { id: '' }, body: { nama: '', sku: '', harga_beli: 0, harga_jual: 0, id_kategori: 0, stok_awal: 0, deskripsi: '' } },
    { method: 'DELETE', path: '/produk/:id', description: 'Delete product', params: { id: '' } }
  ],
  Categories: [
    { method: 'GET', path: '/kategori', description: 'Get all categories' },
    { method: 'GET', path: '/kategori/:id', description: 'Get category by ID', params: { id: '' } },
    { method: 'POST', path: '/kategori', description: 'Create new category', body: { nama: '' } },
    { method: 'PUT', path: '/kategori/:id', description: 'Update category', params: { id: '' }, body: { nama: '' } },
    { method: 'DELETE', path: '/kategori/:id', description: 'Delete category', params: { id: '' } }
  ],
  Sales: [
    { method: 'POST', path: '/penjualan', description: 'Create new sale', body: { kode_transaksi: '', id_cabang: 0, id_user: 0, bayar: 0, id_pelanggan: null, items: [{ id_produk: 0, jumlah: 0, harga_jual: 0 }], diskon: 0, pajak: 0 } },
    { method: 'GET', path: '/penjualan', description: 'Get sales with pagination', query: { page: 1, limit: 20, search: '', status_pembayaran: '', start_date: '', end_date: '', include_voided: false } },
    { method: 'GET', path: '/penjualan/:id', description: 'Get sale by ID', params: { id: '' } },
    { method: 'POST', path: '/penjualan/:id/bayar', description: 'Record payment', params: { id: '' }, body: { id_metode_pembayaran: null, jumlah_bayar: 0, nomor_referensi: '', catatan: '' } },
    { method: 'POST', path: '/penjualan/:id/bayar/pending', description: 'Create pending payment', params: { id: '' }, body: { id_metode_pembayaran: null, jumlah_bayar: 0, nomor_referensi: '', catatan: '' } },
    { method: 'GET', path: '/penjualan/:id/pembayaran', description: 'Get payment history', params: { id: '' } },
    { method: 'POST', path: '/penjualan/:id/retur', description: 'Create return', params: { id: '' }, body: { items: [{ id_produk: 0, quantity: 0 }], alasan: '' } },
    { method: 'POST', path: '/penjualan/:id/void', description: 'Void sale with optional reversal', params: { id: '' }, body: { reason: '', create_reversal: false } }
  ],
  'Sales Extended': [
    { method: 'GET', path: '/penjualan-extended/search', description: 'Advanced sales search', query: { page: 1, limit: 20, search: '', status_pembayaran: '', start_date: '', end_date: '' } },
    { method: 'GET', path: '/penjualan-extended/stats/summary', description: 'Sales statistics summary' }
  ],
  'Payment Methods': [
    { method: 'GET', path: '/metode-pembayaran', description: 'Get all payment methods' },
    { method: 'GET', path: '/metode-pembayaran/:id', description: 'Get payment method by ID', params: { id: '' } },
    { method: 'POST', path: '/metode-pembayaran', description: 'Create payment method', body: { kode_metode: '', nama_metode: '', tipe_metode: 'tunai', aktif: true, konfigurasi: {}, is_default: false, urutan_tampil: 0, biaya_tambahan_persen: 0, biaya_tambahan_nominal: 0, minimum_transaksi: 0, maksimum_transaksi: null } },
    { method: 'PUT', path: '/metode-pembayaran/:id', description: 'Update payment method', params: { id: '' }, body: { kode_metode: '', nama_metode: '', tipe_metode: 'tunai', aktif: true, konfigurasi: {}, is_default: false, urutan_tampil: 0, biaya_tambahan_persen: 0, biaya_tambahan_nominal: 0, minimum_transaksi: 0, maksimum_transaksi: null } },
    { method: 'DELETE', path: '/metode-pembayaran/:id', description: 'Delete payment method', params: { id: '' } },
    { method: 'PUT', path: '/metode-pembayaran/:id/set-default', description: 'Set as default payment method', params: { id: '' } },
    { method: 'GET', path: '/metode-pembayaran/default', description: 'Get default payment method' }
  ],
  'Payment Extended': [
    { method: 'POST', path: '/pembayaran-extended/:id/verifikasi', description: 'Verify pending payment', params: { id: '' }, body: { status: 'selesai' } },
    { method: 'GET', path: '/pembayaran-extended/stats/summary', description: 'Payment statistics' },
    { method: 'GET', path: '/pembayaran-extended/rekon/daily', description: 'Daily reconciliation' },
    { method: 'GET', path: '/pembayaran-extended/metode/stats', description: 'Payment method statistics' }
  ],
  Payments: [
    { method: 'GET', path: '/pembayaran', description: 'Get all payments' },
    { method: 'GET', path: '/pembayaran/pending/list', description: 'Get pending payments' },
    { method: 'POST', path: '/pembayaran/:id/verifikasi', description: 'Verify payment', params: { id: '' }, body: { status: 'selesai' } }
  ],
  Stock: [
    { method: 'GET', path: '/stok', description: 'Get stock overview' },
    { method: 'GET', path: '/stok/cabang/:id', description: 'Get stock by branch', params: { id: '' } },
    { method: 'GET', path: '/stok/riwayat/:id_cabang/:id_produk', description: 'Get stock history', params: { id_cabang: '', id_produk: '' } },
    { method: 'POST', path: '/stok/penyesuaian', description: 'Stock adjustment', body: { id_cabang: 0, id_produk: 0, quantity: 0, tipe: 'penambahan', alasan: '' } },
    { method: 'POST', path: '/stok/transfer', description: 'Stock transfer', body: { id_cabang_asal: 0, id_cabang_tujuan: 0, items: [] } },
    { method: 'POST', path: '/stok/distribusi', description: 'Stock distribution', body: { id_cabang: 0, items: [] } },
    { method: 'DELETE', path: '/stok/:id_cabang/:id_produk', description: 'Delete stock entry', params: { id_cabang: '', id_produk: '' } }
  ],
  'Warehouse Stock': [
    { method: 'GET', path: '/stok-gudang', description: 'Get warehouse stock' },
    { method: 'PUT', path: '/stok-gudang', description: 'Update warehouse stock', body: { id_produk: 0, quantity: 0 } }
  ],
  'Returns': [
    { method: 'GET', path: '/retur-penjualan', description: 'Get sales returns' },
    { method: 'POST', path: '/retur-penjualan', description: 'Create sales return', body: { id_penjualan: 0, items: [{ id_produk: 0, jumlah: 1 }], alasan: '' } }
  ],
  Mutations: [
    { method: 'GET', path: '/mutasi', description: 'Get stock mutations' },
    { method: 'POST', path: '/mutasi', description: 'Create stock mutation', body: { id_cabang_asal: 0, id_cabang_tujuan: 0, items: [] } }
  ],
  'Stock Adjustments': [
    { method: 'GET', path: '/penyesuaian-stok', description: 'Get stock adjustments' },
    { method: 'POST', path: '/penyesuaian-stok', description: 'Create stock adjustment', body: { id_cabang: 0, id_produk: 0, quantity: 0, tipe: 'penambahan', alasan: '' } }
  ],
  Loyalty: [
    { method: 'GET', path: '/loyalty', description: 'Get loyalty overview' },
    { method: 'GET', path: '/loyalty/pelanggan/:id_pelanggan', description: 'Get customer loyalty', params: { id_pelanggan: '' } }
  ],
  'Loyalty Tiers': [
    { method: 'GET', path: '/loyalty-tiers', description: 'Get loyalty tiers' },
    { method: 'POST', path: '/loyalty-tiers', description: 'Create loyalty tier', body: { nama_tier: '', poin_min: 0, poin_max: 0, diskon_persen: 0, bonus_poin_persen: 0, benefit: {}, aktif: true } },
    { method: 'PUT', path: '/loyalty-tiers/:id', description: 'Update loyalty tier', params: { id: '' }, body: { nama_tier: '', poin_min: 0, poin_max: 0, diskon_persen: 0, bonus_poin_persen: 0, benefit: {}, aktif: true } },
    { method: 'DELETE', path: '/loyalty-tiers/:id', description: 'Delete loyalty tier', params: { id: '' } }
  ],
  Tax: [
    { method: 'GET', path: '/pajak', description: 'Get all taxes' },
    { method: 'GET', path: '/pajak/:id', description: 'Get tax by ID', params: { id: '' } },
    { method: 'POST', path: '/pajak', description: 'Create new tax', body: { nama: '', persentase: 0 } },
    { method: 'PUT', path: '/pajak/:id', description: 'Update tax', params: { id: '' }, body: { nama: '', persentase: 0 } },
    { method: 'DELETE', path: '/pajak/:id', description: 'Delete tax', params: { id: '' } },
    { method: 'POST', path: '/pajak/kalkulasi', description: 'Calculate tax', body: { subtotal: 0, id_pajak: 0 } }
  ],
  Vouchers: [
    { method: 'GET', path: '/voucher', description: 'Get all vouchers' },
    { method: 'GET', path: '/voucher/:id', description: 'Get voucher by ID', params: { id: '' } },
    { method: 'POST', path: '/voucher', description: 'Create new voucher', body: { kode: '', tipe: 'persentase', nilai: 0, tanggal_mulai: '', tanggal_akhir: '' } },
    { method: 'PUT', path: '/voucher/:id', description: 'Update voucher', params: { id: '' }, body: { kode: '', tipe: 'persentase', nilai: 0, tanggal_mulai: '', tanggal_akhir: '' } },
    { method: 'DELETE', path: '/voucher/:id', description: 'Delete voucher', params: { id: '' } }
  ],
  Discounts: [
    { method: 'GET', path: '/diskon', description: 'Get all discounts', query: { aktif: true } },
    { method: 'POST', path: '/diskon', description: 'Create new discount', body: { nama_diskon: '', tipe: 'persentase', nilai: 0, berlaku_dari: '', berlaku_sampai: '', aktif: true } },
    { method: 'PUT', path: '/diskon/:id', description: 'Update discount', params: { id: '' }, body: { nama_diskon: '', tipe: 'persentase', nilai: 0, berlaku_dari: '', berlaku_sampai: '', aktif: true } },
    { method: 'DELETE', path: '/diskon/:id', description: 'Delete discount', params: { id: '' } }
  ],
  Units: [
    { method: 'GET', path: '/satuan', description: 'Get all units' },
    { method: 'GET', path: '/satuan/:id', description: 'Get unit by ID', params: { id: '' } },
    { method: 'POST', path: '/satuan', description: 'Create new unit', body: { nama: '' } },
    { method: 'PUT', path: '/satuan/:id', description: 'Update unit', params: { id: '' }, body: { nama: '' } },
    { method: 'DELETE', path: '/satuan/:id', description: 'Delete unit', params: { id: '' } }
  ],
  Purchases: [
    { method: 'GET', path: '/pembelian', description: 'Get purchases with pagination', query: { page: 1, limit: 20 } },
    { method: 'GET', path: '/pembelian/:id', description: 'Get purchase by ID', params: { id: '' } },
    { method: 'POST', path: '/pembelian', description: 'Create new purchase', body: { id_supplier: 0, items: [], tanggal: '' } }
  ],
  Customers: [
    { method: 'GET', path: '/pelanggan', description: 'Get all customers' },
    { method: 'GET', path: '/pelanggan/:id', description: 'Get customer by ID', params: { id: '' } },
    { method: 'POST', path: '/pelanggan', description: 'Create new customer', body: { nama: '', email: '', telepon: '' } },
    { method: 'PUT', path: '/pelanggan/:id', description: 'Update customer', params: { id: '' }, body: { nama: '', email: '', telepon: '' } },
    { method: 'DELETE', path: '/pelanggan/:id', description: 'Delete customer', params: { id: '' } },
    { method: 'GET', path: '/pelanggan/:id/loyalty', description: 'Get customer loyalty info', params: { id: '' } },
    { method: 'GET', path: '/pelanggan/:id/riwayat-pembelian', description: 'Get purchase history', params: { id: '' } },
    { method: 'GET', path: '/pelanggan/segmentasi/list', description: 'Get customer segmentation' }
  ],
  Users: [
    { method: 'GET', path: '/users', description: 'Get all users' },
    { method: 'GET', path: '/users/:id', description: 'Get user by ID', params: { id: '' } },
    { method: 'POST', path: '/users', description: 'Create new user', body: { nama_lengkap: '', username: '', password: '', role: 'kasir', id_cabang: null, printer_nama: '', printer_tipe: 'thermal' } },
    { method: 'PUT', path: '/users/:id', description: 'Update user', params: { id: '' }, body: { nama_lengkap: '', username: '', password: '', role: 'kasir', id_cabang: null, printer_nama: '', printer_tipe: 'thermal' } },
    { method: 'DELETE', path: '/users/:id', description: 'Delete user', params: { id: '' } }
  ],
  Branches: [
    { method: 'GET', path: '/cabang', description: 'Get all branches' },
    { method: 'GET', path: '/cabang/:id', description: 'Get branch by ID', params: { id: '' } },
    { method: 'POST', path: '/cabang', description: 'Create new branch', body: { kode_cabang: '', nama_cabang: '', alamat: '', kota: '', no_telp: '', struk_header: '', struk_footer: '', status: 'aktif' } },
    { method: 'PUT', path: '/cabang/:id', description: 'Update branch', params: { id: '' }, body: { kode_cabang: '', nama_cabang: '', alamat: '', kota: '', no_telp: '', struk_header: '', struk_footer: '', status: 'aktif' } },
    { method: 'DELETE', path: '/cabang/:id', description: 'Delete branch', params: { id: '' } }
  ],
  Suppliers: [
    { method: 'GET', path: '/supplier', description: 'Get all suppliers' },
    { method: 'GET', path: '/supplier/:id', description: 'Get supplier by ID', params: { id: '' } },
    { method: 'POST', path: '/supplier', description: 'Create new supplier', body: { nama: '', alamat: '', telepon: '' } },
    { method: 'PUT', path: '/supplier/:id', description: 'Update supplier', params: { id: '' }, body: { nama: '', alamat: '', telepon: '' } },
    { method: 'DELETE', path: '/supplier/:id', description: 'Delete supplier', params: { id: '' } }
  ],
  AuditTrail: [
    { method: 'GET', path: '/audit-trail', description: 'Get audit logs', query: { page: 1, limit: 50, id_user: '', start_date: '', end_date: '' } },
    { method: 'GET', path: '/audit-trail/:id', description: 'Get audit log by ID', params: { id: '' } },
    { method: 'POST', path: '/audit-trail', description: 'Create audit log', body: { aktivitas: '', id_user: null } },
    { method: 'DELETE', path: '/audit-trail/:id', description: 'Delete audit log', params: { id: '' } }
  ],
  Reports: [
    { method: 'GET', path: '/laporan/penjualan', description: 'Sales report', query: { tanggal_dari: '', tanggal_sampai: '', id_cabang: '' } },
    { method: 'GET', path: '/laporan/stok', description: 'Stock report', query: { id_cabang: '', id_produk: '' } },
    { method: 'GET', path: '/laporan/pembayaran', description: 'Payment report', query: { tanggal_dari: '', tanggal_sampai: '' } },
    { method: 'GET', path: '/laporan/kartu-stok/:id_produk', description: 'Stock card report', params: { id_produk: '' } },
    { method: 'GET', path: '/laporan/valuasi-inventory', description: 'Inventory valuation report' },
    { method: 'GET', path: '/laporan/segmentasi-pelanggan', description: 'Customer segmentation report' },
    { method: 'GET', path: '/laporan/loyalty', description: 'Loyalty report' },
    { method: 'GET', path: '/laporan/top-seller', description: 'Top seller report' }
  ],
  Settings: [
    { method: 'GET', path: '/pengaturan', description: 'Get settings' },
    { method: 'GET', path: '/pengaturan/:key', description: 'Get setting by key', params: { key: '' } },
    { method: 'PUT', path: '/pengaturan/:key', description: 'Update setting', params: { key: '' }, body: { value: '' } }
  ],
  Health: [
    { method: 'GET', path: '/health', description: 'Health check' }
  ]
};

const ApiTestingPage = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [requestData, setRequestData] = useState({
    method: 'GET',
    path: '',
    params: {},
    query: {},
    body: {}
  });
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const filteredEndpoints = useMemo(() => {
    if (!searchTerm) return endpoints;

    const filtered = {};
    Object.entries(endpoints).forEach(([category, endpointList]) => {
      const filteredList = endpointList.filter(endpoint =>
        endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        endpoint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        endpoint.method.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (filteredList.length > 0) {
        filtered[category] = filteredList;
      }
    });
    return filtered;
  }, [searchTerm]);

  const selectEndpoint = (endpoint) => {
    setSelectedEndpoint(endpoint);
    setRequestData({
      method: endpoint.method,
      path: endpoint.path,
      params: endpoint.params || {},
      query: endpoint.query || {},
      body: endpoint.body || {}
    });
    setResponse(null);
    setError(null);
  };

  const updateRequestData = (type, key, value) => {
    setRequestData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [key]: value
      }
    }));
  };

  const sendRequest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      let url = requestData.path;

      // Replace path parameters
      Object.keys(requestData.params).forEach(key => {
        url = url.replace(`:${key}`, requestData.params[key]);
      });

      const config = {
        method: requestData.method.toLowerCase(),
        url,
        params: requestData.query,
        ...(requestData.method !== 'GET' && { data: requestData.body })
      };

      const result = await apiClient(config);
      setResponse(result);
    } catch (err) {
      setError(err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">API Testing Playground</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoint List */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4">Endpoints</h2>

          {/* Search Input */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search endpoints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Object.entries(filteredEndpoints).map(([category, endpointList]) => (
              <div key={category} className="border rounded">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between font-medium"
                >
                  <span>{category}</span>
                  <span className="text-sm text-gray-500">
                    {expandedCategories[category] ? '▼' : '▶'} ({endpointList.length})
                  </span>
                </button>
                {expandedCategories[category] && (
                  <div className="space-y-1 p-2">
                    {endpointList.map((endpoint, index) => (
                      <button
                        key={index}
                        onClick={() => selectEndpoint(endpoint)}
                        className={`w-full text-left p-2 rounded border transition-colors ${
                          selectedEndpoint === endpoint
                            ? 'bg-blue-100 border-blue-300 shadow-sm'
                            : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-mono rounded ${
                            endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                            endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                            endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                            endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {endpoint.method}
                          </span>
                          <span className="text-sm font-mono flex-1 truncate">{endpoint.path}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 leading-tight">{endpoint.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Request Builder */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4">Request Builder</h2>
          {selectedEndpoint ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <span className="px-3 py-1 bg-gray-100 rounded font-mono">{requestData.method}</span>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Path</label>
                <input
                  type="text"
                  value={requestData.path}
                  onChange={(e) => setRequestData(prev => ({ ...prev, path: e.target.value }))}
                  className="w-full p-2 border rounded font-mono text-sm"
                />
              </div>

              {/* Path Parameters */}
              {Object.keys(requestData.params).length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Path Parameters</label>
                  {Object.entries(requestData.params).map(([key, value]) => (
                    <div key={key} className="flex space-x-2 mb-2">
                      <span className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">:{key}</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateRequestData('params', key, e.target.value)}
                        placeholder={`Enter ${key}`}
                        className="flex-1 p-1 border rounded text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Query Parameters */}
              {Object.keys(requestData.query).length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Query Parameters</label>
                  {Object.entries(requestData.query).map(([key, value]) => (
                    <div key={key} className="flex space-x-2 mb-2">
                      <span className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{key}</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateRequestData('query', key, e.target.value)}
                        placeholder={`Enter ${key}`}
                        className="flex-1 p-1 border rounded text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Request Body */}
              {requestData.method !== 'GET' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Request Body (JSON)</label>
                  <textarea
                    value={JSON.stringify(requestData.body, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setRequestData(prev => ({ ...prev, body: parsed }));
                      } catch (_err) {
                        // Invalid JSON, keep as string for now
                      }
                    }}
                    className="w-full p-2 border rounded font-mono text-sm h-32"
                    placeholder="Enter JSON body"
                  />
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={sendRequest}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  <span>{loading ? 'Sending...' : 'Send Request'}</span>
                </button>
                <button
                  onClick={() => {
                    setResponse(null);
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Select an endpoint to start testing</p>
          )}
        </div>

        {/* Response Viewer */}
        <div className="lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Response</h2>
            {(response || error) && (
              <button
                onClick={() => copyToClipboard(JSON.stringify(response?.data || error, null, 2))}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 flex items-center space-x-1"
              >
                <span>{copied ? '✓' : '📋'}</span>
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            )}
          </div>
          <div className="border rounded p-4 min-h-96 bg-gray-50">
            {loading && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <p>Sending request...</p>
              </div>
            )}
            {error && (
              <div className="text-red-600">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">❌</span>
                  <h3 className="font-semibold">Error Response</h3>
                </div>
                <pre className="text-sm bg-red-50 p-3 rounded border whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(error, null, 2)}
                </pre>
              </div>
            )}
            {response && (
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="text-lg">✅</span>
                  <div>
                    <span className="font-semibold">Status: </span>
                    <span className={`px-2 py-1 rounded text-sm ${
                      response.status >= 200 && response.status < 300
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {response.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="font-semibold">Response Data:</span>
                  <pre className="text-sm mt-2 bg-white p-3 rounded border whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            {!loading && !error && !response && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <span className="text-4xl mb-4">🔍</span>
                <p className="text-center">Select an endpoint and send a request to see the response here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiTestingPage;