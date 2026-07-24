import React from 'react';
import { PageLayout, PageContainer, PageHeader } from '../components/layouts/index.jsx';

const HomePage = () => {
  return (
    <PageLayout>
      <PageContainer>
        <PageHeader title="Selamat Datang di Nusasoft Toko" />
        <div className="text-center">
          <p className="text-lg text-gray-600">Silahkan jelajahi produk kami atau login untuk melanjutkan.</p>
        </div>
      </PageContainer>
    </PageLayout>
  );
};

export default HomePage;