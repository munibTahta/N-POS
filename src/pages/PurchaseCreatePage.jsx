import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts';
import PurchaseForm from './PurchaseFormPage';
import { ArrowLeft } from 'lucide-react';

/**
 * Purchase Create Page
 * Wrapper page for creating new purchase transactions
 * Applies UI Components & Design Patterns from APP_DOCUMENTATION
 */
const PurchaseCreatePage = () => {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <PageContainer>
        {/* Page Header with Back Button */}
        <PageHeader
          title="Transaksi Pembelian Baru"
          subtitle="Buat dan catat transaksi pembelian produk dari supplier"
          actions={
            <button
              onClick={() => navigate('/pembelian')}
              className="inline-flex items-center justify-center rounded-full bg-slate-500 text-white text-xs sm:text-sm font-semibold px-3 py-2 hover:bg-slate-600 transition"
              title="Kembali ke Manajemen Pembelian"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Kembali</span>
            </button>
          }
        />

        {/* Purchase Form */}
        <PurchaseForm />
      </PageContainer>
    </PageLayout>
  );
};

export default PurchaseCreatePage;
