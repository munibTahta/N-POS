import React from 'react';

const PurchaseReceipt = React.forwardRef(({ purchaseData }, ref) => {
  if (!purchaseData) return null;

  // Pastikan items ada dan merupakan array
  const items = purchaseData.items || [];
  const total = items.reduce((sum, item) => sum + (item.jumlah * item.harga_beli), 0);

  return (
    <div ref={ref} className="p-8 font-mono text-sm">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold">BUKTI PEMBELIAN</h1>
        <p>Toko Nusasoft</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 mb-4">
        <div>
          <p><strong>No. Pembelian:</strong> {purchaseData.kode_pembelian}</p>
          <p><strong>Tanggal:</strong> {new Date(purchaseData.tanggal).toLocaleString('id-ID')}</p>
        </div>
        <div>
          <p><strong>Supplier:</strong> {purchaseData.Supplier?.nama_supplier || 'N/A'}</p>
          <p><strong>Tujuan:</strong> {purchaseData.masuk_gudang ? 'Gudang Pusat' : (purchaseData.Cabang?.nama_cabang || 'N/A')}</p>
        </div>
      </div>

      <table className="min-w-full border-collapse border border-gray-400">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-2 text-left">No</th>
            <th className="border border-gray-300 p-2 text-left">Nama Produk</th>
            <th className="border border-gray-300 p-2 text-right">Jumlah</th>
            <th className="border border-gray-300 p-2 text-right">Harga Beli</th>
            <th className="border border-gray-300 p-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? items.map((item, index) => (
            <tr key={item.id_produk}>
              <td className="border border-gray-300 p-2">{index + 1}</td>
              <td className="border border-gray-300 p-2">{item.Produk?.nama_produk || 'Produk tidak ditemukan'}</td>
              <td className="border border-gray-300 p-2 text-right">{item.jumlah}</td>
              <td className="border border-gray-300 p-2 text-right">{Number(item.harga_beli).toLocaleString('id-ID')}</td>
              <td className="border border-gray-300 p-2 text-right">{Number(item.jumlah * item.harga_beli).toLocaleString('id-ID')}</td>
            </tr>
          )) : (
            <tr>
              <td colSpan="5" className="border border-gray-300 p-4 text-center text-gray-500">
                Tidak ada item pembelian
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td colSpan="4" className="p-2 text-right">Total</td>
            <td className="p-2 text-right">{Number(total).toLocaleString('id-ID')}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-8 text-xs text-center">
        <p>Terima kasih.</p>
        <p>Dicetak oleh: {purchaseData.User?.nama_lengkap || 'N/A'}</p>
      </div>
    </div>
  );
});

export default PurchaseReceipt;