// src/components/common/ProductGridSkeleton.jsx
import React from 'react';
import ProductCardSkeleton from './ProductCardSkeleton';

const ProductGridSkeleton = ({ count = 12 }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
};

export default ProductGridSkeleton;