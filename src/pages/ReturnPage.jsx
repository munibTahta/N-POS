import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getSalesReturns } from '../services/api';
import { extractArray } from '../utils/apiResponseHelper';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { SearchFilterBar, FilterPanel, FilterPanelGrid } from '../components/SearchFilterBar';
import ResponsiveTable from '../components/common/ResponsiveTable';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import HeaderActionButton from '../components/HeaderActionButton';
import { Plus } from 'lucide-react';

const CreateIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const ReturnPage = () => {
  const [returns, setReturns] = useState([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    const loadReturns = async () => {
      setLoadingReturns(true);
      try {
        const response = await getSalesReturns();
        const data = extractArray(response);
        setReturns(data);
      } catch (err) {
        console.error('Error loading returns:', err);
      } finally {
        setLoadingReturns(false);
      }
    };

    loadReturns();
  }, []);

  const filteredReturns = useMemo(() => {
    const normalizedSearch = (searchQuery || '').toLowerCase().trim();
    return returns.filter((retur) => {
      if (!retur) return false;

      const dateValue = retur.tanggal ? new Date(retur.tanggal) : null;
      const matchesSearch =
        normalizedSearch === '' ||
        [
          retur.id_retur,
          retur.id_penjualan,
          retur.penjualan?.kode_transaksi,
          retur.produk?.nama_produk,
          retur.alasan,
          retur.user?.nama_lengkap,
          retur.user?.username,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));

      const matchesMethod =
        filterMethod === 'all' || String(retur.metode_pengembalian || '').toLowerCase() === filterMethod.toLowerCase();
      const matchesFrom = !filterDateFrom || !dateValue || dateValue >= new Date(filterDateFrom);
      const matchesTo = !filterDateTo || !dateValue || dateValue <= new Date(filterDateTo);

      return matchesSearch && matchesMethod && matchesFrom && matchesTo;
    });
  }, [returns, searchQuery, filterMethod, filterDateFrom, filterDateTo]);

  const pagination = usePagination({ data: filteredReturns, itemsPerPage: 15 });

  useEffect(() => {
    pagination.setPage(1);
  }, [filteredReturns.length, pagination]);

  const filteredReturnValue = filteredReturns.reduce(
    (sum, retur) => sum + (Number(retur.jumlah || 0) * Number(retur.harga_jual || 0)),
    0,
  );

  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title="Manajemen Retur Penjualan"
          subtitle="Lihat riwayat retur dan gunakan filter untuk menelusuri data dengan cepat."
          actions={
            <HeaderActionButton
              icon={Plus}
              label="Buat Retur Baru"
              variant="emerald"
              to="/return/create"
              isLink
              hideLabel={true}
            />
          }
        />

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Total Retur</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{returns.length.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Hasil Filter</p>
              <p className="mt-2 text-2xl font-semibold text-sky-700">{filteredReturns.length.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Estimasi Nilai Retur</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-700">Rp {filteredReturnValue.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6">
              <SearchFilterBar
                searchTerm={searchQuery}
                onSearchChange={setSearchQuery}
                onClearSearch={() => setSearchQuery('')}
                onFilterToggle={() => setShowFilters((prev) => !prev)}
                isFilterActive={showFilters}
                hasActiveFilters={filterMethod !== 'all' || filterDateFrom || filterDateTo}
                onClearFilters={() => {
                  setSearchQuery('');
                  setFilterMethod('all');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
                searchPlaceholder="Cari ID retur, kode transaksi, produk, alasan, atau user..."
                className="mb-4"
              />

              <FilterPanel visible={showFilters} className="mb-6">
                <FilterPanelGrid cols={3} className="gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Metode Pengembalian</label>
                    <select
                      value={filterMethod}
                      onChange={(e) => setFilterMethod(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Semua Metode</option>
                      <option value="tunai">Tunai</option>
                      <option value="voucher">Voucher</option>
                      <option value="tukar">Tukar Barang</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Tanggal Mulai</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Tanggal Akhir</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </FilterPanelGrid>
              </FilterPanel>

              {loadingReturns ? (
                <div className="text-center py-10 text-slate-600">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
                  <p className="mt-3">Memuat data retur...</p>
                </div>
              ) : filteredReturns.length === 0 ? (
                <div className="p-10 text-center text-slate-500">
                  {returns.length === 0 ? 'Belum ada data retur.' : 'Tidak ada retur yang sesuai dengan filter saat ini.'}
                </div>
              ) : (
                <ResponsiveTable className="bg-white rounded-b-none">
                  <table className="min-w-full divide-y divide-slate-200 bg-white">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID Retur</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Kode Transaksi</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Produk</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Jumlah</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Alasan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {pagination.currentData.map((retur) => (
                        <tr key={retur.id_retur} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-900">#{retur.id_retur}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">{retur.penjualan?.kode_transaksi || `TRX${retur.id_penjualan}`}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">{retur.produk?.nama_produk || `Produk ${retur.id_produk}`}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">{retur.jumlah}</td>
                          <td className="max-w-xs truncate px-4 py-4 text-sm text-slate-900">{retur.alasan}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">{retur.tanggal ? new Date(retur.tanggal).toLocaleDateString('id-ID') : '-'}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">{retur.user?.nama_lengkap || retur.user?.username || `User ID: ${retur.id_user || 'N/A'}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveTable>
              )}
            </div>
          </div>

          {pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setPage}
              itemsPerPage={pagination.itemsPerPage}
              totalItems={filteredReturns.length}
            />
          )}
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default ReturnPage;
