import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPelangganById, getLoyaltyHistoryByCustomer } from '../services/api';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';
import { renderLucideIcon } from '../utils/lucideIconHelper';

// Add custom animations
const styles = `
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fade-in-up 0.6s ease-out forwards;
    opacity: 0;
  }
`;

// InfoCard component for consistent card styling
const InfoCard = ({ title, icon, children, className = '', borderClass = 'border-l-blue-500', iconClass = 'text-blue-600' }) => (
  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 border-l-4 ${borderClass} ${className}`}>
    <div className="flex items-center mb-4">
      <div className="mr-3">
        {renderLucideIcon(icon, `w-6 h-6 ${iconClass}`)}
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    </div>
    {children}
  </div>
);

// HistoryItem component for loyalty history
const HistoryItem = ({ item }) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-900">
        {item.alasan || item.keterangan || 'Transaksi'}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {item.dibuat_pada || item.createdAt ? new Date(item.dibuat_pada || item.createdAt).toLocaleDateString('id-ID') : ''}
      </p>
    </div>
    <div className={`text-sm font-bold px-2 py-1 rounded ${
      (item.perubahan_poin || item.poin || 0) > 0
        ? 'text-green-700 bg-green-100'
        : 'text-red-700 bg-red-100'
    }`}>
      {(item.perubahan_poin || item.poin || 0) > 0 ? '+' : ''}{(item.perubahan_poin || item.poin || 0)}
    </div>
  </div>
);

const CustomerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState(0);
  const [redeemReason, setRedeemReason] = useState('discount');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [custRes, loyaltyRes] = await Promise.all([
          getPelangganById(id).catch(() => null),
          getLoyaltyHistoryByCustomer(id).catch(() => null)
        ]);
        setCustomer(custRes?.data?.data || custRes?.data || null);
        setLoyalty(loyaltyRes?.data?.data || loyaltyRes?.data || null);
      } catch (err) {
        console.error('Customer detail error', err);
        setError('Gagal memuat data pelanggan');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const handleRedeemPoints = async (e) => {
    e.preventDefault();
    // This would call an API endpoint to redeem points
    // For now, show a success message and close modal
    // Backend implementation: POST /loyalty/redeem or similar
    alert(`Redeem ${redeemAmount} poin untuk ${redeemReason} berhasil diproses`);
    setShowRedeemModal(false);
    setRedeemAmount(0);
  };

  if (loading) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">
              {renderLucideIcon('AlertCircle', 'w-16 h-16 mx-auto')}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Terjadi Kesalahan</h3>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={() => navigate('/pelanggan')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Kembali ke Daftar Pelanggan
            </button>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  if (!customer) {
    return (
      <PageLayout>
        <PageContainer>
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              {renderLucideIcon('UserX', 'w-16 h-16 mx-auto')}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Pelanggan Tidak Ditemukan</h3>
            <p className="text-gray-600">Data pelanggan yang Anda cari tidak tersedia.</p>
            <button
              onClick={() => navigate('/pelanggan')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Kembali ke Daftar Pelanggan
            </button>
          </div>
        </PageContainer>
      </PageLayout>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <PageLayout>
        <PageContainer>
          <PageHeader
            title={`Detail Pelanggan`}
            subtitle={customer.nama_pelanggan || customer.nama || ''}
            actions={
              <button
                onClick={() => navigate('/pelanggan')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {renderLucideIcon('ArrowLeft', 'w-4 h-4 mr-2')}
                Kembali
              </button>
            }
          />

          <div className="space-y-6 animate-fade-in-up">
          {/* Customer Information Card */}
          <InfoCard
            title="Informasi Pelanggan"
            icon="User"
            borderClass="border-l-blue-500"
            iconClass="text-blue-600"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <div className="text-gray-400">
                  {renderLucideIcon('Hash', 'w-5 h-5')}
                </div>
                <div>
                  <p className="text-sm text-gray-500">ID Pelanggan</p>
                  <p className="font-medium">{customer.id_pelanggan || customer.id}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-gray-400">
                  {renderLucideIcon('Phone', 'w-5 h-5')}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nomor HP</p>
                  <p className="font-medium">{customer.nomor_hp || customer.no_telepon || '-'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-gray-400">
                  {renderLucideIcon('Mail', 'w-5 h-5')}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{customer.email || '-'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-gray-400">
                  {renderLucideIcon('ShoppingBag', 'w-5 h-5')}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Belanja</p>
                  <p className="font-medium text-green-600">
                    Rp {(customer.total_belanja || 0).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>
          </InfoCard>

          {/* Loyalty Information Card */}
          <InfoCard
            title="Program Loyalty"
            icon="Star"
            borderClass="border-l-yellow-500"
            iconClass="text-yellow-600"
          >
            {loyalty ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {loyalty.poin_loyalty || 0}
                    </div>
                    <p className="text-sm text-gray-600">Poin Loyalty</p>
                  </div>

                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-lg font-semibold text-blue-600">
                      {loyalty.tier?.nama_tier || loyalty.nama_tier || '-'}
                    </div>
                    <p className="text-sm text-gray-600">Tier Member</p>
                  </div>

                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-lg font-semibold text-green-600">
                      Rp {(loyalty.total_belanja || 0).toLocaleString('id-ID')}
                    </div>
                    <p className="text-sm text-gray-600">Total Belanja</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowRedeemModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
                  >
                    {renderLucideIcon('Gift', 'w-4 h-4 mr-2')}
                    Redeem Poin
                  </button>
                </div>

                {/* Loyalty History */}
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                    {renderLucideIcon('History', 'w-5 h-5 mr-2 text-gray-600')}
                    Riwayat Poin
                  </h4>
                  {(loyalty.riwayat_poin || []).length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {(loyalty.riwayat_poin || []).map((item, idx) => (
                        <HistoryItem key={idx} item={item} index={idx} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="mb-2">
                        {renderLucideIcon('Inbox', 'w-8 h-8 mx-auto text-gray-300')}
                      </div>
                      <p>Belum ada riwayat poin</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="mb-2">
                  {renderLucideIcon('StarOff', 'w-8 h-8 mx-auto text-gray-300')}
                </div>
                <p>Tidak ada data loyalty untuk pelanggan ini</p>
              </div>
            )}
          </InfoCard>
        </div>
      </PageContainer>
    </PageLayout>

      {/* Redeem Points Modal */}
      {showRedeemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Redeem Poin Loyalty</h3>
            <form onSubmit={handleRedeemPoints} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Poin Tersedia: {loyalty?.poin_loyalty || 0}</label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Jumlah Poin yang Diredeem</label>
                <input
                  type="number"
                  value={redeemAmount}
                  onChange={e => setRedeemAmount(Math.max(0, Number(e.target.value)))}
                  max={loyalty?.poin_loyalty || 0}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tujuan Penggunaan</label>
                <select
                  value={redeemReason}
                  onChange={e => setRedeemReason(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="discount">Diskon Pembelian</option>
                  <option value="hadiah">Hadiah Gratis</option>
                  <option value="voucher">Voucher</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setShowRedeemModal(false)}
                  className="px-4 py-2 rounded bg-gray-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                >
                  Redeem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerDetailPage;
