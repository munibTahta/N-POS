// src/components/pos/ProductGrid.jsx
import React from 'react';
import { formatCurrency } from '../../utils/formatHelper';
import { resolveUrl } from '../../utils/resolveUrl';
import LazyImage from '../common/LazyImage';
import ProductGridSkeleton from '../common/ProductGridSkeleton';

// Warna tile inisial yang konsisten per produk (dipakai saat produk tidak punya foto)
const TILE_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700', 'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700', 'bg-teal-100 text-teal-700',
];
const initialsOf = (name = '') => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || '?') + (words[1]?.[0] || '')).toUpperCase();
};

const ProductCard = React.memo(({ product, stock, onAddToCart, isSelected = false, dataGridIndex, qtyInCart = 0 }) => {
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= 5;
  const tile = TILE_COLORS[Math.abs(Number(product.id_produk) || 0) % TILE_COLORS.length];

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
    <button
      type="button"
      data-product-id={product.id_produk}
      data-grid-index={dataGridIndex}
      aria-selected={isSelected}
      aria-disabled={isOutOfStock}
      title={tooltipContent}
      className={`relative flex flex-col text-left bg-white rounded-xl overflow-hidden select-none touch-manipulation shadow-sm ring-1 ring-gray-200 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
        isOutOfStock ? 'cursor-not-allowed' : 'hover:shadow-md hover:ring-blue-300 active:scale-[0.97]'
      } ${qtyInCart > 0 ? 'ring-2 ring-blue-500' : ''} ${isSelected ? 'ring-2 ring-blue-600 shadow-lg' : ''}`}
      onClick={() => !isOutOfStock && onAddToCart(product)}
      tabIndex={isSelected ? 0 : -1}
    >
      {qtyInCart > 0 && (
        <span className="absolute top-1.5 right-1.5 z-10 min-w-[24px] h-6 px-1.5 rounded-full bg-blue-600 text-white text-xs font-bold tabular-nums flex items-center justify-center shadow-md" aria-label={`${qtyInCart} di keranjang`}>
          {qtyInCart}
        </span>
      )}

      <div className={`relative aspect-[4/3] w-full flex items-center justify-center ${product.gambar ? 'bg-gray-100' : tile} ${isOutOfStock ? 'opacity-40 grayscale' : ''}`}>
        {product.gambar ? (
          <LazyImage
            src={resolveUrl(product.gambar)}
            alt={product.nama_produk}
            className="w-full h-full object-cover"
            placeholderClassName="w-full h-full"
          />
        ) : (
          <span className="text-2xl sm:text-3xl font-semibold tracking-tight" aria-hidden="true">{initialsOf(product.nama_produk)}</span>
        )}
      </div>

      <div className="flex flex-col gap-1 p-2.5 sm:p-3 flex-1">
        <h3 className={`text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem] ${isOutOfStock ? 'text-gray-400' : 'text-gray-900'}`}>
          {product.nama_produk}
        </h3>
        <span className={`text-base font-bold tabular-nums mt-auto ${isOutOfStock ? 'text-gray-400' : 'text-blue-700'}`}>
          {formatCurrency(product.harga_jual)}
        </span>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-xs text-gray-500 truncate tabular-nums">{product.kode_produk || ''}</span>
          <span className={`shrink-0 whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-full tabular-nums ${
            isOutOfStock ? 'bg-red-50 text-red-600' : isLowStock ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {isOutOfStock ? 'Habis' : `Stok ${stock}`}
          </span>
        </div>
      </div>
    </button>
  );
});

const GRID_CLASS = {
  compact: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
  normal: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  large: 'grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
};

const ProductGrid = ({ products, stockInfo, onAddToCart, loading = false, selectedProductIndex = -1, density = 'normal', cartQty = {} }) => {
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
    <div className={`grid ${GRID_CLASS[density] || GRID_CLASS.normal} gap-2 sm:gap-4`}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id_produk}
          product={product}
          stock={stockInfo[product.id_produk] || 0}
          onAddToCart={onAddToCart}
          isSelected={index === selectedProductIndex}
          dataGridIndex={index}
          qtyInCart={cartQty[product.id_produk] || 0}
        />
      ))}
    </div>
  );
};

export default ProductGrid;