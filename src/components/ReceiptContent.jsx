import React from 'react';

// Ini adalah komponen "bodoh" yang hanya menampilkan data.
// Dibungkus dengan forwardRef agar bisa menerima ref dari PrintModal.
const ReceiptContent = React.forwardRef(({ saleData }, ref) => {
  React.useEffect(() => {
    // In development, log the ref for debugging
    if (import.meta.env.DEV) {
      const cur = ref?.current;
    }
  }, [ref, saleData]);

  if (!saleData) return null;

  return (
    <div ref={ref} className="p-4 font-mono text-xs" style={{ width: '300px' }}>
      <div className="text-center mb-4">
        <h1 className="text-lg font-bold">Toko Nusasoft</h1>
        <p>{saleData.Cabang?.nama_cabang || 'Pusat'}</p>
        <p>{saleData.Cabang?.alamat || ''}</p>
      </div>

      <div className="mb-2">
        <p>No: {saleData.kode_transaksi}</p>
        <p>Tgl: {new Date(saleData.tanggal).toLocaleString('id-ID')}</p>
        <p>Kasir: {saleData.User?.nama_lengkap || 'N/A'}</p>
      </div>

      <hr className="border-dashed border-black my-2" />

      {saleData.PenjualanDetails?.map((item) => (
        <div key={item.id_penjualan_detail} className="mb-1">
          <p>{item.Produk?.nama_produk || 'Produk tidak ditemukan'}</p>
          <div className="flex justify-between">
            <span>{item.jumlah} x {Number(item.harga_jual).toLocaleString('id-ID')}</span>
            <span>{Number(item.subtotal).toLocaleString('id-ID')}</span>
          </div>
        </div>
      ))}

      <hr className="border-dashed border-black my-2" />

      <div className="space-y-1">
        {(() => {
          // Group payment methods and count occurrences
          let paymentMethods = [];
          
          if (Array.isArray(saleData.detail_pembayaran) && saleData.detail_pembayaran.length > 0) {
            // New structure: detail_pembayaran with nested metodePembayaran
            paymentMethods = saleData.detail_pembayaran.map(payment => 
              payment.metodePembayaran?.nama_metode || payment.nama_metode || 'Pembayaran'
            );
          } else if (Array.isArray(saleData.metode_pembayaran) && saleData.metode_pembayaran.length > 0) {
            // Fallback: old structure
            paymentMethods = saleData.metode_pembayaran.map(method => 
              method.nama_metode || method.nama || 'Pembayaran'
            );
          } else {
            // Final fallback: single method
            paymentMethods = [saleData.MetodePembayaran?.nama_metode || 
              (typeof saleData.metode_pembayaran === 'string' ? saleData.metode_pembayaran : 
               saleData.metode_pembayaran?.nama_metode || 'Tunai')];
          }
          
          // Group and count methods
          const methodCounts = paymentMethods.reduce((acc, method) => {
            acc[method] = (acc[method] || 0) + 1;
            return acc;
          }, {});
          
          return Object.entries(methodCounts).map(([method, count]) => (
            <div key={method} className="text-sm">
              <span>Metode: {method}{count > 1 ? ` (${count}x)` : ''}</span>
            </div>
          ));
        })()}
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>Rp {Number(saleData.total).toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between">
          <span>Bayar</span>
          <span>Rp {Number(saleData.bayar).toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between">
          <span>Kembalian</span>
          <span>Rp {Number(saleData.kembalian).toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div className="text-center mt-6">
        <p>Terima Kasih!</p>
        <p>Barang yang sudah dibeli tidak dapat dikembalikan.</p>
      </div>
    </div>
  );
});

export default ReceiptContent;