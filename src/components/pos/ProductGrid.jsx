// src/components/pos/ProductGrid.jsx
import React from 'react';
import { formatCurrency } from '../../utils/formatHelper';
import { resolveUrl } from '../../utils/resolveUrl';
import LazyImage from '../common/LazyImage';
import ProductGridSkeleton from '../common/ProductGridSkeleton';

const ProductCard = React.memo(({ product, stock, onAddToCart, isSelected = false, dataGridIndex }) => {
  const isOutOfStock = stock <= 0;

  // Create tooltip content with product details
  const tooltipContent = React.useMemo(() => {
    let content = `${product.nama_produk}`;
    if (product.kode_produk) content += `\nKode: ${product.kode_produk}`;
    content += `\nHarga: ${formatCurrency(product.harga_jual)}`;
    if (product.harga_grosir && product.harga_grosir > 0) {
      content += `\nHarga Grosir: ${formatCurrency(product.harga_grosir)}`;
      if (product.min_qty_grosir) content += ` (min ${product.min_qty_grosir})`;
    }
    content += `\nStok: ${stock}`;
    if (product.kategori) content += `\nKategori: ${product.kategori}`;
    return content;
  }, [product, stock]);

  return (
    <div
      data-product-id={product.id_produk}
      data-grid-index={dataGridIndex}
      aria-selected={isSelected}
      title={tooltipContent}
      className={`border rounded-lg p-2 sm:p-3 cursor-pointer transition-all hover:shadow-md touch-manipulation ${
        isOutOfStock ? 'opacity-50 bg-gray-100' : 'hover:border-blue-300 active:bg-blue-50'
      } ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
      }`}
      onClick={() => !isOutOfStock && onAddToCart(product)}
      tabIndex={isSelected ? 0 : -1}
    >
      <div className="aspect-square bg-gray-200 rounded mb-2 flex items-center justify-center relative">
        <LazyImage
          src={product.gambar ? resolveUrl(product.gambar) : null}
          alt={product.nama_produk}
          className="w-full h-full object-cover rounded"
          placeholderClassName="w-full h-full"
        />
      </div>

      <h3 className="font-medium text-xs sm:text-sm mb-1 line-clamp-2 leading-tight">
        {product.nama_produk}
      </h3>

      <div className="flex justify-between items-center">
        <span className="font-bold text-blue-600 text-sm sm:text-base">
          {formatCurrency(product.harga_jual)}
        </span>
        <span className={`text-xs font-medium px-2 py-1 rounded ${isOutOfStock ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
          {stock}
        </span>
      </div>

      {product.kode_produk && (
        <p className="text-xs text-gray-500 mt-1 truncate">
          Kode: {product.kode_produk}
        </p>
      )}
    </div>
  );
});

const ProductGrid = ({ products, stockInfo, onAddToCart, loading = false, selectedProductIndex = -1 }) => {
  if (loading) {
    return <ProductGridSkeleton count={15} />;
  }

  // Show empty state when no products to display
  if (!Array.isArray(products) || products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">
          Tidak ada produk untuk ditampilkan
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id_produk}
          product={product}
          stock={stockInfo[product.id_produk] || 0}
          onAddToCart={onAddToCart}
          isSelected={index === selectedProductIndex}
          dataGridIndex={index}
        />
      ))}
    </div>
  );
};

export default ProductGrid;