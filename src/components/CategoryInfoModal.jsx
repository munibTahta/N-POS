import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getCategories } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { exportToExcel } from '../utils/exportHelper';
import { handleError } from '../utils/errorHandler';

const CategoryInfoModal = ({ isOpen, onClose }) => {
  const { error: showError, success: showSuccess } = useNotifications();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getCategories();
      const categoriesData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load categories:', err);
      showError('Gagal memuat data kategori');
      handleError(err, 'CategoryInfoModal:loadCategories', 'Gagal memuat data kategori');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Load categories on modal open
  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen, loadCategories]);

  // Filter categories based on search term
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;

    return categories.filter(category =>
      category.nama_kategori?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.deskripsi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.id_kategori?.toString().includes(searchTerm)
    );
  }, [categories, searchTerm]);

  const handleExportToExcel = async () => {
    try {
      if (filteredCategories.length === 0) {
        showError('Tidak ada data kategori untuk diekspor');
        return;
      }

      const rows = filteredCategories.map(category => ({
        'ID Kategori': category.id_kategori,
        'Nama Kategori': category.nama_kategori || '',
        'Deskripsi': category.deskripsi || '',
        'Status': category.status || 'aktif',
        'Dibuat': category.created_at ? new Date(category.created_at).toLocaleString('id-ID') : '',
        'Diubah': category.updated_at ? new Date(category.updated_at).toLocaleString('id-ID') : ''
      }));

      await exportToExcel(rows, `Kategori_Produk_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showSuccess('Data kategori berhasil didownload ke Excel');
    } catch (err) {
      console.error('Failed to export categories:', err);
      showError('Gagal mengekspor data kategori: ' + (err.message || 'Unknown error'));
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-100 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">📂 Info Kategori Produk</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Export */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Cari kategori..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleExportToExcel}
              disabled={filteredCategories.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Excel
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Memuat kategori...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-5.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-600">
                {searchTerm ? 'Tidak ada kategori yang cocok dengan pencarian' : 'Belum ada kategori produk'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID Kategori
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nama Kategori
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deskripsi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCategories.map((category) => (
                    <tr key={category.id_kategori} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {category.id_kategori}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {category.nama_kategori || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {category.deskripsi || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Menampilkan {filteredCategories.length} dari {categories.length} kategori
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryInfoModal;